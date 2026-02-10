## Rust Style Rules

- Use `cargo fmt` formatting (rustfmt defaults)
- Prefer `thiserror` for library errors, `anyhow` for application errors
- Use `#[derive(Debug, Clone)]` on all public types
- Never use `unwrap()` or `expect()` in production code — use `?` operator
- Use `sp-std` instead of `std` for Substrate runtime code
- All public functions must have rustdoc comments
- Prefer `impl Trait` over `dyn Trait` where possible
- Use `cargo clippy -- -D warnings` as the lint baseline
