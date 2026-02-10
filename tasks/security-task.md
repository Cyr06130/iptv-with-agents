# Security Engineer Tasks — Phase 1

## TASK-015: Backend + pallet security review
- Audit M3U parser for injection vectors
- Review channel checker for SSRF (internal network probing)
- Audit CORS configuration
- Review pallet dispatchables for origin checks
- Check storage operations for unbounded iteration
- Run `cargo audit` and `cargo clippy`
- **Acceptance**: Security report with findings and severity ratings

## TASK-016: Frontend security review
- Review for XSS vectors (especially in channel names/URLs)
- Check wallet integration for phishing vectors
- Verify no private keys stored in localStorage
- Review API communication for data leakage
- Run `npm audit`
- **Acceptance**: Security report with findings and severity ratings
