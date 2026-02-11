pub mod channel;
pub mod playlist;

use tokio::sync::{Notify, RwLock};

pub use channel::Channel;
pub use playlist::Playlist;

use crate::config::Config;

/// Shared application state holding the current playlist data and configuration.
#[derive(Debug)]
pub struct AppState {
    /// The current playlist protected by an async read-write lock.
    pub playlist: RwLock<Playlist>,
    /// Application configuration (Subscan URL, etc.).
    pub config: Config,
    /// Signals the background checker to run immediately.
    pub check_now: Notify,
}
