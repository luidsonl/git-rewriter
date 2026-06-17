# Implementation Steps

This document outlines the milestones for developing the Git Rewriter.

## Milestone 1: Project Scaffolding & Setup (Current)
- [x] Define project specs and standards.
- [x] Initialize Tauri + React + TypeScript + Tailwind.
- [x] Set up Atomic Design folder structure.
- [x] Set up Frontend testing (Vitest + RTL).
- [x] Set up Backend testing (Cargo test).
- [x] Create AI Context files.

## Milestone 2: Backend MVP - Read-Only Git Scanner
- [x] Implement `gix` repository opening logic.
- [x] Implement commit scanner (traverse DAG).
- [x] Implement contributor extraction and aggregation.
- [x] Create Tauri commands: `open_repository`, `scan_repository`.
- [x] Write unit tests for the scanner logic.

## Milestone 3: Frontend MVP - Data Visualization
- [x] Build UI Atoms (Button, TextInput, Avatar, Badge, PageTitle).
- [x] Build Molecules (StatCard, EmptyState, ActivityBar, SortButton, RepoHeader).
- [x] Build Dashboard Page (stats overview — repo name, commits, contributors, branches).
- [x] Build Contributors Page (sortable table with search and activity bars).
- [x] Build Commit Explorer Page (searchable list with detail panel and pagination).
- [x] Build Rewrite Preview Page (with identity merge suggestions).
- [x] Connect frontend pages to Tauri `invoke` commands.

## Milestone 4: The Rewrite Engine (Core Backend)
- [x] Implement the DAG rewriting algorithm in Rust (topological order, cascade).
- [x] Implement branch and tag update logic (refs updated after rewrite).
- [x] Implement contributor identity rewrite logic.
- [x] Implement single commit edit logic (message edit).
- [x] Implement automatic backup references (`refs/backup/pre-rewrite`).
- [x] **Crucial:** Extensive TDD for the rewrite engine (12 unit + 4 integration tests).
- [x] Create Tauri commands: `preview_rewrite`, `apply_rewrite`, `create_backup`, `rollback_rewrite`.

## Milestone 5: Rewrite UI and Workflows
- [x] Build Rewrite Preview Page (connected to backend).
- [x] Implement contributor merging flow in UI (select identities → preview → apply).
- [x] Implement single commit editing flow in UI (edit message/author/committer/dates in CommitExplorerPage).
- [x] Integrate safety dialogs (ConfirmDialog) showing what will change before applying.
- [x] Implement individual commit date editing with chronological validation (parent dates ≤ child dates).
- [x] Date/time editing uses plain text inputs (not native date/time pickers — broken on Linux WebKitGTK).
- [x] Separate TZ text field (`±HHMM`) with permissive normalization (accepts `0000`, `+0000`, `-0300`, `05:30`, `-5`, etc.).
- [x] Staged-operation workflow: changes are staged in-store first, then batch-applied from PreviewPage.
- [x] PreviewPage rewritten as staging review area with staged changes list, unstaging, identity merge suggestions, Apply All.
- [x] Sync committer checkbox: when checked, committer date/time/TZ and name/email mirror author fields via useEffect.
- [x] Batch author rewrite: list all unique authors from the commit graph with editable name/email, preview affected commits, stage Identity operations.
- [ ] UI polish, loading states, empty states.

## Milestone 6: Polish and QA
- [ ] Manual QA based on scenarios in PROJECT_SPEC.md.
- [ ] UI Polish (animations, loading states, empty states).
- [ ] CI/CD setup for automated linting and testing.

## Milestone 7: Repository Management & Navigation
- [x] Add hamburger menu in top bar for repository management.
- [x] Open repository from hamburger menu (file picker).
- [x] Refresh current repository scan.
- [x] Recent repositories list with localStorage persistence.
- [x] Clear recent repositories list.
- [x] Staged operations persisted to localStorage, cleared on repo switch.
- [x] Remove backup infrastructure (backups are no longer created; `backup_ref` removed from `RewritePlan` and `ApplyResult`).
