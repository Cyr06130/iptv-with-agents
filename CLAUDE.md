# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decentralized IPTV streaming application on Polkadot/Substrate with a 5-agent parallel Claude Code team:
- **blockchain-dev** — Substrate FRAME pallets, Rust Axum backend, M3U parsing
- **frontend-builder** — Next.js, React, TypeScript, hls.js, wallet integrations
- **ux-tester** — Design system, Vitest/Playwright testing, accessibility
- **security-engineer** — Pallet + API security auditing, vulnerability analysis (read-only)
- **architect** — System design, API contracts, code review, cross-agent coordination (team lead)

Agent definitions live in `.claude/agents/`. Style and policy rules live in `.claude/rules/`.

## Architecture

```
backend/
  src/
    routes/           # Axum route handlers (health, playlist)
    services/         # M3U parser, channel liveness checker
    models/           # Channel, Playlist, AppState
pallets/
  playlist-registry/  # FRAME pallet: on-chain playlist registry
  access-control/     # FRAME pallet: role-based access
  token-gate/         # FRAME pallet: token-gated access
web/
  src/
    app/              # Next.js App Router pages
    components/       # React components (VideoPlayer, ChannelList, etc.)
    hooks/            # React hooks (useWallet, usePlaylist, useLocalStorage)
    lib/              # API client, shared types
    design-system/
      tokens/         # Design tokens (colors, spacing, typography)
  __tests__/
    components/       # Vitest component tests
    e2e/              # Playwright E2E tests
mobile/
  lib/                # Flutter skeleton (Phase 2)
docs/
  decisions/          # Architecture Decision Records (ADRs)
  architecture/       # Architecture diagrams and docs
coordination/         # Inter-agent communication files
  TASKS.md            # Architect writes task assignments
  STATUS.md           # All agents write progress updates
  BLOCKERS.md         # Critical issues flagged by any agent
  SECURITY_REPORT.md  # Security audit findings
  DECISIONS.md        # Architectural decisions and merge notes
  current_tasks/      # Lock files for task claims (agent writes <name>.lock)
scripts/              # Agent launch and orchestration scripts
tasks/                # Headless task definitions (one .md per agent)
```

## Agent Coordination Protocol

1. Architect decomposes work into tasks in `coordination/TASKS.md`
2. Agents claim tasks by creating lock files in `coordination/current_tasks/`
3. Agents write progress to `coordination/STATUS.md` after completing work
4. Security engineer writes findings to `coordination/SECURITY_REPORT.md`
5. Critical blockers go in `coordination/BLOCKERS.md`
6. Architect reviews and writes integration decisions to `coordination/DECISIONS.md`

## Running the Agents

### Interactive (local development)
```bash
# All 5 agents in shared directory (simplest)
./scripts/launch-agents.sh

# With git worktree isolation (each agent gets its own filesystem)
./scripts/setup-worktrees.sh    # one-time setup
./scripts/launch-agents-worktrees.sh
```

### Headless (CI/CD)
```bash
# All 5 agents in parallel, architect reviews at the end
./scripts/run-all-agents-headless.sh

# Single agent
claude -p "your task" --agent blockchain-dev --output-format json
```

## Build & Test Commands

### Rust (Backend + Pallets)
```bash
cargo build                     # Build entire workspace (backend + pallets)
cargo test                      # Run all Rust tests
cargo clippy -- -D warnings     # Lint Rust code
cargo fmt                       # Format Rust code
cargo audit                     # Check dependency vulnerabilities
cargo run -p iptv-backend       # Start backend server (port 3001)
```

### Frontend (Next.js)
```bash
cd web && npm install            # Install dependencies
cd web && npm run dev            # Start Next.js dev server (port 3000)
cd web && npm run build          # Production build
cd web && npm run lint           # ESLint
cd web && npm run type-check     # TypeScript type checking
cd web && npm run test           # Vitest unit tests
cd web && npx playwright test    # E2E tests
cd web && npm audit              # Check dependency vulnerabilities
```

## Key Conventions

- **Rust**: No `unwrap()` in production code. Use `sp-std` for pallet code. All public functions need rustdoc.
- **TypeScript**: Strict mode. Explicit return types on exports. No `any` — use `unknown` with type guards.
- **Security**: The security-engineer agent is read-only (`permissionMode: plan`). It cannot modify files.
- **Pallets**: FRAME pallets use `sp_io::TestExternalities` for testing. All dispatchables need origin checks.
- **Streaming**: HLS via hls.js. M3U parsed server-side. Channel liveness checked via HEAD requests.
- **Data**: All user data stored in localStorage (web) or device storage (mobile). No database.
- **Testing**: Test user behavior, not implementation. E2E covers playlist browse, channel play, search, wallet connect.

## Explicitly NOT Used

- No ink! smart contracts (using FRAME pallets instead)
- No PostgreSQL, Redis, or any database
- No CDN or media server (SRS)
- No Meilisearch (client-side search only)

## Git

- Never add `Co-Authored-By` lines to commit messages. All code is authored solely by the user.

## Bash Guidelines

- Do not pipe output through `head`, `tail`, `less`, or `more` — causes buffering issues
- Use command-specific flags to limit output (e.g., `git log -n 10` not `git log | head -10`)
