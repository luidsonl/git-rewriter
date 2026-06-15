# Implementation Steps

This document outlines the milestones for developing the Git Rewriter.

## Milestone 1: Project Scaffolding & Setup (Current)
- [x] Define project specs and standards.
- [x] Initialize Tauri + React + TypeScript + Tailwind.
- [ ] Set up Atomic Design folder structure.
- [ ] Set up Frontend testing (Vitest + RTL).
- [ ] Set up Backend testing (Cargo test).
- [x] Create AI Context files.

## Milestone 2: Backend MVP - Read-Only Git Scanner
- [ ] Implement `gix` repository opening logic.
- [ ] Implement commit scanner (traverse DAG).
- [ ] Implement contributor extraction and aggregation.
- [ ] Create Tauri commands: `open_repository`, `scan_repository`, `get_contributors`, `get_commits`.
- [ ] Write unit tests for the scanner logic using mock repositories.

## Milestone 3: Frontend MVP - Data Visualization
- [ ] Build UI Atoms (Button, Input, Table Cell).
- [ ] Build Molecules (Search Bar, Contributor Row).
- [ ] Build Dashboard Page (stats overview).
- [ ] Build Contributors Page (list of contributors).
- [ ] Build Commit Explorer Page (list of commits).
- [ ] Connect Frontend pages to Tauri `invoke` commands.

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
