# UX Tester Tasks — Phase 1

## TASK-012: Design tokens + test infrastructure
- Verify design token files (colors, spacing, typography) match dark theme
- Set up Vitest config with React Testing Library
- Set up Playwright config for E2E
- **Acceptance**: Test infrastructure runs, tokens match Tailwind config

## TASK-013: Component unit tests
- Tests for VideoPlayer (render, HLS init, keyboard controls)
- Tests for ChannelList (render, selection, live indicator)
- Tests for SearchBar (debounce, clear)
- Tests for WalletButton (connect/disconnect states)
- **Acceptance**: All component tests pass with >70% coverage

## TASK-014: E2E tests
- Browse playlist and select channel
- Search and filter channels
- Play a channel (mock HLS stream)
- Connect wallet flow
- **Acceptance**: All E2E tests pass in Playwright
