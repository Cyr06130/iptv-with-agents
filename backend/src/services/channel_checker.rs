use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;
use tracing::{info, warn};

use crate::models::AppState;

/// Check whether a single channel stream URL is reachable.
///
/// Sends an HTTP HEAD request to `url` with the given `timeout`.
/// Returns `true` if the server responds with a 2xx or 3xx status code.
pub async fn check_channel(url: &str, timeout: Duration) -> bool {
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .unwrap_or_default();

    match client.head(url).send().await {
        Ok(resp) => {
            let status = resp.status();
            status.is_success() || status.is_redirection()
        }
        Err(_) => false,
    }
}

/// Check all channels for liveness concurrently.
///
/// Uses a semaphore to limit concurrency to 20 simultaneous probe requests.
/// Each channel's `is_live` field is updated in place.
pub async fn check_all_channels(channels: &mut [crate::models::Channel], timeout: Duration) {
    let semaphore = Arc::new(Semaphore::new(20));
    let mut handles = Vec::with_capacity(channels.len());

    for channel in channels.iter() {
        let url = channel.stream_url.clone();
        let sem = Arc::clone(&semaphore);
        let t = timeout;

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await;
            check_channel(&url, t).await
        }));
    }

    for (i, handle) in handles.into_iter().enumerate() {
        match handle.await {
            Ok(is_live) => {
                channels[i].is_live = is_live;
            }
            Err(e) => {
                warn!("Channel check task panicked: {e}");
                channels[i].is_live = false;
            }
        }
    }
}

/// Spawn a background tokio task that periodically re-checks all channels.
///
/// The task runs indefinitely, sleeping for `interval` between each full
/// check cycle. Channel liveness results are written back to the shared
/// [`AppState`] playlist.
pub fn start_background_checker(state: Arc<AppState>, interval: Duration, timeout: Duration) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(interval).await;

            info!("Starting periodic channel liveness check");

            let mut playlist = state.playlist.write().await;
            check_all_channels(&mut playlist.channels, timeout).await;

            let live_count = playlist.channels.iter().filter(|c| c.is_live).count();
            let total = playlist.channels.len();
            playlist.last_checked = Some(chrono_now_iso8601());

            info!("Channel check complete: {live_count}/{total} live");
        }
    });
}

/// Return the current UTC time as an ISO-8601 string.
///
/// Uses a minimal implementation to avoid pulling in a datetime crate.
fn chrono_now_iso8601() -> String {
    // We use the humantime crate-free approach: format SystemTime.
    let now = std::time::SystemTime::now();
    let duration = now
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    let secs = duration.as_secs();

    // Simple UTC timestamp formatting (good enough for logs/display).
    // For production, consider the `time` or `chrono` crate.
    let days = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    // Days since Unix epoch to Y-M-D (simplified leap year calculation).
    let (year, month, day) = days_to_ymd(days);

    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}Z")
}

/// Convert days since Unix epoch (1970-01-01) to (year, month, day).
fn days_to_ymd(mut days: u64) -> (u64, u64, u64) {
    let mut year = 1970u64;

    loop {
        let days_in_year = if is_leap_year(year) { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let month_days: [u64; 12] = if is_leap_year(year) {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };

    let mut month = 1u64;
    for &md in &month_days {
        if days < md {
            break;
        }
        days -= md;
        month += 1;
    }

    (year, month, days + 1)
}

/// Check whether a given year is a leap year.
fn is_leap_year(year: u64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}
