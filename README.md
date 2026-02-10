# IPTV with Agents

A decentralized IPTV streaming application built on Polkadot/Substrate, developed by a 5-agent parallel Claude Code team.

## Architecture

```
M3U Source(s)
      |
      v
 Axum Backend (Rust)          Substrate Pallets (On-chain)
 - M3U parser                 - playlist-registry
 - Channel liveness probe     - access-control
 - REST API server            - token-gate
      |                              ^
  REST API (JSON/M3U)               |
      |                     Polkadot.js Extension
      v                     (Talisman / Polkadot.js)
 Next.js Frontend                   |
 - hls.js video player       Flutter Mobile (Phase 2)
 - Channel list + search
 - Wallet connection
 - localStorage persistence
```

### Backend (Rust/Axum)

Fetches M3U playlists, parses channel metadata, probes liveness via HEAD requests, and serves validated data through a REST API.

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Server status + channel count |
| `GET /api/playlist` | Full playlist as JSON |
| `GET /api/playlist/m3u` | Playlist in M3U text format |

### Substrate Pallets

Three FRAME pallets (standalone, no ink!):

- **playlist-registry** -- On-chain playlist metadata registry with bounded storage
- **access-control** -- Role-based access (Admin, Editor, Viewer) per resource
- **token-gate** -- Token-gated access requirements per resource

### Web Frontend (Next.js)

- HLS video playback via hls.js
- Channel list with live indicators and client-side search
- Polkadot wallet integration (Talisman, Polkadot.js extension)
- All user data stored in localStorage (no database)

### Mobile (Flutter)

Phase 2 skeleton with matching data models.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust, Axum 0.7, Tokio, Reqwest |
| Pallets | Substrate FRAME (polkadot-sdk stable2409) |
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Video | hls.js |
| Wallet | @polkadot/api, @polkadot/extension-dapp |
| Mobile | Flutter (Phase 2) |
| Testing | Vitest, Playwright, sp_io::TestExternalities |

## Getting Started

### Prerequisites

- Rust (stable)
- Node.js >= 18
- npm

### Setup

```bash
# Clone
git clone https://github.com/Cyr06130/iptv-with-agents.git
cd iptv-with-agents

# Build Rust workspace (backend + pallets)
cargo build

# Install frontend dependencies
cd web && npm install && cd ..
```

### Environment

Copy `.env.example` and configure:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_PORT` | `3001` | Port for the Axum backend |
| `M3U_SOURCE_URL` | *(empty)* | URL to an M3U/M3U8 playlist |
| `PROBE_TIMEOUT_SECS` | `5` | Timeout for channel liveness checks |
| `PROBE_INTERVAL_MINS` | `30` | Interval between background liveness checks |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend URL for the frontend |

### Run

```bash
# Start backend (terminal 1)
cargo run -p iptv-backend

# Start frontend (terminal 2)
cd web && npm run dev
```

Backend runs on `http://localhost:3001`, frontend on `http://localhost:3000`.

## Testing

```bash
# All Rust tests (backend + pallets)
cargo test

# Frontend unit tests
cd web && npm run test

# E2E tests
cd web && npm run test:e2e

# Type checking
cd web && npm run type-check

# Linting
cargo clippy -- -D warnings
cd web && npm run lint
```

**Current test status:** 19 tests passing (7 backend + 4 per pallet).

## Project Structure

```
backend/              Rust/Axum REST API
  src/routes/         Route handlers (health, playlist)
  src/services/       M3U parser, channel liveness checker
  src/models/         Channel, Playlist, AppState
pallets/
  playlist-registry/  FRAME pallet: on-chain playlist registry
  access-control/     FRAME pallet: role-based access
  token-gate/         FRAME pallet: token-gated access
web/                  Next.js frontend
  src/app/            App Router pages
  src/components/     VideoPlayer, ChannelList, SearchBar, WalletButton
  src/hooks/          useWallet, usePlaylist, useLocalStorage
  src/lib/            API client, shared types
  src/design-system/  Design tokens (colors, spacing, typography)
mobile/               Flutter skeleton (Phase 2)
docs/                 Architecture docs and ADRs
coordination/         Agent task tracking and communication
scripts/              Agent launch and orchestration
tasks/                Headless task definitions per agent
```

## Agent Team

This project is developed by 5 specialized Claude Code agents working in parallel:

| Agent | Role |
|-------|------|
| **architect** | System design, code review, cross-agent coordination (team lead) |
| **blockchain-dev** | Substrate pallets, Axum backend, M3U parsing |
| **frontend-builder** | Next.js, React, TypeScript, hls.js, wallet integrations |
| **ux-tester** | Design system, Vitest/Playwright testing, accessibility |
| **security-engineer** | Pallet + API security auditing (read-only) |

Agent definitions are in `.claude/agents/`. Launch all agents with:

```bash
./scripts/launch-agents.sh
```

## License

MIT
