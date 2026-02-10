use super::channel::Channel;
use serde::{Deserialize, Serialize};

/// A collection of IPTV channels from a single M3U source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    /// Human-readable name for this playlist.
    pub name: String,
    /// All channels parsed from the M3U source.
    pub channels: Vec<Channel>,
    /// ISO-8601 timestamp of the last channel liveness check.
    pub last_checked: Option<String>,
    /// The original M3U source URL.
    pub source: String,
}
