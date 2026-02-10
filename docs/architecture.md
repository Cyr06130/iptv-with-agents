# Architecture Overview

## System Diagram

```
                    +-----------------+
                    |  M3U Source(s)  |
                    +--------+--------+
                             |
                             v
              +--------------+--------------+
              |    Axum Backend (Rust)      |
              |  - M3U Parser              |
              |  - Channel Liveness Probe  |
              |  - REST API Server         |
              +--------------+--------------+
                             |
                    REST API (JSON/M3U)
                             |
              +--------------+--------------+
              |                             |
     +--------v--------+       +-----------v-----------+
     | Next.js Frontend |       |   Flutter Mobile     |
     | (hls.js player)  |       |   (Phase 2)          |
     +--------+---------+       +-----------+-----------+
              |                             |
     +--------v--------+       +-----------v-----------+
     |  localStorage    |       |  SharedPreferences    |
     |  (user data)     |       |  (device storage)     |
     +-----------------+       +-----------------------+

              +-------------------------------------------+
              |        Substrate Pallets (On-chain)       |
              |  - playlist-registry                      |
              |  - access-control                         |
              |  - token-gate                             |
              +-------------------------------------------+
                             ^
                             |
                    Polkadot.js Extension
                    (Talisman / Polkadot.js)
```

## Data Flow

1. **M3U Loading**: Backend fetches M3U playlist from configured source URL
2. **Parsing**: M3U parser extracts channel metadata (name, group, logo, stream URL)
3. **Liveness Check**: Channel checker sends HEAD requests to verify stream availability
4. **API Serving**: REST endpoints serve validated playlist data as JSON or M3U
5. **Frontend Playback**: hls.js loads HLS streams directly from source URLs
6. **User Data**: Favorites, settings, and watch history stored in localStorage

## Components

### Backend (Rust/Axum) — `backend/`
- Loads and parses M3U/M3U8 playlists
- Probes channel liveness via HEAD requests (configurable timeout/interval)
- Serves REST API: `/api/health`, `/api/playlist`, `/api/playlist/m3u`
- CORS-enabled for frontend dev server

### Substrate Pallets — `pallets/`
- **playlist-registry**: On-chain playlist metadata registry
- **access-control**: Role-based access (Admin, Editor, Viewer) per resource
- **token-gate**: Token-gated access requirements per resource

### Web Frontend (Next.js) — `web/`
- hls.js-based video player for HLS streams
- Channel list with search/filter
- Polkadot wallet connection (Talisman, Polkadot.js extension)
- All user data in localStorage (no database)

### Mobile (Flutter) — `mobile/`
- Phase 2 skeleton
- Same features as web, using device local storage

## localStorage Schema

```json
{
  "iptv-favorites": ["channel-id-1", "channel-id-2"],
  "iptv-last-watched": "channel-id-3",
  "iptv-volume": 0.8,
  "iptv-settings": {
    "autoplay": true,
    "showOfflineChannels": false
  }
}
```

## Wallet Flow

1. User clicks "Connect Wallet"
2. `web3Enable('IPTV Stream')` requests access from browser extension
3. `web3Accounts()` retrieves available accounts
4. User selects account, address displayed in header
5. Signed transactions call pallet dispatchables (register playlist, set roles, etc.)
