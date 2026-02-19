use std::collections::HashMap;

use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use quick_xml::events::Event;
use quick_xml::reader::Reader;
use thiserror::Error;

use crate::models::epg::{EpgProgram, EpgSchedule};

/// Maximum allowed XML input size (50 MB) to prevent XML bomb attacks.
const MAX_XML_SIZE: usize = 50 * 1024 * 1024;

/// Map a two-letter country code to its standard UTC offset in seconds.
///
/// Uses winter/standard-time offsets. XMLTV sources that include explicit
/// timezone offsets in their timestamps will override this default.
pub fn country_utc_offset(country_code: &str) -> i32 {
    match country_code.to_uppercase().as_str() {
        // UTC+0
        "GB" | "UK" | "IE" | "IS" | "PT" => 0,
        // CET  UTC+1
        "FR" | "DE" | "IT" | "ES" | "NL" | "BE" | "AT" | "CH" | "PL" | "CZ" | "HU" | "SE"
        | "NO" | "DK" | "HR" | "RS" | "SI" | "SK" | "BA" | "ME" | "MK" | "AL" | "MT" | "LU"
        | "LI" => 3600,
        // EET  UTC+2
        "FI" | "RO" | "BG" | "GR" | "EE" | "LV" | "LT" | "UA" | "MD" | "CY" | "ZA" => 7200,
        // MSK  UTC+3
        "RU" | "TR" | "BY" | "KE" | "TZ" | "SA" | "QA" | "BH" | "KW" | "IQ" => 10800,
        // IST  UTC+5:30
        "IN" | "LK" => 19800,
        // ICT  UTC+7
        "VN" | "TH" | "ID" | "KH" | "LA" => 25200,
        // CST/SGT/MYT/PHT  UTC+8
        "CN" | "HK" | "TW" | "SG" | "MY" | "PH" | "BN" => 28800,
        // JST/KST  UTC+9
        "JP" | "KR" => 32400,
        // AEST  UTC+10
        "AU" => 36000,
        // NZST  UTC+12
        "NZ" => 43200,
        // Americas
        "BR" | "AR" | "UY" => -10800,  // BRT/ART  UTC-3
        "VE" | "CL" | "PY" | "BO" => -14400, // UTC-4
        "US" | "CA" | "CO" | "PE" | "EC" | "PA" => -18000, // EST/COT  UTC-5
        "MX" | "CR" | "SV" | "GT" | "HN" | "NI" => -21600, // CST  UTC-6
        _ => 0,
    }
}

/// Errors that can occur while parsing XMLTV data.
#[derive(Debug, Error)]
pub enum EpgParseError {
    /// The input exceeds the maximum allowed size.
    #[error("XMLTV data exceeds maximum size of {MAX_XML_SIZE} bytes")]
    TooLarge,
    /// XML parsing error from quick-xml.
    #[error("XML parse error: {0}")]
    Xml(#[from] quick_xml::Error),
}

/// Result of parsing an XMLTV file.
#[derive(Debug)]
pub struct ParsedXmltv {
    /// Programme schedules keyed by XMLTV channel ID.
    pub schedules: HashMap<String, EpgSchedule>,
    /// Map from lowercase display name to XMLTV channel ID, extracted from
    /// `<channel><display-name>` elements. Used for fuzzy matching when the
    /// requesting channel ID doesn't match the XMLTV channel ID exactly.
    pub display_names: HashMap<String, String>,
}

/// Parse XMLTV content into schedules and a channel display-name map.
///
/// When `known_channel_ids` is non-empty, only programmes whose `channel`
/// attribute is present in the set are included. When it is empty, **all**
/// programmes are parsed (useful for country-level EPG files).
///
/// `default_utc_offset_secs` is used when a programme timestamp lacks an
/// explicit timezone offset. Pass `0` for UTC, or use [`country_utc_offset`]
/// to infer from the channel's country code.
///
/// The input is validated against [`MAX_XML_SIZE`] before parsing begins.
pub fn parse_xmltv(
    xml: &str,
    known_channel_ids: &[&str],
    default_utc_offset_secs: i32,
) -> Result<ParsedXmltv, EpgParseError> {
    if xml.len() > MAX_XML_SIZE {
        return Err(EpgParseError::TooLarge);
    }

    let known_set: std::collections::HashSet<&str> = known_channel_ids.iter().copied().collect();
    let accept_all = known_set.is_empty();

    let mut schedules: HashMap<String, EpgSchedule> = HashMap::new();
    let mut display_names: HashMap<String, String> = HashMap::new();

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();

    // State for the current <programme> element.
    let mut in_programme = false;
    let mut current_channel_id = String::new();
    let mut current_start: Option<DateTime<Utc>> = None;
    let mut current_stop: Option<DateTime<Utc>> = None;

    // State for nested text elements inside <programme>.
    let mut in_title = false;
    let mut in_desc = false;
    let mut in_category = false;
    let mut current_title = String::new();
    let mut current_desc = String::new();
    let mut current_category = String::new();
    let mut current_icon_url: Option<String> = None;

    // State for <channel> elements (display-name extraction).
    let mut in_channel = false;
    let mut channel_elem_id = String::new();
    let mut in_display_name = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let local_name = e.local_name();
                match local_name.as_ref() {
                    b"channel" => {
                        in_channel = true;
                        channel_elem_id.clear();
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"id" {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    channel_elem_id = val.to_string();
                                }
                            }
                        }
                    }
                    b"display-name" if in_channel => in_display_name = true,
                    b"programme" => {
                        in_programme = true;
                        current_channel_id.clear();
                        current_start = None;
                        current_stop = None;
                        current_title.clear();
                        current_desc.clear();
                        current_category.clear();
                        current_icon_url = None;

                        for attr_result in e.attributes().flatten() {
                            let key = std::str::from_utf8(attr_result.key.as_ref())
                                .unwrap_or_default();
                            let value = std::str::from_utf8(&attr_result.value)
                                .unwrap_or_default();
                            match key {
                                "channel" => current_channel_id = value.to_string(),
                                "start" => {
                                    current_start =
                                        parse_xmltv_datetime(value, default_utc_offset_secs)
                                }
                                "stop" => {
                                    current_stop =
                                        parse_xmltv_datetime(value, default_utc_offset_secs)
                                }
                                _ => {}
                            }
                        }
                    }
                    b"title" if in_programme => in_title = true,
                    b"desc" if in_programme => in_desc = true,
                    b"category" if in_programme => in_category = true,
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                let local_name = e.local_name();
                if local_name.as_ref() == b"icon" && in_programme {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"src" {
                            if let Ok(val) = std::str::from_utf8(&attr.value) {
                                if !val.is_empty() {
                                    current_icon_url = Some(val.to_string());
                                }
                            }
                        }
                    }
                }
            }
            Ok(Event::Text(ref e)) => {
                if in_display_name {
                    if let Ok(text) = e.unescape() {
                        let name = text.trim().to_string();
                        if !name.is_empty() && !channel_elem_id.is_empty() {
                            display_names
                                .entry(name.to_lowercase())
                                .or_insert_with(|| channel_elem_id.clone());
                        }
                    }
                } else if in_title {
                    if let Ok(text) = e.unescape() {
                        current_title.push_str(&text);
                    }
                } else if in_desc {
                    if let Ok(text) = e.unescape() {
                        current_desc.push_str(&text);
                    }
                } else if in_category {
                    if let Ok(text) = e.unescape() {
                        current_category.push_str(&text);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                let local_name = e.local_name();
                match local_name.as_ref() {
                    b"channel" => in_channel = false,
                    b"display-name" => in_display_name = false,
                    b"programme" => {
                        in_programme = false;

                        // Include the programme if it has a title and either
                        // we're accepting all channels or the channel is in
                        // the known set.
                        let dominated = accept_all
                            || known_set.contains(current_channel_id.as_str());

                        if !current_title.is_empty() && dominated {
                            if let (Some(start), Some(end)) = (current_start, current_stop) {
                                let id = format!(
                                    "{}-{}",
                                    current_channel_id,
                                    start.timestamp()
                                );

                                let program = EpgProgram {
                                    id,
                                    channel_id: current_channel_id.clone(),
                                    title: current_title.clone(),
                                    description: if current_desc.is_empty() {
                                        None
                                    } else {
                                        Some(current_desc.clone())
                                    },
                                    start,
                                    end,
                                    category: if current_category.is_empty() {
                                        None
                                    } else {
                                        Some(current_category.clone())
                                    },
                                    icon_url: current_icon_url.clone(),
                                };

                                schedules
                                    .entry(current_channel_id.clone())
                                    .or_insert_with(|| EpgSchedule {
                                        channel_id: current_channel_id.clone(),
                                        programs: Vec::new(),
                                    })
                                    .programs
                                    .push(program);
                            }
                        }
                    }
                    b"title" => in_title = false,
                    b"desc" => in_desc = false,
                    b"category" => in_category = false,
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(EpgParseError::Xml(e)),
            _ => {}
        }
        buf.clear();
    }

    // Sort each schedule's programmes by start time.
    for schedule in schedules.values_mut() {
        schedule.programs.sort_by_key(|p| p.start);
    }

    Ok(ParsedXmltv {
        schedules,
        display_names,
    })
}

/// Parse an XMLTV datetime string into a UTC [`DateTime`].
///
/// XMLTV dates follow the format `YYYYMMDDHHmmss +HHMM` (the timezone
/// offset may be absent). When the offset is missing,
/// `default_offset_secs` is used instead of assuming UTC.
///
/// Examples:
///
/// - `20260211140000 +0000`  → 14:00 UTC
/// - `20260211150000 +0100`  → 14:00 UTC (15:00 CET)
/// - `20260211140000`        → interpreted using `default_offset_secs`
fn parse_xmltv_datetime(s: &str, default_offset_secs: i32) -> Option<DateTime<Utc>> {
    let s = s.trim();

    // Split into datetime part and optional timezone offset.
    let (dt_part, tz_offset_secs) = if s.len() > 14 {
        let dt = &s[..14];
        let tz_str = s[14..].trim();
        let offset = parse_tz_offset(tz_str).unwrap_or(default_offset_secs);
        (dt, offset)
    } else {
        (s, default_offset_secs)
    };

    let naive = NaiveDateTime::parse_from_str(dt_part, "%Y%m%d%H%M%S").ok()?;

    // Apply the timezone offset to get UTC.
    let offset = chrono::FixedOffset::east_opt(tz_offset_secs)?;
    let local_dt = offset.from_local_datetime(&naive).single()?;
    Some(local_dt.with_timezone(&Utc))
}

/// Parse a timezone offset string like `+0100` or `-0530` into total seconds.
fn parse_tz_offset(s: &str) -> Option<i32> {
    let s = s.trim();
    if s.is_empty() {
        return Some(0);
    }

    let (sign, rest) = match s.as_bytes().first()? {
        b'+' => (1i32, &s[1..]),
        b'-' => (-1i32, &s[1..]),
        _ => (1i32, s),
    };

    if rest.len() < 4 {
        return None;
    }

    let hours: i32 = rest[..2].parse().ok()?;
    let minutes: i32 = rest[2..4].parse().ok()?;
    Some(sign * (hours * 3600 + minutes * 60))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn parse_basic_xmltv() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="CNN.us">
    <display-name>CNN</display-name>
  </channel>
  <programme start="20260211100000 +0000" stop="20260211110000 +0000" channel="CNN.us">
    <title>Morning News</title>
    <desc>The latest news from around the world.</desc>
    <category>News</category>
    <icon src="https://example.com/morning.png" />
  </programme>
  <programme start="20260211110000 +0000" stop="20260211120000 +0000" channel="CNN.us">
    <title>Noon Report</title>
  </programme>
</tv>"#;

        let parsed = parse_xmltv(xml, &["CNN.us"], 0).unwrap();
        assert_eq!(parsed.schedules.len(), 1);

        let schedule = parsed.schedules.get("CNN.us").unwrap();
        assert_eq!(schedule.programs.len(), 2);
        assert_eq!(schedule.programs[0].title, "Morning News");
        assert_eq!(
            schedule.programs[0].description.as_deref(),
            Some("The latest news from around the world.")
        );
        assert_eq!(schedule.programs[0].category.as_deref(), Some("News"));
        assert_eq!(
            schedule.programs[0].icon_url.as_deref(),
            Some("https://example.com/morning.png")
        );
        assert_eq!(schedule.programs[1].title, "Noon Report");
        assert!(schedule.programs[1].description.is_none());

        // Display name extracted from <channel> element.
        assert_eq!(parsed.display_names.get("cnn"), Some(&"CNN.us".to_string()));
    }

    #[test]
    fn filters_unknown_channels() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20260211100000 +0000" stop="20260211110000 +0000" channel="CNN.us">
    <title>News</title>
  </programme>
  <programme start="20260211100000 +0000" stop="20260211110000 +0000" channel="BBC.uk">
    <title>UK News</title>
  </programme>
</tv>"#;

        let parsed = parse_xmltv(xml, &["BBC.uk"], 0).unwrap();
        assert!(!parsed.schedules.contains_key("CNN.us"));
        assert_eq!(parsed.schedules.get("BBC.uk").unwrap().programs.len(), 1);
    }

    #[test]
    fn empty_filter_accepts_all() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20260211100000 +0000" stop="20260211110000 +0000" channel="CNN.us">
    <title>News</title>
  </programme>
  <programme start="20260211100000 +0000" stop="20260211110000 +0000" channel="BBC.uk">
    <title>UK News</title>
  </programme>
</tv>"#;

        let parsed = parse_xmltv(xml, &[], 0).unwrap();
        assert_eq!(parsed.schedules.len(), 2);
        assert!(parsed.schedules.contains_key("CNN.us"));
        assert!(parsed.schedules.contains_key("BBC.uk"));
    }

    #[test]
    fn rejects_oversized_input() {
        let huge = "x".repeat(MAX_XML_SIZE + 1);
        let err = parse_xmltv(&huge, &[], 0).unwrap_err();
        assert!(matches!(err, EpgParseError::TooLarge));
    }

    #[test]
    fn parse_xmltv_datetime_utc() {
        let dt = parse_xmltv_datetime("20260211140000 +0000", 0).unwrap();
        assert_eq!(dt, Utc.with_ymd_and_hms(2026, 2, 11, 14, 0, 0).unwrap());
    }

    #[test]
    fn parse_xmltv_datetime_with_offset() {
        let dt = parse_xmltv_datetime("20260211150000 +0100", 0).unwrap();
        // +0100 means local 15:00 is UTC 14:00.
        assert_eq!(dt, Utc.with_ymd_and_hms(2026, 2, 11, 14, 0, 0).unwrap());
    }

    #[test]
    fn parse_xmltv_datetime_no_tz_uses_default() {
        // With default=0 (UTC), 14:00 stays 14:00 UTC.
        let dt = parse_xmltv_datetime("20260211140000", 0).unwrap();
        assert_eq!(dt, Utc.with_ymd_and_hms(2026, 2, 11, 14, 0, 0).unwrap());

        // With default=3600 (CET +0100), 14:00 CET = 13:00 UTC.
        let dt = parse_xmltv_datetime("20260211140000", 3600).unwrap();
        assert_eq!(dt, Utc.with_ymd_and_hms(2026, 2, 11, 13, 0, 0).unwrap());
    }

    #[test]
    fn explicit_offset_overrides_default() {
        // Explicit +0100 overrides the default of 0 (UTC).
        let dt = parse_xmltv_datetime("20260211150000 +0100", 0).unwrap();
        assert_eq!(dt, Utc.with_ymd_and_hms(2026, 2, 11, 14, 0, 0).unwrap());

        // Explicit +0100 overrides a different default too.
        let dt = parse_xmltv_datetime("20260211150000 +0100", -18000).unwrap();
        assert_eq!(dt, Utc.with_ymd_and_hms(2026, 2, 11, 14, 0, 0).unwrap());
    }

    #[test]
    fn country_utc_offset_known_countries() {
        assert_eq!(country_utc_offset("FR"), 3600);
        assert_eq!(country_utc_offset("US"), -18000);
        assert_eq!(country_utc_offset("GB"), 0);
        assert_eq!(country_utc_offset("JP"), 32400);
        assert_eq!(country_utc_offset("IN"), 19800);
        // Unknown defaults to 0.
        assert_eq!(country_utc_offset("XX"), 0);
    }

    #[test]
    fn parse_tz_offset_values() {
        assert_eq!(parse_tz_offset("+0000"), Some(0));
        assert_eq!(parse_tz_offset("+0100"), Some(3600));
        assert_eq!(parse_tz_offset("-0530"), Some(-19800));
        assert_eq!(parse_tz_offset(""), Some(0));
    }

    #[test]
    fn parse_with_country_default_offset() {
        // XMLTV times without explicit offsets, parsed with CET default (+0100).
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20260211190000" stop="20260211200000" channel="France2">
    <title>Journal 19h</title>
  </programme>
</tv>"#;

        let cet_offset = country_utc_offset("FR");
        let parsed = parse_xmltv(xml, &["France2"], cet_offset).unwrap();
        let schedule = parsed.schedules.get("France2").unwrap();
        // 19:00 CET = 18:00 UTC.
        assert_eq!(
            schedule.programs[0].start,
            Utc.with_ymd_and_hms(2026, 2, 11, 18, 0, 0).unwrap()
        );
    }

    #[test]
    fn skips_programmes_without_title() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20260211100000 +0000" stop="20260211110000 +0000" channel="CNN.us">
    <desc>No title here</desc>
  </programme>
</tv>"#;

        let parsed = parse_xmltv(xml, &["CNN.us"], 0).unwrap();
        assert!(parsed.schedules.is_empty());
    }

    #[test]
    fn sorts_programmes_by_start_time() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20260211120000 +0000" stop="20260211130000 +0000" channel="CH1">
    <title>Later</title>
  </programme>
  <programme start="20260211100000 +0000" stop="20260211110000 +0000" channel="CH1">
    <title>Earlier</title>
  </programme>
</tv>"#;

        let parsed = parse_xmltv(xml, &["CH1"], 0).unwrap();
        let schedule = parsed.schedules.get("CH1").unwrap();
        assert_eq!(schedule.programs[0].title, "Earlier");
        assert_eq!(schedule.programs[1].title, "Later");
    }
}
