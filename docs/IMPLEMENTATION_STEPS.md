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
- [ ] Build UI Atoms (Button, Input, Table Cell).
- [ ] Build Molecules (Search Bar, Contributor Row).
- [x] Build Dashboard Page (stats overview — repo name, commits, contributors, branches).
- [ ] Build Contributors Page (list of contributors).
- [ ] Build Commit Explorer Page (list of commits).
- [ ] Connect frontend pages to Tauri `invoke` commands.

## Milestone 4: The Rewrite Engine (Core Backend)
- [ ] Implement the DAG rewriting algorithm in Rust.
- [ ] Implement branch and tag update logic.
- [ ] Implement contributor identity rewrite logic.
- [ ] Implement single commit edit logic.
- [ ] Implement automatic backup references (`refs/backup/pre-rewrite`).
- [ ] **Crucial:** Extensive TDD for the rewrite engine to guarantee DAG integrity.

## Milestone 5: Rewrite UI and Workflows
- [ ] Build Rewrite Preview Page.
- [ ] Implement contributor merging flow in UI.
- [ ] Implement single commit editing flow in UI.
- [ ] Integrate safety dialogs and backup visualization.

## Milestone 6: Polish and QA
- [ ] Manual QA based on scenarios in PROJECT_SPEC.md.
- [ ] Rollback functionality implementation and testing.
- [ ] UI Polish (animations, loading states, empty states).
- [ ] CI/CD setup for automated linting and testing.
