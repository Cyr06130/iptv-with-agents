# ADR-001: Native FRAME Pallets Instead of ink! Smart Contracts

## Status
Accepted

## Context
The project needs on-chain logic for playlist registry, access control, and token-gating. Two approaches were considered:
1. ink! smart contracts deployed to a contracts pallet
2. Native FRAME pallets compiled directly into the Substrate runtime

## Decision
Use native FRAME pallets for all on-chain logic.

## Rationale
- **Performance**: Pallets execute as native code without the contract execution overhead
- **Direct storage access**: No need for the contract abstraction layer
- **Tighter runtime integration**: Pallets can directly couple with other runtime modules (e.g., Balances, Assets)
- **Simpler tooling**: Standard Rust crate development without `cargo-contract`
- **Testing**: `sp_io::TestExternalities` provides a well-understood mock runtime test framework

## Consequences
- Runtime upgrades are required for pallet changes (heavier deployment process)
- No hot-swappable contract logic without a runtime upgrade
- Acceptable trade-off for Phase 1 where the runtime is not yet deployed to production
