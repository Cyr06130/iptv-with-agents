pub mod channel;
pub mod playlist;

use tokio::sync::RwLock;

pub use channel::Channel;
pub use playlist::Playlist;

/// Shared application state holding the current playlist data.
#[derive(Debug)]
pub struct AppState {
    /// The current playlist protected by an async read-write lock.
    pub playlist: RwLock<Playlist>,
}
