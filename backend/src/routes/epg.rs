use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde_json::{json, Value};
use tracing::{debug, info, warn};

use crate::models::AppState;
use crate::services::iptv_org;

/// Returns today's EPG schedule for a specific channel.
///
/// Fetches EPG data on-demand from iptv-org if not cached.
/// The `channel_id` can be a tvg_id (e.g., "TF1.fr") or an M3U channel name.
///
/// # Route
///
/// `GET /api/epg/:channel_id`
pub async fn get_schedule(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    debug!("EPG schedule request for channel: {channel_id}");

    // Check cache first.
    {
        let cache = state.epg_cache.read().await;
        if let Some(schedule) = cache.get_schedule(&channel_id) {
            debug!("EPG cache hit for {channel_id}");
            return Ok(Json(serde_json::to_value(schedule).unwrap_or_default()));
        }
    }

    // Not cached — fetch on-demand.
    if state.config.epg_enabled {
        info!("EPG cache miss for {channel_id}, fetching on-demand");
        if let Err(e) = fetch_epg_for_channel(&state, &channel_id).await {
            warn!("EPG fetch failed for {channel_id}: {e}");
        }

        // Re-check cache after fetch.
        let cache = state.epg_cache.read().await;
        if let Some(schedule) = cache.get_schedule(&channel_id) {
            return Ok(Json(serde_json::to_value(schedule).unwrap_or_default()));
        }
    }

    Err((
        StatusCode::NOT_FOUND,
        Json(json!({"error": "No EPG data found for channel", "channel_id": channel_id})),
    ))
}

/// Returns the currently airing and next programme for a channel.
///
/// Fetches EPG data on-demand from iptv-org if not cached.
///
/// # Route
///
/// `GET /api/epg/:channel_id/now`
pub async fn get_now_next(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let now = Utc::now();

    // Check cache first.
    {
        let cache = state.epg_cache.read().await;
        if let Some(now_next) = cache.get_now_next(&channel_id, now) {
            return Ok(Json(serde_json::to_value(&now_next).unwrap_or_default()));
        }
    }

    // Not cached — fetch on-demand.
    if state.config.epg_enabled {
        if let Err(e) = fetch_epg_for_channel(&state, &channel_id).await {
            warn!("EPG fetch failed for {channel_id}: {e}");
        }

        // Re-check cache after fetch.
        let cache = state.epg_cache.read().await;
        if let Some(now_next) = cache.get_now_next(&channel_id, now) {
            return Ok(Json(serde_json::to_value(&now_next).unwrap_or_default()));
        }
    }

    Err((
        StatusCode::NOT_FOUND,
        Json(json!({"error": "No EPG data found for channel", "channel_id": channel_id})),
    ))
}

/// Fetch EPG data for a channel by resolving it through the iptv-org index.
///
/// 1. Ensures the iptv-org index is loaded (lazy init)
/// 2. Finds the channel's iptv-org ID (by tvg_id or name)
/// 3. Fetches the XMLTV guide and caches all programmes from it
async fn fetch_epg_for_channel(
    state: &Arc<AppState>,
    channel_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = reqwest::Client::new();

    // Ensure the iptv-org index is loaded.
    {
        let needs_refresh = state.iptv_org_index.read().await.is_stale();
        if needs_refresh {
            let mut index = state.iptv_org_index.write().await;
            // Double-check after acquiring write lock.
            if index.is_stale() {
                iptv_org::refresh_index(&client, &mut index).await?;
            }
        }
    }

    // Find the channel in our M3U playlist to get tvg_id and name.
    let (tvg_id, name) = {
        let playlist = state.playlist.read().await;
        let channel = playlist.channels.iter().find(|ch| {
            ch.tvg_id.as_deref() == Some(channel_id)
                || ch.id == channel_id
                || ch.name == channel_id
        });
        match channel {
            Some(ch) => (ch.tvg_id.clone(), ch.name.clone()),
            None => (Some(channel_id.to_string()), channel_id.to_string()),
        }
    };

    // Resolve to iptv-org channel ID.
    let iptv_org_id = {
        let index = state.iptv_org_index.read().await;
        index.find_iptv_org_id(tvg_id.as_deref(), &name)
    };

    let iptv_org_id = match iptv_org_id {
        Some(id) => id,
        None => {
            info!("No iptv-org match for channel {channel_id} (name={name})");
            return Ok(());
        }
    };

    // Collect iptv-org channel names for display-name matching later.
    let iptv_org_names = {
        let index = state.iptv_org_index.read().await;
        index.get_channel_names(&iptv_org_id)
    };

    info!(
        "Resolved {channel_id} -> iptv_org_id={iptv_org_id}, m3u_name={name}, iptv_org_names={iptv_org_names:?}"
    );

    // Fetch the guide XML and parse it.
    let fetched = {
        let index = state.iptv_org_index.read().await;
        iptv_org::fetch_channel_epg(&client, &index, &iptv_org_id).await?
    };

    let prog_count: usize = fetched.schedules.values().map(|s| s.programs.len()).sum();
    info!(
        "Fetched {prog_count} programmes across {} XMLTV channels (requested {channel_id})",
        fetched.schedules.len()
    );

    // Merge all schedules into the EPG cache.
    let mut cache = state.epg_cache.write().await;
    for (id, schedule) in &fetched.schedules {
        cache.schedules.insert(id.clone(), schedule.clone());
    }

    // Ensure the original channel_id also maps to a schedule.
    // Try multiple matching strategies in order of specificity.
    if !cache.schedules.contains_key(channel_id) {
        let xmltv_id = if fetched.schedules.contains_key(&iptv_org_id) {
            // 1. Direct iptv-org ID match in XMLTV data.
            info!("Match strategy: direct iptv-org ID '{iptv_org_id}' found in XMLTV");
            Some(iptv_org_id.clone())
        } else {
            // 2. Try display-name matching with multiple name candidates.
            let mut candidates = vec![name.clone()];
            candidates.extend(iptv_org_names.iter().cloned());
            // Also try the channel_id itself and without the country suffix.
            candidates.push(channel_id.to_string());
            if let Some(prefix) = channel_id.rsplit('.').nth(1) {
                candidates.push(prefix.to_string());
            }

            let mut resolved = None;
            for candidate in &candidates {
                let key = candidate.to_lowercase();
                if let Some(xmltv_ch_id) = fetched.display_names.get(&key) {
                    info!(
                        "Match strategy: display-name '{candidate}' -> XMLTV channel '{xmltv_ch_id}'"
                    );
                    resolved = Some(xmltv_ch_id.clone());
                    break;
                }
            }

            if resolved.is_none() {
                warn!(
                    "No XMLTV match for {channel_id}. Tried candidates: {candidates:?}. Available display names (sample): {:?}",
                    fetched.display_names.keys().take(20).collect::<Vec<_>>()
                );
            }

            resolved
        };

        if let Some(ref resolved_id) = xmltv_id {
            if let Some(schedule) = cache.schedules.get(resolved_id).cloned() {
                info!(
                    "Aliasing EPG cache: {channel_id} -> {resolved_id} ({} programmes)",
                    schedule.programs.len()
                );
                cache.schedules.insert(channel_id.to_string(), schedule);
            }
        }
    }

    cache.last_updated = Some(std::time::Instant::now());

    Ok(())
}
