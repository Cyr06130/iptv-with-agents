use std::sync::Arc;

use axum::{extract::State, Json};
use serde_json::{json, Value};

use crate::models::AppState;

/// Health-check endpoint.
///
/// Returns `200 OK` with a JSON body containing the service status
/// and the current number of channels in the playlist.
pub async fn health(State(state): State<Arc<AppState>>) -> Json<Value> {
    let playlist = state.playlist.read().await;
    let count = playlist.channels.len();
    Json(json!({
        "status": "ok",
        "channels": count
    }))
}
