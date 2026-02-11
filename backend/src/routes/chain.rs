use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::warn;

use crate::models::{AppState, Channel};

/// Query parameters for the on-chain playlist lookup endpoint.
#[derive(Debug, Deserialize)]
pub struct ChainPlaylistQuery {
    /// Substrate address whose `system.remark_with_event` extrinsics to scan.
    pub address: Option<String>,
}

/// Look up a playlist published on-chain via `system.remark_with_event`.
///
/// Queries the Subscan API for recent extrinsics from the given `address`,
/// finds the newest remark prefixed with `IPTV:`, decodes it, and returns
/// the playlist as JSON.  Returns `{"found": false}` when no matching
/// remark is found or when the Subscan request fails.
pub async fn get_chain_playlist(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ChainPlaylistQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let address = params.address.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "Missing required query parameter: address"})),
        )
    })?;

    match fetch_chain_playlist(&state.config.subscan_api_url, &address).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            warn!("Subscan lookup failed for {address}: {e}");
            Ok(Json(json!({"found": false})))
        }
    }
}

/// Internal helper that calls the Subscan API and parses the response.
async fn fetch_chain_playlist(
    subscan_api_url: &str,
    address: &str,
) -> Result<Value, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let url = format!("{subscan_api_url}/api/v2/scan/extrinsics");

    let body = json!({
        "module": "system",
        "call": "remark_with_event",
        "address": address,
        "page": 0,
        "row": 25
    });

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await?
        .json::<Value>()
        .await?;

    let extrinsics = resp
        .get("data")
        .and_then(|d| d.get("extrinsics"))
        .and_then(|e| e.as_array());

    let extrinsics = match extrinsics {
        Some(arr) => arr,
        None => return Ok(json!({"found": false})),
    };

    // Walk extrinsics newest-first looking for an IPTV: remark.
    for ext in extrinsics {
        let block_num = ext.get("block_num").and_then(|v| v.as_u64());
        let extrinsic_hash = ext
            .get("extrinsic_hash")
            .and_then(|v| v.as_str())
            .unwrap_or_default();

        // `params` is a JSON-encoded string containing an array of param objects.
        let params_str = match ext.get("params").and_then(|p| p.as_str()) {
            Some(s) => s,
            None => continue,
        };

        let params_array: Vec<Value> = match serde_json::from_str(params_str) {
            Ok(arr) => arr,
            Err(_) => continue,
        };

        for param in &params_array {
            if param.get("name").and_then(|n| n.as_str()) != Some("remark") {
                continue;
            }

            let hex_value = match param.get("value").and_then(|v| v.as_str()) {
                Some(h) => h,
                None => continue,
            };

            let decoded = decode_hex_to_string(hex_value);
            let decoded = match decoded {
                Some(s) => s,
                None => continue,
            };

            if !decoded.starts_with("IPTV:") {
                continue;
            }

            let json_payload = &decoded["IPTV:".len()..];

            let playlist_data: Value = match serde_json::from_str(json_payload) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let channels = parse_chain_channels(&playlist_data);
            // On-chain compact format uses "n" for name
            let playlist_name = playlist_data
                .get("n")
                .and_then(|n| n.as_str())
                .unwrap_or("On-Chain Playlist");

            return Ok(json!({
                "found": true,
                "playlist": {
                    "name": playlist_name,
                    "channels": channels,
                    "last_checked": null,
                    "source": "on-chain"
                },
                "block_number": block_num,
                "extrinsic_hash": extrinsic_hash
            }));
        }
    }

    Ok(json!({"found": false}))
}

/// Decode a hex string (with or without `0x` prefix) into a UTF-8 string.
fn decode_hex_to_string(hex: &str) -> Option<String> {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    let bytes: Vec<u8> = (0..hex.len())
        .step_by(2)
        .filter_map(|i| hex.get(i..i + 2).and_then(|b| u8::from_str_radix(b, 16).ok()))
        .collect();
    String::from_utf8(bytes).ok()
}

/// Build a list of [`Channel`] structs from the on-chain compact JSON payload.
///
/// The compact format uses short keys: `c` for the channel array, and within
/// each channel: `n` (name), `s` (stream_url), `g` (group), `l` (logo_url).
fn parse_chain_channels(data: &Value) -> Vec<Channel> {
    let channels = match data.get("c").and_then(|c| c.as_array()) {
        Some(arr) => arr,
        None => return Vec::new(),
    };

    channels
        .iter()
        .enumerate()
        .filter_map(|(i, ch)| {
            let name = ch.get("n").and_then(|n| n.as_str())?;
            let stream_url = ch.get("s").and_then(|u| u.as_str())?;

            let group = ch
                .get("g")
                .and_then(|g| g.as_str())
                .unwrap_or("On-Chain");

            let logo_url = ch.get("l").and_then(|l| l.as_str());

            let id = format!("chain-{i}-{}", hash_url(stream_url));

            Some(Channel {
                id,
                name: name.to_string(),
                group: group.to_string(),
                logo_url: logo_url.map(String::from),
                stream_url: stream_url.to_string(),
                is_live: true,
                tvg_id: None,
            })
        })
        .collect()
}

/// Simple hash of a URL to generate a stable channel ID component.
fn hash_url(url: &str) -> u64 {
    let mut hash: u64 = 5381;
    for byte in url.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(u64::from(byte));
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_hex_to_string_with_prefix() {
        let hex = "0x48656c6c6f";
        assert_eq!(decode_hex_to_string(hex), Some("Hello".to_string()));
    }

    #[test]
    fn test_decode_hex_to_string_without_prefix() {
        let hex = "48656c6c6f";
        assert_eq!(decode_hex_to_string(hex), Some("Hello".to_string()));
    }

    #[test]
    fn test_decode_hex_invalid_utf8() {
        // 0xff 0xfe is not valid UTF-8
        let hex = "0xfffe";
        assert_eq!(decode_hex_to_string(hex), None);
    }

    #[test]
    fn test_parse_chain_channels_valid() {
        let data = json!({
            "v": 1,
            "n": "My Playlist",
            "c": [
                {
                    "n": "Channel One",
                    "s": "http://example.com/stream1.m3u8",
                    "g": "News",
                    "l": "http://example.com/logo1.png"
                },
                {
                    "n": "Channel Two",
                    "s": "http://example.com/stream2.m3u8",
                    "g": "Sports",
                    "l": null
                }
            ]
        });

        let channels = parse_chain_channels(&data);
        assert_eq!(channels.len(), 2);

        assert_eq!(channels[0].name, "Channel One");
        assert_eq!(channels[0].stream_url, "http://example.com/stream1.m3u8");
        assert_eq!(channels[0].group, "News");
        assert_eq!(
            channels[0].logo_url.as_deref(),
            Some("http://example.com/logo1.png")
        );

        assert_eq!(channels[1].name, "Channel Two");
        assert_eq!(channels[1].stream_url, "http://example.com/stream2.m3u8");
        assert_eq!(channels[1].group, "Sports");
        assert!(channels[1].logo_url.is_none());
    }

    #[test]
    fn test_parse_chain_channels_missing_channels_key() {
        let data = json!({"n": "Empty"});
        let channels = parse_chain_channels(&data);
        assert!(channels.is_empty());
    }

    #[test]
    fn test_parse_chain_channels_skips_invalid() {
        let data = json!({
            "c": [
                {"n": "Valid", "s": "http://example.com/ok.m3u8"},
                {"n": "No URL"},
                {"s": "http://example.com/no-name.m3u8"}
            ]
        });

        let channels = parse_chain_channels(&data);
        // Only the first has both name and stream_url
        assert_eq!(channels.len(), 1);
        assert_eq!(channels[0].name, "Valid");
    }

    #[test]
    fn test_hash_url_deterministic() {
        let url = "http://example.com/stream.m3u8";
        assert_eq!(hash_url(url), hash_url(url));
    }

    #[test]
    fn test_hash_url_different_for_different_urls() {
        assert_ne!(
            hash_url("http://example.com/a.m3u8"),
            hash_url("http://example.com/b.m3u8")
        );
    }
}
