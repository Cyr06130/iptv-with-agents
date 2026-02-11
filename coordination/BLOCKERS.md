# Blockers

## BLOCKER-001: Hardcoded Dev Key (Alice) Must Not Ship to Production
**Severity:** CRITICAL
**Reported by:** architect (2026-02-11)
**Assigned to:** blockchain-dev (TASK-SEC-01) + frontend-builder (TASK-SEC-02)
**Status:** Open -- Blocks any deployment

The well-known Substrate dev mnemonic is imported at the top of `web/src/lib/chain.ts`
and bundled into the client-side JavaScript. This means:
1. Anyone can extract the private key from the browser bundle
2. All transactions are signed as Alice (no per-user authentication)
3. The Alice key has Sudo privileges on the bulletin chain

**Resolution requires both tasks:**
- TASK-SEC-01: Gate the import behind `NEXT_PUBLIC_USE_DEV_KEY` env var
- TASK-SEC-02: Wire real wallet signer into the submission flow

**No production deployment is permitted until both tasks are completed and verified.**
