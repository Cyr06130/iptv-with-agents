use std::sync::Arc;

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};

use crate::models::AppState;

/// Returns the full playlist as a JSON array of channels.
pub async fn get_playlist(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let playlist = state.playlist.read().await;
    Json(serde_json::to_value(&*playlist).unwrap_or_default())
}

/// Returns the playlist formatted as an M3U file.
///
/// The response uses `Content-Type: audio/x-mpegurl` so media players
/// can consume it directly.
pub async fn get_playlist_m3u(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    let playlist = state.playlist.read().await;

    let mut m3u = String::from("#EXTM3U\n");

    for ch in &playlist.channels {
        let logo_attr = ch
            .logo_url
            .as_deref()
            .map(|url| format!(" tvg-logo=\"{url}\""))
            .unwrap_or_default();

        m3u.push_str(&format!(
            "#EXTINF:-1 tvg-name=\"{}\" group-title=\"{}\"{},{}\n{}\n",
            ch.name, ch.group, logo_attr, ch.name, ch.stream_url
        ));
    }

    Ok(([(header::CONTENT_TYPE, "audio/x-mpegurl")], m3u))
}
