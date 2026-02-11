pub mod channel;
pub mod epg;
pub mod playlist;

use tokio::sync::{Notify, RwLock};

pub use channel::Channel;
pub use epg::EpgCache;
pub use playlist::Playlist;

use crate::config::Config;
use crate::services::iptv_org::IptvOrgIndex;

/// Shared application state holding the current playlist data and configuration.
#[derive(Debug)]
pub struct AppState {
    /// The current playlist protected by an async read-write lock.
    pub playlist: RwLock<Playlist>,
    /// Application configuration (Subscan URL, etc.).
    pub config: Config,
    /// Signals the background checker to run immediately.
    pub check_now: Notify,
    /// Cached EPG data, refreshed on-demand per channel.
    pub epg_cache: RwLock<EpgCache>,
    /// Cached iptv-org channel/guide index, refreshed lazily.
    pub iptv_org_index: RwLock<IptvOrgIndex>,
}
