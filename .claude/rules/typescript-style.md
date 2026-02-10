## TypeScript Style Rules

- Strict mode enabled (`"strict": true` in tsconfig)
- Explicit return types on all exported functions
- Use `type` over `interface` unless extending is needed
- Prefer `const` assertions for literal types
- No `any` — use `unknown` with type guards instead
- Use barrel exports (`index.ts`) for component directories
- Path aliases via `@/` prefix mapping to `src/`
- React components use `.tsx` extension, utilities use `.ts`
