# Blockchain Developer Tasks — Phase 1

## TASK-001: Cargo workspace + backend skeleton
- Set up workspace Cargo.toml with backend and pallets members
- Create Axum backend with health endpoint
- **Acceptance**: `cargo build` succeeds, `GET /api/health` returns 200

## TASK-002: M3U parser service
- Implement M3U/M3U8 parser in `backend/src/services/m3u_parser.rs`
- Handle EXTINF metadata: name, group-title, tvg-logo, tvg-id
- Unit tests for well-formed and malformed M3U input
- **Acceptance**: Parser tests pass, handles edge cases

## TASK-003: Channel liveness checker
- HEAD-request probe with configurable timeout
- Concurrent checking (max 20 simultaneous)
- Background re-check task on configurable interval
- **Acceptance**: Checker correctly identifies live/dead channels

## TASK-004: Playlist REST endpoints
- `GET /api/playlist` — JSON response with all channels
- `GET /api/playlist/m3u` — M3U text format response
- Filter by group, search by name (query params)
- **Acceptance**: Both endpoints return correct data

## TASK-005: playlist-registry pallet
- FRAME pallet with register/remove/update_channel_count dispatchables
- BoundedVec storage, proper error handling
- Mock runtime tests with TestExternalities
- **Acceptance**: `cargo test -p pallet-playlist-registry` passes

## TASK-006: access-control pallet
- Role enum (Admin, Editor, Viewer)
- DoubleMap storage for (AccountId, ResourceId) → Role
- grant_role and revoke_role with authorization checks
- **Acceptance**: `cargo test -p pallet-access-control` passes
