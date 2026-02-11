use std::sync::Arc;

use axum::{
    extract::{Multipart, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};

use crate::models::AppState;
use crate::services::m3u_parser;

/// Returns the full playlist as a JSON array of channels.
pub async fn get_playlist(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let playlist = state.playlist.read().await;
    Json(serde_json::to_value(&*playlist).unwrap_or_default())
}

/// Accepts an M3U file upload and replaces the current in-memory playlist.
///
/// The request must be a `multipart/form-data` with a field named `file`
/// containing valid M3U content.
pub async fn upload_playlist(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid multipart: {e}")))?
    {
        if field.name() == Some("file") {
            let bytes = field
                .bytes()
                .await
                .map_err(|e| (StatusCode::BAD_REQUEST, format!("Failed to read file: {e}")))?;

            let content = String::from_utf8(bytes.to_vec())
                .map_err(|_| (StatusCode::BAD_REQUEST, "File is not valid UTF-8".to_string()))?;

            let channels = m3u_parser::parse_m3u(&content);
            let count = channels.len();

            {
                let mut playlist = state.playlist.write().await;
                playlist.channels = channels;
                playlist.source = "upload".to_string();
            }

            // Trigger an immediate liveness check for the new playlist.
            state.check_now.notify_one();

            return Ok(Json(serde_json::json!({
                "status": "ok",
                "channels_loaded": count
            })));
        }
    }

    Err((StatusCode::BAD_REQUEST, "Missing 'file' field".to_string()))
}

/// Replaces the in-memory playlist with the provided JSON payload.
///
/// Accepts a full `Playlist` object and overwrites the current state.
/// Triggers an immediate liveness check after the update.
pub async fn update_playlist(
    State(state): State<Arc<AppState>>,
    Json(updated): Json<crate::models::Playlist>,
) -> impl IntoResponse {
    let count = updated.channels.len();

    {
        let mut playlist = state.playlist.write().await;
        *playlist = updated;
    }

    state.check_now.notify_one();

    Json(serde_json::json!({
        "status": "ok",
        "channels_count": count
    }))
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
