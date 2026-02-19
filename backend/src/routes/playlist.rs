use std::collections::HashSet;
use std::sync::Arc;

use axum::{
    extract::{Multipart, Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;

use crate::models::AppState;
use crate::services::m3u_parser;

/// Query parameters for the playlist upload endpoint.
#[derive(Debug, Deserialize)]
pub struct UploadQuery {
    /// Upload mode: "append" to add new channels, "replace" to overwrite (default).
    pub mode: Option<String>,
}

/// Returns the full playlist as a JSON array of channels.
pub async fn get_playlist(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let playlist = state.playlist.read().await;
    Json(serde_json::to_value(&*playlist).unwrap_or_default())
}

/// Accepts an M3U file upload and updates the current in-memory playlist.
///
/// The request must be a `multipart/form-data` with a field named `file`
/// containing valid M3U content. An optional `mode` query parameter controls
/// the upload behavior:
/// - `"replace"` (default): replaces the entire playlist with the uploaded channels.
/// - `"append"`: adds new channels from the upload, skipping any whose
///   `stream_url` already exists in the current playlist.
pub async fn upload_playlist(
    State(state): State<Arc<AppState>>,
    Query(query): Query<UploadQuery>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let append_mode = query.mode.as_deref() == Some("append");

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

            let new_channels = m3u_parser::parse_m3u(&content);
            let new_count = new_channels.len();

            let total_channels = {
                let mut playlist = state.playlist.write().await;

                if append_mode {
                    let existing_urls: HashSet<&str> = playlist
                        .channels
                        .iter()
                        .map(|ch| ch.stream_url.as_str())
                        .collect();

                    let unique_new: Vec<_> = new_channels
                        .into_iter()
                        .filter(|ch| !existing_urls.contains(ch.stream_url.as_str()))
                        .collect();

                    let appended = unique_new.len();
                    playlist.channels.extend(unique_new);
                    playlist.source = "upload".to_string();

                    let total = playlist.channels.len();

                    // Trigger an immediate liveness check.
                    state.check_now.notify_one();

                    return Ok(Json(serde_json::json!({
                        "status": "ok",
                        "channels_loaded": appended,
                        "total_channels": total
                    })));
                }

                playlist.channels = new_channels;
                playlist.source = "upload".to_string();
                playlist.channels.len()
            };

            // Trigger an immediate liveness check for the new playlist.
            state.check_now.notify_one();

            return Ok(Json(serde_json::json!({
                "status": "ok",
                "channels_loaded": new_count,
                "total_channels": total_channels
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
        let tvg_id_attr = ch
            .tvg_id
            .as_deref()
            .map(|id| format!(" tvg-id=\"{id}\""))
            .unwrap_or_default();

        let logo_attr = ch
            .logo_url
            .as_deref()
            .map(|url| format!(" tvg-logo=\"{url}\""))
            .unwrap_or_default();

        m3u.push_str(&format!(
            "#EXTINF:-1{} tvg-name=\"{}\" group-title=\"{}\"{},{}\n{}\n",
            tvg_id_attr, ch.name, ch.group, logo_attr, ch.name, ch.stream_url
        ));
    }

    Ok(([(header::CONTENT_TYPE, "audio/x-mpegurl")], m3u))
}
