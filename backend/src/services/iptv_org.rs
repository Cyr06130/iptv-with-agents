use std::collections::HashMap;
use std::time::{Duration, Instant};

use serde::Deserialize;
use thiserror::Error;
use tracing::{info, warn};

use crate::models::epg::EpgSchedule;
use crate::services::epg_parser;

/// Base URL for the iptv-org API.
const IPTV_ORG_API: &str = "https://iptv-org.github.io/api";

/// Base URL for iptv-epg.org hosted XMLTV files (by country code).
const EPG_BASE: &str = "https://iptv-epg.org/files";

/// HTTP timeout for fetching JSON indexes.
const INDEX_TIMEOUT: Duration = Duration::from_secs(30);

/// HTTP timeout for fetching guide XML files.
const GUIDE_TIMEOUT: Duration = Duration::from_secs(60);

/// Maximum size for a single guide XML file (50 MB).
const MAX_GUIDE_SIZE: usize = 50 * 1024 * 1024;

/// How long the channel/guide index stays fresh (6 hours).
const INDEX_TTL: Duration = Duration::from_secs(6 * 3600);

/// Errors that can occur while fetching iptv-org data.
#[derive(Debug, Error)]
pub enum IptvOrgError {
    /// HTTP request failed.
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),
    /// JSON deserialization failed.
    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),
    /// EPG XML parse error.
    #[error("EPG parse error: {0}")]
    EpgParse(#[from] epg_parser::EpgParseError),
    /// No guide source found for channel.
    #[error("No guide source found for channel {0}")]
    NoGuide(String),
}

/// A channel entry from iptv-org's channels.json.
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct IptvOrgChannel {
    /// Unique channel ID (e.g., "TF1.fr").
    pub id: String,
    /// Display name of the channel (e.g., "TF1").
    pub name: String,
    /// Alternative names for the channel.
    #[serde(default)]
    pub alt_names: Vec<String>,
    /// Country code (e.g., "FR").
    #[serde(default)]
    pub country: String,
    /// Categories (e.g., ["entertainment"]).
    #[serde(default)]
    pub categories: Vec<String>,
}

/// A guide entry from iptv-org's guides.json.
#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
pub struct IptvOrgGuide {
    /// Channel ID this guide covers (e.g., "TF1.fr"). May be null.
    pub channel: Option<String>,
    /// Site providing the guide (e.g., "canalplus.com").
    pub site: String,
    /// Language of the guide.
    #[serde(default)]
    pub lang: String,
}

/// Cached index of iptv-org channels and guides, refreshed lazily.
#[derive(Debug)]
pub struct IptvOrgIndex {
    /// Channels keyed by lowercase name (for fuzzy matching).
    by_name: HashMap<String, IptvOrgChannel>,
    /// Channels keyed by exact ID (for tvg_id matching).
    by_id: HashMap<String, IptvOrgChannel>,
    /// Guide entries keyed by channel ID.
    guides_by_channel: HashMap<String, IptvOrgGuide>,
    /// When the index was last populated.
    last_updated: Option<Instant>,
}

impl IptvOrgIndex {
    /// Create an empty index.
    pub fn new() -> Self {
        Self {
            by_name: HashMap::new(),
            by_id: HashMap::new(),
            guides_by_channel: HashMap::new(),
            last_updated: None,
        }
    }

    /// Whether the index needs refreshing.
    pub fn is_stale(&self) -> bool {
        match self.last_updated {
            Some(ts) => ts.elapsed() > INDEX_TTL,
            None => true,
        }
    }

    /// Populate the index from fetched data.
    pub fn update(&mut self, channels: Vec<IptvOrgChannel>, guides: Vec<IptvOrgGuide>) {
        self.by_id.clear();
        self.by_name.clear();
        self.guides_by_channel.clear();

        for ch in channels {
            self.by_name.insert(ch.name.to_lowercase(), ch.clone());
            for alt in &ch.alt_names {
                self.by_name.insert(alt.to_lowercase(), ch.clone());
            }
            self.by_id.insert(ch.id.clone(), ch);
        }

        for guide in guides {
            if let Some(ref ch_id) = guide.channel {
                // Keep first guide entry per channel (most relevant).
                self.guides_by_channel.entry(ch_id.clone()).or_insert(guide);
            }
        }

        self.last_updated = Some(Instant::now());
        info!(
            "iptv-org index updated: {} channels, {} guide mappings",
            self.by_id.len(),
            self.guides_by_channel.len()
        );
    }

    /// Find the iptv-org channel ID for a given M3U channel.
    ///
    /// Tries in order:
    /// 1. Exact match on `tvg_id`
    /// 2. Case-insensitive name match
    pub fn find_iptv_org_id(&self, tvg_id: Option<&str>, name: &str) -> Option<String> {
        // 1. Try tvg_id exact match.
        if let Some(tvg) = tvg_id {
            if self.by_id.contains_key(tvg) {
                return Some(tvg.to_string());
            }
        }

        // 2. Try case-insensitive name match.
        if let Some(ch) = self.by_name.get(&name.to_lowercase()) {
            return Some(ch.id.clone());
        }

        None
    }

    /// Get all known names for a channel (primary name + alt names).
    ///
    /// Returns an empty vec if the channel ID is not in the index.
    pub fn get_channel_names(&self, iptv_org_id: &str) -> Vec<String> {
        match self.by_id.get(iptv_org_id) {
            Some(ch) => {
                let mut names = vec![ch.name.clone()];
                names.extend(ch.alt_names.iter().cloned());
                names
            }
            None => Vec::new(),
        }
    }

    /// Get the EPG guide URL for an iptv-org channel ID.
    ///
    /// Returns the URL to the country-level XMLTV file on iptv-epg.org,
    /// derived from the channel ID suffix (e.g., `TF1.fr` → `fr`).
    pub fn get_guide_url(&self, iptv_org_id: &str) -> Option<String> {
        // Derive country from channel ID suffix (e.g., "TF1.fr" -> "fr").
        let country = iptv_org_id
            .rsplit('.')
            .next()
            .unwrap_or("us")
            .to_lowercase();

        Some(format!("{EPG_BASE}/epg-{country}.xml"))
    }
}

/// Refresh the iptv-org index by fetching channels.json and guides.json.
pub async fn refresh_index(
    client: &reqwest::Client,
    index: &mut IptvOrgIndex,
) -> Result<(), IptvOrgError> {
    let channels_url = format!("{IPTV_ORG_API}/channels.json");
    let guides_url = format!("{IPTV_ORG_API}/guides.json");

    info!("Refreshing iptv-org index...");

    let channels: Vec<IptvOrgChannel> = client
        .get(&channels_url)
        .timeout(INDEX_TIMEOUT)
        .send()
        .await?
        .json()
        .await?;

    let guides: Vec<IptvOrgGuide> = client
        .get(&guides_url)
        .timeout(INDEX_TIMEOUT)
        .send()
        .await?
        .json()
        .await?;

    index.update(channels, guides);
    Ok(())
}

/// Result of fetching EPG data: schedules plus a display-name map for matching.
pub struct FetchedEpg {
    /// Programme schedules keyed by XMLTV channel ID.
    pub schedules: HashMap<String, EpgSchedule>,
    /// Lowercase display name → XMLTV channel ID, for fuzzy matching.
    pub display_names: HashMap<String, String>,
}

/// Fetch EPG schedule for a single channel on-demand.
///
/// 1. Looks up the channel in the iptv-org index
/// 2. Builds the country-level EPG URL (epg.pw)
/// 3. Fetches and parses the full XMLTV guide
/// 4. Returns all schedules and a display-name map for channel matching
///
/// The country code is derived from the channel ID suffix (e.g., `TF1.fr` → `FR`)
/// and used as the default timezone when XMLTV timestamps lack explicit offsets.
pub async fn fetch_channel_epg(
    client: &reqwest::Client,
    index: &IptvOrgIndex,
    iptv_org_id: &str,
) -> Result<FetchedEpg, IptvOrgError> {
    let url = index
        .get_guide_url(iptv_org_id)
        .ok_or_else(|| IptvOrgError::NoGuide(iptv_org_id.to_string()))?;

    let country = iptv_org_id.rsplit('.').next().unwrap_or("us");
    info!("Fetching EPG for {iptv_org_id} from {url} (country={country})");

    fetch_and_parse_guide(client, &url, country).await
}

/// Fetch a single gzipped XMLTV guide, decompress, and parse all channels.
///
/// `country_code` is used to infer a default timezone offset when XMLTV
/// timestamps do not include an explicit offset.
async fn fetch_and_parse_guide(
    client: &reqwest::Client,
    url: &str,
    country_code: &str,
) -> Result<FetchedEpg, IptvOrgError> {
    let response = client
        .get(url)
        .timeout(GUIDE_TIMEOUT)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(IptvOrgError::Http(
            response.error_for_status().unwrap_err(),
        ));
    }

    let bytes = response.bytes().await?;

    if bytes.len() > MAX_GUIDE_SIZE {
        warn!("Guide {url} exceeds {MAX_GUIDE_SIZE} bytes, skipping");
        return Ok(FetchedEpg {
            schedules: HashMap::new(),
            display_names: HashMap::new(),
        });
    }

    // Try gzip decompression first, fall back to plain text.
    let xml_str = match decompress_gzip(&bytes) {
        Some(decompressed) => String::from_utf8(decompressed).unwrap_or_default(),
        None => String::from_utf8(bytes.to_vec()).unwrap_or_default(),
    };

    if xml_str.is_empty() {
        return Ok(FetchedEpg {
            schedules: HashMap::new(),
            display_names: HashMap::new(),
        });
    }

    // Parse all channels (empty filter = accept all).
    let default_offset = epg_parser::country_utc_offset(country_code);
    let parsed = epg_parser::parse_xmltv(&xml_str, &[], default_offset)?;
    Ok(FetchedEpg {
        schedules: parsed.schedules,
        display_names: parsed.display_names,
    })
}

/// Attempt to decompress gzip data. Returns `None` if the data is not gzipped.
fn decompress_gzip(data: &[u8]) -> Option<Vec<u8>> {
    use std::io::Read;

    // Check gzip magic bytes.
    if data.len() < 2 || data[0] != 0x1f || data[1] != 0x8b {
        return None;
    }

    let mut decoder = flate2::read::GzDecoder::new(data);
    let mut decompressed = Vec::new();
    decoder.read_to_end(&mut decompressed).ok()?;
    Some(decompressed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_index() -> IptvOrgIndex {
        let mut index = IptvOrgIndex::new();
        index.update(
            vec![
                IptvOrgChannel {
                    id: "TF1.fr".to_string(),
                    name: "TF1".to_string(),
                    alt_names: vec!["Télévision française 1".to_string()],
                    country: "FR".to_string(),
                    categories: vec![],
                },
                IptvOrgChannel {
                    id: "CNN.us".to_string(),
                    name: "CNN".to_string(),
                    alt_names: vec![],
                    country: "US".to_string(),
                    categories: vec![],
                },
            ],
            vec![
                IptvOrgGuide {
                    channel: Some("TF1.fr".to_string()),
                    site: "canalplus.com".to_string(),
                    lang: "fr".to_string(),
                },
                IptvOrgGuide {
                    channel: Some("CNN.us".to_string()),
                    site: "directv.com".to_string(),
                    lang: "en".to_string(),
                },
            ],
        );
        index
    }

    #[test]
    fn index_starts_stale() {
        let index = IptvOrgIndex::new();
        assert!(index.is_stale());
    }

    #[test]
    fn index_fresh_after_update() {
        let index = make_index();
        assert!(!index.is_stale());
    }

    #[test]
    fn find_by_tvg_id() {
        let index = make_index();
        assert_eq!(
            index.find_iptv_org_id(Some("TF1.fr"), "Whatever"),
            Some("TF1.fr".to_string())
        );
    }

    #[test]
    fn find_by_name() {
        let index = make_index();
        assert_eq!(
            index.find_iptv_org_id(None, "CNN"),
            Some("CNN.us".to_string())
        );
    }

    #[test]
    fn find_by_alt_name() {
        let index = make_index();
        assert_eq!(
            index.find_iptv_org_id(None, "Télévision française 1"),
            Some("TF1.fr".to_string())
        );
    }

    #[test]
    fn find_case_insensitive() {
        let index = make_index();
        assert_eq!(
            index.find_iptv_org_id(None, "cnn"),
            Some("CNN.us".to_string())
        );
    }

    #[test]
    fn find_unknown_returns_none() {
        let index = make_index();
        assert!(index.find_iptv_org_id(None, "Unknown Channel").is_none());
    }

    #[test]
    fn guide_url_for_tf1() {
        let index = make_index();
        assert_eq!(
            index.get_guide_url("TF1.fr").unwrap(),
            "https://iptv-epg.org/files/epg-fr.xml"
        );
    }

    #[test]
    fn guide_url_for_cnn() {
        let index = make_index();
        assert_eq!(
            index.get_guide_url("CNN.us").unwrap(),
            "https://iptv-epg.org/files/epg-us.xml"
        );
    }

    #[test]
    fn guide_url_uses_country_suffix() {
        let index = make_index();
        // Any iptv-org ID produces a URL based on the country suffix.
        assert_eq!(
            index.get_guide_url("Unknown.xx").unwrap(),
            "https://iptv-epg.org/files/epg-xx.xml"
        );
    }

    #[test]
    fn decompress_gzip_rejects_non_gzip() {
        let plain = b"hello world";
        assert!(decompress_gzip(plain).is_none());
    }
}
