# Frontend Builder Tasks — Phase 1

## TASK-007: Next.js project setup
- Initialize Next.js 14 with TypeScript, TailwindCSS, dark theme
- Configure path aliases, ESLint, Vitest, Playwright
- **Acceptance**: `npm run build` and `npm run lint` pass

## TASK-008: VideoPlayer component (hls.js)
- hls.js wrapper component for HLS stream playback
- Native `<video>` fallback for non-HLS sources
- Keyboard controls (space = play/pause)
- **Acceptance**: Component renders, plays HLS test stream

## TASK-009: ChannelList + SearchBar + usePlaylist
- Scrollable channel grid with live indicators
- Debounced search filtering by name and group
- usePlaylist hook fetching from backend API
- **Acceptance**: Channel list renders, search filters correctly

## TASK-010: localStorage hooks
- Generic useLocalStorage hook with SSR safety
- Persist favorites, last watched channel, volume
- **Acceptance**: Data persists across page reloads

## TASK-011: Wallet connection
- Polkadot.js extension integration (Talisman, Polkadot.js)
- Connect/disconnect with truncated address display
- **Acceptance**: Wallet connects, address displays correctly
