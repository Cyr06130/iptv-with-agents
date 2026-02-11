use serde::{Deserialize, Serialize};

/// Represents a single IPTV channel from an M3U playlist.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Channel {
    /// Unique identifier derived from the stream URL hash.
    pub id: String,
    /// Display name of the channel.
    pub name: String,
    /// Group or category the channel belongs to.
    pub group: String,
    /// Optional URL to the channel logo image.
    pub logo_url: Option<String>,
    /// The HLS/MPEG-TS stream URL.
    pub stream_url: String,
    /// Whether the channel is currently reachable.
    pub is_live: bool,
    /// Optional EPG identifier used to match against XMLTV programme data.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tvg_id: Option<String>,
}
