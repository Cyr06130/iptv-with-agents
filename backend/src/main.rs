mod config;
mod models;
mod routes;
mod services;

use std::sync::Arc;
use std::time::Duration;

use axum::{routing::{get, post}, Router};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use config::Config;
use models::{AppState, Playlist};
use services::channel_checker;

/// Entry point for the IPTV backend service.
///
/// Initialises tracing, loads configuration from environment variables,
/// sets up shared state, and starts the Axum HTTP server with CORS
/// middleware and a background channel-checker task.
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialise structured logging.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cfg = Config::from_env();
    info!("Starting IPTV backend on port {}", cfg.port);

    // Build initial (empty) playlist state.
    let playlist = Playlist {
        name: "default".to_string(),
        channels: Vec::new(),
        last_checked: None,
        source: cfg.m3u_source_url.clone(),
    };

    let state = Arc::new(AppState {
        playlist: tokio::sync::RwLock::new(playlist),
        config: cfg.clone(),
        check_now: tokio::sync::Notify::new(),
    });

    // Spawn the background channel liveness checker *before* loading the
    // playlist so it is ready to receive the notify signal.
    channel_checker::start_background_checker(
        Arc::clone(&state),
        Duration::from_secs(cfg.probe_interval_mins * 60),
        Duration::from_secs(cfg.probe_timeout_secs),
    );

    // If a source URL is configured, fetch and parse the M3U on startup,
    // then trigger an immediate liveness check.
    if !cfg.m3u_source_url.is_empty() {
        if let Err(e) = fetch_and_load_playlist(&cfg.m3u_source_url, &state).await {
            tracing::error!("Failed to load initial playlist: {e}");
        } else {
            state.check_now.notify_one();
        }
    }

    // CORS: allow all origins during development.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health", get(routes::health::health))
        .route("/api/playlist", get(routes::playlist::get_playlist).put(routes::playlist::update_playlist))
        .route("/api/playlist/m3u", get(routes::playlist::get_playlist_m3u))
        .route("/api/playlist/upload", post(routes::playlist::upload_playlist))
        .route("/api/chain/playlist", get(routes::chain::get_chain_playlist))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", cfg.port)).await?;
    info!("Listening on 0.0.0.0:{}", cfg.port);
    axum::serve(listener, app).await?;

    Ok(())
}

/// Fetch an M3U playlist from `url` and load its channels into the shared state.
async fn fetch_and_load_playlist(
    url: &str,
    state: &Arc<AppState>,
) -> Result<(), Box<dyn std::error::Error>> {
    let body = reqwest::get(url).await?.text().await?;
    let channels = services::m3u_parser::parse_m3u(&body);
    info!("Parsed {} channels from {}", channels.len(), url);

    let mut playlist = state.playlist.write().await;
    playlist.channels = channels;

    Ok(())
}
