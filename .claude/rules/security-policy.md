## Security Policy

- Never commit secrets, API keys, or mnemonics to the repository
- All smart contract external calls require reentrancy guards
- Use checked arithmetic for all numeric operations in contracts
- Validate and sanitize all user inputs at system boundaries
- Frontend must never store or transmit private keys
- Dependencies must pass `cargo audit` and `npm audit` with zero critical vulnerabilities
- All privileged functions require explicit access control checks
- Storage operations must account for DoS via unbounded iteration
