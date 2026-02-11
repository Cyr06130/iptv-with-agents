use std::collections::HashMap;
use std::time::Instant;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// A single programme entry from an XMLTV EPG feed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpgProgram {
    /// Unique identifier for this programme (generated from channel + start time).
    pub id: String,
    /// The XMLTV channel ID this programme belongs to.
    pub channel_id: String,
    /// Programme title.
    pub title: String,
    /// Optional programme description / synopsis.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Programme start time in UTC.
    pub start: DateTime<Utc>,
    /// Programme end time in UTC.
    pub end: DateTime<Utc>,
    /// Optional genre / category.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// Optional programme icon / thumbnail URL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

/// The EPG schedule for a single channel: a sorted list of programmes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpgSchedule {
    /// The XMLTV channel ID.
    pub channel_id: String,
    /// Programmes for this channel, sorted by start time.
    pub programs: Vec<EpgProgram>,
}

/// Response for the "now playing" endpoint: current programme and optional next.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpgNowNext {
    /// The XMLTV channel ID.
    pub channel_id: String,
    /// The currently airing programme, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub now: Option<EpgProgram>,
    /// The next programme after the current one, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next: Option<EpgProgram>,
}

/// In-memory cache for parsed EPG data, populated on-demand per channel.
#[derive(Debug)]
pub struct EpgCache {
    /// Map from XMLTV channel ID to its schedule.
    pub schedules: HashMap<String, EpgSchedule>,
    /// When the cache was last written to.
    pub last_updated: Option<Instant>,
}

impl EpgCache {
    /// Create a new empty cache.
    pub fn new() -> Self {
        Self {
            schedules: HashMap::new(),
            last_updated: None,
        }
    }

    /// Look up today's schedule for a channel.
    pub fn get_schedule(&self, channel_id: &str) -> Option<&EpgSchedule> {
        self.schedules.get(channel_id)
    }

    /// Find the current and next programme for a channel based on `now`.
    pub fn get_now_next(&self, channel_id: &str, now: DateTime<Utc>) -> Option<EpgNowNext> {
        let schedule = self.schedules.get(channel_id)?;
        let mut current = None;
        let mut next = None;

        for (i, prog) in schedule.programs.iter().enumerate() {
            if prog.start <= now && prog.end > now {
                current = Some(prog.clone());
                next = schedule.programs.get(i + 1).cloned();
                break;
            }
            // If we've passed the current time window, check if this is the
            // next upcoming programme.
            if prog.start > now {
                next = Some(prog.clone());
                break;
            }
        }

        Some(EpgNowNext {
            channel_id: channel_id.to_string(),
            now: current,
            next,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn make_program(channel: &str, start_hour: u32, end_hour: u32, title: &str) -> EpgProgram {
        EpgProgram {
            id: format!("{channel}-{start_hour}"),
            channel_id: channel.to_string(),
            title: title.to_string(),
            description: None,
            start: Utc.with_ymd_and_hms(2026, 2, 11, start_hour, 0, 0).unwrap(),
            end: Utc.with_ymd_and_hms(2026, 2, 11, end_hour, 0, 0).unwrap(),
            category: None,
            icon_url: None,
        }
    }

    #[test]
    fn cache_starts_empty() {
        let cache = EpgCache::new();
        assert!(cache.schedules.is_empty());
        assert!(cache.last_updated.is_none());
    }

    #[test]
    fn get_now_next_finds_current_program() {
        let mut cache = EpgCache::new();
        cache.schedules.insert(
            "CNN.us".to_string(),
            EpgSchedule {
                channel_id: "CNN.us".to_string(),
                programs: vec![
                    make_program("CNN.us", 10, 11, "Morning News"),
                    make_program("CNN.us", 11, 12, "Noon Report"),
                    make_program("CNN.us", 12, 13, "Afternoon Show"),
                ],
            },
        );

        let now = Utc.with_ymd_and_hms(2026, 2, 11, 11, 30, 0).unwrap();
        let result = cache.get_now_next("CNN.us", now).unwrap();
        assert_eq!(result.now.as_ref().unwrap().title, "Noon Report");
        assert_eq!(result.next.as_ref().unwrap().title, "Afternoon Show");
    }

    #[test]
    fn get_now_next_no_current_returns_next() {
        let mut cache = EpgCache::new();
        cache.schedules.insert(
            "BBC.uk".to_string(),
            EpgSchedule {
                channel_id: "BBC.uk".to_string(),
                programs: vec![make_program("BBC.uk", 14, 15, "Afternoon News")],
            },
        );

        let now = Utc.with_ymd_and_hms(2026, 2, 11, 13, 0, 0).unwrap();
        let result = cache.get_now_next("BBC.uk", now).unwrap();
        assert!(result.now.is_none());
        assert_eq!(result.next.as_ref().unwrap().title, "Afternoon News");
    }

    #[test]
    fn get_now_next_unknown_channel() {
        let cache = EpgCache::new();
        let now = Utc::now();
        assert!(cache.get_now_next("nonexistent", now).is_none());
    }
}
