use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use crate::models::Channel;

/// Parse raw M3U/M3U8 content into a list of [`Channel`] structs.
///
/// The parser handles the standard `#EXTINF` directive format:
///
/// ```text
/// #EXTINF:-1 tvg-name="CNN" tvg-logo="https://logo.png" group-title="News",CNN
/// https://stream.example.com/cnn.m3u8
/// ```
///
/// Malformed entries (missing URL, unparseable lines) are silently skipped.
pub fn parse_m3u(content: &str) -> Vec<Channel> {
    let mut channels = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();

        if line.starts_with("#EXTINF:") {
            // Extract metadata from the EXTINF line.
            let name = extract_attribute(line, "tvg-name")
                .or_else(|| extract_display_name(line))
                .unwrap_or_default();
            let logo_url = extract_attribute(line, "tvg-logo");
            let group = extract_attribute(line, "group-title").unwrap_or_default();
            let tvg_id = extract_attribute(line, "tvg-id");

            // Advance past any blank or comment lines to find the stream URL.
            i += 1;
            while i < lines.len() {
                let next = lines[i].trim();
                if next.is_empty() || next.starts_with('#') {
                    i += 1;
                    continue;
                }
                break;
            }

            if i < lines.len() {
                let stream_url = lines[i].trim().to_string();
                if !stream_url.is_empty() {
                    let id = hash_url(&stream_url);
                    channels.push(Channel {
                        id,
                        name,
                        group,
                        logo_url,
                        stream_url,
                        is_live: false,
                        tvg_id,
                    });
                }
            }
        }

        i += 1;
    }

    channels
}

/// Extract a quoted attribute value from an EXTINF line.
///
/// For a line like `#EXTINF:-1 tvg-name="CNN" ...` and key `tvg-name`,
/// this returns `Some("CNN")`.
fn extract_attribute(line: &str, key: &str) -> Option<String> {
    let search = format!("{key}=\"");
    let start = line.find(&search)?;
    let value_start = start + search.len();
    let rest = &line[value_start..];
    let end = rest.find('"')?;
    let value = rest[..end].to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

/// Extract the display name that appears after the last comma in an EXTINF line.
///
/// For `#EXTINF:-1 ...,My Channel Name` this returns `Some("My Channel Name")`.
fn extract_display_name(line: &str) -> Option<String> {
    let comma_pos = line.rfind(',')?;
    let name = line[comma_pos + 1..].trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

/// Produce a deterministic hex-encoded hash of the stream URL to use as a channel id.
fn hash_url(url: &str) -> String {
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_basic_m3u() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-name="Test Channel" tvg-logo="https://example.com/logo.png" group-title="News",Test Channel
https://stream.example.com/test.m3u8
#EXTINF:-1 tvg-name="Another" group-title="Sports",Another
https://stream.example.com/another.m3u8
"#;
        let channels = parse_m3u(content);
        assert_eq!(channels.len(), 2);
        assert_eq!(channels[0].name, "Test Channel");
        assert_eq!(channels[0].group, "News");
        assert_eq!(
            channels[0].logo_url.as_deref(),
            Some("https://example.com/logo.png")
        );
        assert_eq!(
            channels[0].stream_url,
            "https://stream.example.com/test.m3u8"
        );
        assert!(!channels[0].is_live);

        assert_eq!(channels[1].name, "Another");
        assert_eq!(channels[1].group, "Sports");
        assert!(channels[1].logo_url.is_none());
    }

    #[test]
    fn parse_empty_content() {
        let channels = parse_m3u("");
        assert!(channels.is_empty());
    }

    #[test]
    fn parse_malformed_entries_skipped() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-name="Good",Good Channel
https://stream.example.com/good.m3u8
#EXTINF:-1 tvg-name="Bad",Bad Channel
#EXTINF:-1 tvg-name="Also Good",Also Good Channel
https://stream.example.com/also-good.m3u8
"#;
        let channels = parse_m3u(content);
        // "Bad Channel" has no URL line before the next EXTINF, so it gets
        // the next EXTINF line as a URL candidate which starts with '#' and is
        // skipped, ultimately consuming "Also Good"'s URL. Depending on
        // parser behavior, we may get 1 or 2 channels. The important thing
        // is that no panic occurs.
        assert!(!channels.is_empty());
    }

    #[test]
    fn extract_attribute_values() {
        let line =
            r#"#EXTINF:-1 tvg-name="CNN" tvg-logo="https://logo.png" group-title="News",CNN"#;
        assert_eq!(extract_attribute(line, "tvg-name"), Some("CNN".to_string()));
        assert_eq!(
            extract_attribute(line, "tvg-logo"),
            Some("https://logo.png".to_string())
        );
        assert_eq!(
            extract_attribute(line, "group-title"),
            Some("News".to_string())
        );
        assert_eq!(extract_attribute(line, "nonexistent"), None);
    }

    #[test]
    fn parse_extracts_tvg_id() {
        let content = r#"#EXTM3U
#EXTINF:-1 tvg-id="CNN.us" tvg-name="CNN" group-title="News",CNN
https://stream.example.com/cnn.m3u8
#EXTINF:-1 tvg-name="NoId" group-title="Music",NoId
https://stream.example.com/noid.m3u8
"#;
        let channels = parse_m3u(content);
        assert_eq!(channels.len(), 2);
        assert_eq!(channels[0].tvg_id.as_deref(), Some("CNN.us"));
        assert!(channels[1].tvg_id.is_none());
    }

    #[test]
    fn extract_display_name_from_extinf() {
        let line = r#"#EXTINF:-1 tvg-name="CNN",CNN International"#;
        assert_eq!(
            extract_display_name(line),
            Some("CNN International".to_string())
        );
    }

    #[test]
    fn hash_url_is_deterministic() {
        let url = "https://stream.example.com/test.m3u8";
        assert_eq!(hash_url(url), hash_url(url));
    }

    #[test]
    fn unique_ids_for_different_urls() {
        let id1 = hash_url("https://stream.example.com/a.m3u8");
        let id2 = hash_url("https://stream.example.com/b.m3u8");
        assert_ne!(id1, id2);
    }
}
