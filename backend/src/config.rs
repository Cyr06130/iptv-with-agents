/// Application configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    /// TCP port the HTTP server listens on.
    pub port: u16,
    /// URL of the remote M3U playlist source.
    pub m3u_source_url: String,
    /// Timeout in seconds for individual channel probe requests.
    pub probe_timeout_secs: u64,
    /// Interval in minutes between background liveness checks.
    pub probe_interval_mins: u64,
    /// Base URL for the Subscan API used for on-chain playlist lookups.
    pub subscan_api_url: String,
    /// Whether EPG fetching from iptv-org is enabled.
    pub epg_enabled: bool,
}

impl Config {
    /// Build a [`Config`] from environment variables, falling back to sensible defaults.
    ///
    /// | Variable              | Default                             |
    /// |-----------------------|-------------------------------------|
    /// | `BACKEND_PORT`        | `3001`                              |
    /// | `M3U_SOURCE_URL`      | (empty string)                      |
    /// | `PROBE_TIMEOUT_SECS`  | `5`                                 |
    /// | `PROBE_INTERVAL_MINS` | `10`                                |
    /// | `SUBSCAN_API_URL`     | `https://paseo.api.subscan.io`      |
    /// | `EPG_ENABLED`         | `true`                              |
    pub fn from_env() -> Self {
        let port = std::env::var("BACKEND_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(3001);

        let m3u_source_url = std::env::var("M3U_SOURCE_URL").unwrap_or_default();

        let probe_timeout_secs = std::env::var("PROBE_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(5);

        let probe_interval_mins = std::env::var("PROBE_INTERVAL_MINS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .unwrap_or(10);

        let subscan_api_url = std::env::var("SUBSCAN_API_URL")
            .unwrap_or_else(|_| "https://paseo.api.subscan.io".to_string());

        let epg_enabled = std::env::var("EPG_ENABLED")
            .map(|v| v != "false" && v != "0")
            .unwrap_or(true);

        Self {
            port,
            m3u_source_url,
            probe_timeout_secs,
            probe_interval_mins,
            subscan_api_url,
            epg_enabled,
        }
    }
}
