# ADR-002: Standalone Axum Backend Separate from Substrate Node

## Status
Accepted

## Context
The application needs to load M3U playlists from external sources, parse them, and probe channel liveness via HTTP HEAD requests. These are inherently off-chain operations.

## Decision
Use a standalone Rust backend built with Axum, separate from the Substrate node.

## Rationale
- **Separation of concerns**: M3U parsing and HTTP probing are off-chain concerns that don't belong in a blockchain runtime
- **Independent scaling**: The backend can be horizontally scaled independently of the Substrate node
- **Simpler development**: Standard async Rust with tokio, no `no_std` constraints
- **Faster iteration**: Backend changes don't require runtime upgrades
- **Standard tooling**: reqwest for HTTP, serde for JSON, tower-http for middleware

## Consequences
- Need to bridge backend data to on-chain registry (Phase 2: backend calls pallet extrinsics)
- Two separate Rust binaries to deploy and manage
- CORS must be configured to allow frontend access
