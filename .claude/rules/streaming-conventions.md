## Streaming Conventions

- HLS is the primary streaming protocol; use hls.js for web playback
- M3U playlists are parsed server-side in the Axum backend
- Never expose raw stream URLs directly to the client without validation
- Channel checker uses HEAD requests with configurable timeout
- All stream URLs are validated before being included in API responses
- Probe concurrency is limited to prevent overwhelming source servers
- Background checker runs at configurable intervals (default: 30 minutes)
- Channel liveness is a boolean (live/not-live), determined by HTTP status code
