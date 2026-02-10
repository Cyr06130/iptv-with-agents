## Testing Standards

- Substrate pallets: `sp_io::TestExternalities` mock runtime tests
- Backend: integration tests with `axum-test` or direct handler testing
- Frontend components: Vitest + React Testing Library
- API mocking: MSW (Mock Service Worker)
- E2E: Playwright for critical user flows
- Accessibility: axe-core on every new page/component
- Test user behavior, not implementation details
- Critical flows requiring E2E: browse playlist, play channel, search channels, connect wallet
- Minimum coverage targets: 80% for pallets, 70% for frontend
