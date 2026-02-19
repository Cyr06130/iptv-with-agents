use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{FixedOffset, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::{debug, info, warn};

use crate::models::AppState;
use crate::services::iptv_org;

/// Query parameters for EPG endpoints.
#[derive(Debug, Deserialize)]
pub struct EpgQuery {
    /// Timezone offset for response times (e.g., `"+0100"`, `"-0500"`).
    /// When provided, all programme start/end times in the response are
    /// converted from UTC to the given offset.
    pub tz: Option<String>,
}

/// Parse a timezone offset string (e.g., `"+0100"`) into a [`FixedOffset`].
fn parse_tz_param(tz: &str) -> Option<FixedOffset> {
    let tz = tz.trim();
    if tz.is_empty() {
        return FixedOffset::east_opt(0);
    }

    let (sign, rest) = match tz.as_bytes().first()? {
        b'+' => (1i32, &tz[1..]),
        b'-' => (-1i32, &tz[1..]),
        _ => (1i32, tz),
    };

    if rest.len() < 4 {
        return None;
    }

    let hours: i32 = rest[..2].parse().ok()?;
    let minutes: i32 = rest[2..4].parse().ok()?;
    let total_secs = sign * (hours * 3600 + minutes * 60);
    FixedOffset::east_opt(total_secs)
}

/// Apply a timezone offset to all programme times in a JSON value.
///
/// Converts `start` and `end` fields from UTC ISO-8601 strings to
/// offset-aware ISO-8601 strings in the requested timezone.
fn apply_tz_to_schedule(value: &mut Value, offset: &FixedOffset) {
    if let Some(programs) = value.get_mut("programs").and_then(|v| v.as_array_mut()) {
        for prog in programs {
            convert_time_field(prog, "start", offset);
            convert_time_field(prog, "end", offset);
        }
    }
}

/// Apply a timezone offset to now/next programme times in a JSON value.
fn apply_tz_to_now_next(value: &mut Value, offset: &FixedOffset) {
    if let Some(now) = value.get_mut("now") {
        convert_time_field(now, "start", offset);
        convert_time_field(now, "end", offset);
    }
    if let Some(next) = value.get_mut("next") {
        convert_time_field(next, "start", offset);
        convert_time_field(next, "end", offset);
    }
}

/// Convert a single time field from UTC to the given offset.
fn convert_time_field(obj: &mut Value, field: &str, offset: &FixedOffset) {
    if let Some(time_str) = obj.get(field).and_then(|v| v.as_str()) {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(time_str) {
            let converted = dt.with_timezone(offset);
            obj[field] = Value::String(converted.to_rfc3339());
        }
    }
}

/// Returns today's EPG schedule for a specific channel.
///
/// Fetches EPG data on-demand from iptv-org if not cached.
/// The `channel_id` can be a tvg_id (e.g., "TF1.fr") or an M3U channel name.
///
/// Accepts an optional `?tz=` query parameter (e.g., `?tz=+0100`) to return
/// programme times in the requested timezone instead of UTC.
///
/// # Route
///
/// `GET /api/epg/:channel_id`
pub async fn get_schedule(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
    Query(query): Query<EpgQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    debug!("EPG schedule request for channel: {channel_id} (tz={:?})", query.tz);

    let tz_offset = query.tz.as_deref().and_then(parse_tz_param);

    // Check cache first.
    {
        let cache = state.epg_cache.read().await;
        if let Some(schedule) = cache.get_schedule(&channel_id) {
            debug!("EPG cache hit for {channel_id}");
            let mut value = serde_json::to_value(schedule).unwrap_or_default();
            if let Some(ref offset) = tz_offset {
                apply_tz_to_schedule(&mut value, offset);
            }
            return Ok(Json(value));
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
            let mut value = serde_json::to_value(schedule).unwrap_or_default();
            if let Some(ref offset) = tz_offset {
                apply_tz_to_schedule(&mut value, offset);
            }
            return Ok(Json(value));
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
/// Accepts an optional `?tz=` query parameter (e.g., `?tz=+0100`) to return
/// programme times in the requested timezone instead of UTC.
///
/// # Route
///
/// `GET /api/epg/:channel_id/now`
pub async fn get_now_next(
    State(state): State<Arc<AppState>>,
    Path(channel_id): Path<String>,
    Query(query): Query<EpgQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<Value>)> {
    let now = Utc::now();
    let tz_offset = query.tz.as_deref().and_then(parse_tz_param);

    // Check cache first.
    {
        let cache = state.epg_cache.read().await;
        if let Some(now_next) = cache.get_now_next(&channel_id, now) {
            let mut value = serde_json::to_value(&now_next).unwrap_or_default();
            if let Some(ref offset) = tz_offset {
                apply_tz_to_now_next(&mut value, offset);
            }
            return Ok(Json(value));
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
            let mut value = serde_json::to_value(&now_next).unwrap_or_default();
            if let Some(ref offset) = tz_offset {
                apply_tz_to_now_next(&mut value, offset);
            }
            return Ok(Json(value));
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
