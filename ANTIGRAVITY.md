# Git Rewriter - Antigravity Context

**Role:** You are assisting in the development of Git Rewriter, a desktop GUI for safely rewriting Git history metadata.

## Tech Stack
- **Frontend:** React, TypeScript, Tailwind CSS
- **Backend:** Rust, Tauri v2
- **Git Engine:** `gix` (gitoxide) - **NO external git cli processes.**

## Key Rules
1. **Safety:** All git operations that mutate history MUST have a backup strategy. Commits are immutable; rewriting means creating new SHAs.
2. **TDD:** The Rust backend rewrite engine MUST be built using Test-Driven Development. Use `cargo test`.
3. **Architecture:** The frontend strictly follows **Atomic Design** (`atoms`, `molecules`, `organisms`, `templates`, `pages`).
4. **Docs:** Refer to `docs/PROJECT_SPEC.md` for features, `docs/STANDARDS.md` for rules, and `docs/IMPLEMENTATION_STEPS.md` for current progress.

## Current State
The project is currently in the setup and scaffolding phase (Milestone 1).
When taking action, update `.gemini/antigravity/brain/<id>/task.md` or refer to it to maintain state.
