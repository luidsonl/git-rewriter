# Git Rewriter - Claude Context

**Role:** You are assisting in the development of Git Rewriter, a desktop GUI for safely rewriting Git history metadata.

## Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Backend:** Rust, Tauri v2
- **Git Engine:** `gix` (gitoxide) - **NO external git cli processes.**

## Key Rules
1. **Safety:** All git operations that mutate history MUST have a backup strategy. Commits are immutable; rewriting means creating new SHAs.
2. **TDD:** The Rust backend rewrite engine MUST be built using Test-Driven Development.
3. **Architecture:** The frontend strictly follows **Atomic Design** (`atoms`, `molecules`, `organisms`, `templates`, `pages`).
4. **Docs:** Refer to `docs/PROJECT_SPEC.md` for features, `docs/STANDARDS.md` for rules, and `docs/IMPLEMENTATION_STEPS.md` for current progress.

## How to Help
When suggesting code:
- Ensure React components are broken down atomically.
- Ensure Rust code handles Result/Option safely without panic.
- Prioritize testability. Mock frontend interactions.
