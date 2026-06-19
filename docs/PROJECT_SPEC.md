Build a desktop application called **Git Rewriter** using:

* **Tauri v2** for desktop shell
* **React + TypeScript** for frontend
* **Tailwind CSS** for styling
* **Rust** for backend commands
* **gix (gitoxide)** as the Git engine (preferred), avoiding external Git dependencies

---

# Project Goal

Create a desktop GUI tool specialized in **rewriting Git history metadata safely**.

The application must allow users to:

1. Open a local Git repository
2. Scan all commits in all branches
3. Detect all contributors (authors and committers)
4. Group identities by:

   * author name
   * author email
   * committer name
   * committer email
5. Rewrite contributor identities across multiple commits
6. Edit individual commits
7. Rewrite Git history while preserving commit graph structure
8. Create automatic backups before destructive operations

---

# Core Features

## Repository Scanner

When a repository is opened, scan all commits and build an in-memory commit graph (DAG).

Each commit should contain:

```rust
struct CommitInfo {
    sha: String,

    author_name: String,
    author_email: String,
    author_date: String,

    committer_name: String,
    committer_email: String,
    commit_date: String,

    message: String,
    parent_shas: Vec<String>,
}
```

Store all commits in memory for fast UI access.

---

## Contributor Detection

Detect all identities that interacted with the repository.

Example output:

John Doe [john@gmail.com](mailto:john@gmail.com)        152 commits
J. Doe [john@company.com](mailto:john@company.com)         48 commits
CI Bot [ci@company.com](mailto:ci@company.com)           89 commits

Each contributor object:

```ts
type Contributor = {
  id: string
  name: string
  email: string
  commitCount: number
  commits: string[]
}
```

Provide optional fuzzy matching to suggest merged identities.

Examples:

* John Doe
* john doe
* J. Doe

These may represent the same person.

---

## Contributor Rewrite

Allow selecting one or more identities and rewriting them into a unified identity.

Example:

Selected:

* John Doe [john@gmail.com](mailto:john@gmail.com)
* J. Doe [john@company.com](mailto:john@company.com)

Rewrite to:

* Name: John Doe
* Email: [john@newcompany.com](mailto:john@newcompany.com)

Apply rewrite to all matching commits.

Rules:

* Rewrite author metadata
* Optionally rewrite committer metadata
* Preview number of affected commits before applying

---

## Individual Commit Editor

Allow editing individual commit metadata.

Editable fields:

* author name
* author email
* committer name
* committer email
* author date
* commit date
* commit message

Commit detail UI should show:

* SHA
* parents
* commit message
* author info
* committer info
* dates

---

# Rewrite Engine

IMPORTANT:

Git commits are immutable.

Changing metadata changes commit SHA.

Implement a rewrite engine that:

1. Traverses commits in topological order
2. Recreates modified commits
3. Rewrites descendants when parent SHA changes
4. Maintains mapping:

```rust
HashMap<OldSha, NewSha>
```

Ensure DAG integrity after rewrite.

Support:

* linear history
* merge commits
* multiple branches
* tags

Prefer **Test-Driven Design** for this module because it is critical.

---

# Safety Features

Before rewriting history:

Automatically create backup references:

* backup branch

Display warning dialog:

WARNING:
This operation rewrites Git history.
Commit hashes will change.
Force push may be required for remote repositories.

Buttons:

* cancel
* continue

Provide rollback functionality.

---

# UI Requirements

Create a modern dark-mode-first UI using Tailwind.

Design inspiration:

* GitKraken
* Linear
* VSCode
* modern developer tools

Use layout:

## Left Sidebar

Navigation:

* Dashboard
* Contributors
* Commit Explorer
* Rewrite Preview
* Settings

---

## Main Content

Dashboard should show:

* repository name
* number of commits
* number of branches
* number of contributors

Use summary cards.

---

## Contributors Page

Table columns:

* name
* email
* commit count
* actions

Actions:

* edit
* merge
* rewrite

Add search/filter.

---

## Commit Explorer

Show:

* searchable commit list
* commit graph visualization (DAG)
* commit details panel

Each commit row:

* SHA (short)
* message
* author
* date

Clicking a commit opens editor.

---

## Rewrite Preview Page

Show:

Before:
old SHA chain

After:
new SHA chain

Display:

* commits affected
* identities rewritten
* branches affected

Add:

* Apply Rewrite button

---

# Atomic Design Architecture

Use **Atomic Design** for frontend architecture.

Organize components into:

## Atoms

Small reusable UI pieces:

* Button
* TextInput
* Avatar
* Badge
* PageTitle
* Spinner

## Molecules

Composed atoms:

* StatCard
* ScanningIndicator
* EmptyState
* ActivityBar
* SortButton
* RepoHeader
* ConfirmDialog
* ToastContainer
* CommitRow
* ContributorRow
* FieldDiff
* Pagination

## Organisms

Complex UI sections:

* Sidebar
* CommitPanel

## Templates

Layout structures:

* MainLayout

## Pages

Route-level screens:

* DashboardPage
* ContributorsPage
* CommitExplorerPage
* PreviewPage
* SettingsPage

Components must:

* be highly reusable
* be small and composable
* separate UI from business logic

Business logic should live in:

* hooks (future)
* services (future)
* stores
* utils

---

# Project Structure

Frontend:

```text
src/
 ├── components/
 │   ├── atoms/
 │   │   ├── index.tsx       (Button, TextInput, Avatar, Badge, PageTitle)
 │   │   └── Spinner.tsx
 │   ├── molecules/
 │   │   ├── index.tsx       (barrel export)
 │   │   ├── ActivityBar.tsx
 │   │   ├── CommitRow.tsx
 │   │   ├── ConfirmDialog.tsx
 │   │   ├── ContributorRow.tsx
 │   │   ├── FieldDiff.tsx
 │   │   ├── Pagination.tsx
 │   │   └── ToastContainer.tsx
 │   ├── organisms/
 │   │   ├── index.tsx       (barrel export)
 │   │   ├── Sidebar.tsx
 │   │   └── CommitPanel.tsx
 │   └── templates/
 │       └── MainLayout.tsx
 ├── pages/
 │   ├── DashboardPage.tsx
 │   ├── ContributorsPage.tsx
 │   ├── CommitExplorerPage.tsx
 │   ├── PreviewPage.tsx
 │   └── SettingsPage.tsx
 ├── stores/
 │   ├── repositoryStore.ts
 │   └── notificationStore.ts
 ├── i18n/
 │   ├── config.ts
 │   └── locales/
 │       ├── en.json
 │       └── pt.json
 ├── utils/
 │   ├── cn.ts
 │   └── date.ts
 └── tests/
```

Backend:

```text
src-tauri/
 ├── src/
 │   ├── main.rs
 │   ├── lib.rs              (Tauri command handlers)
 │   ├── models/
 │   │   └── mod.rs          (CommitInfo, Contributor, RewriteOperation, etc.)
 │   └── git_engine/
 │       ├── mod.rs
 │       ├── scanner.rs
 │       ├── rewriter.rs
 │       └── applier.rs
 └── tests/
     ├── repo_test.rs
     └── setup_test.rs
```

---

# Tauri Backend Commands

Expose Rust commands:

* open_repository(path)
* scan_repository()
* get_contributors()
* get_commits()
* get_commit_details(sha)
* rewrite_contributor(...)
* rewrite_commit(...)
* create_backup()
* apply_rewrite()
* rollback()

Use Tauri invoke API.

---

# Testing Requirements

Testing is mandatory.

The app performs destructive Git operations, so reliability is critical.

---

## Backend Testing (Rust)

Use:

* cargo test
* unit tests
* integration tests
* fixtures
* temporary repositories

Test structure:

```text
src-tauri/tests/
 ├── scanner_tests.rs
 ├── contributor_tests.rs
 ├── rewrite_tests.rs
 └── fixtures/
```

Test scenarios:

### Linear History

Before:
A -> B -> C

Modify B

Expected:
A -> B' -> C'

### Merge History

Before:

A -> B -> D
-> C /

Verify merge parents remain correct.

### Contributor Rewrite

Merge:

* John [old@mail.com](mailto:old@mail.com)
* John [new@mail.com](mailto:new@mail.com)

Expect all commits unified.

### Rollback

Rewrite history.
Rollback.
Repository restored.

Target backend coverage:

* 80%+

---

## Frontend Testing

Use:

* [Vitest](https://vitest.dev?utm_source=chatgpt.com)
* [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/?utm_source=chatgpt.com)

Structure:

```text
src/tests/
 ├── atoms/
 ├── molecules/
 ├── organisms/
 ├── pages/
 └── integration/
```

Test:

* rendering
* filtering
* dialogs
* forms
* workflow

Target frontend coverage:

* 70%+

---

# End-to-End Strategy

Do NOT use Playwright or browser-based E2E testing in the initial project.

Reason:
This application runs inside Tauri WebView, not a standard browser runtime, and most critical logic lives in:

* Rust backend
* filesystem operations
* Git DAG rewriting
* backup/rollback logic

Browser automation provides limited value for validating these critical paths.

Prioritize:

1. Backend integration tests in Rust
2. Frontend component and integration tests
3. Manual QA for full application workflows

---

## Manual QA Scenarios

### Workflow 1 — Repository Scan

1. Open repository
2. Scan commits
3. Verify contributors detected correctly
4. Verify commit graph loads correctly
5. Verify dashboard stats

### Workflow 2 — Contributor Rewrite

1. Open contributors page
2. Select contributor identities
3. Merge identities
4. Preview affected commits
5. Apply rewrite
6. Validate rewritten history

Expected:

* commit SHAs update
* contributor identities unified
* branches updated correctly

### Workflow 3 — Commit Editing

1. Open commit explorer
2. Select commit
3. Edit author/date/message
4. Preview SHA changes
5. Apply rewrite

Expected:

* selected commit rewritten
* descendant commits rewritten
* DAG remains valid

### Workflow 4 — Rollback

1. Apply rewrite
2. Trigger rollback
3. Restore backup refs

Expected:

* repository restored
* original refs restored
* no corruption

---

# Code Quality Requirements

Use strict engineering standards:

Frontend:

* TypeScript strict mode
* ESLint
* Prettier

Backend:

* rustfmt
* clippy

Git hooks:

* Husky pre-commit hooks

CI pipeline must run:

1. frontend lint
2. frontend tests
3. backend format check
4. backend clippy
5. backend tests

---

# Output Expected

Generate:

1. Full project structure
2. Tauri configuration
3. React setup
4. Tailwind setup
5. Rust backend scaffolding
6. Atomic design component scaffolding
7. Main pages
8. Reusable UI components
9. Example mock data
10. Initial repository scanner implementation
11. Test setup for frontend and backend
12. Manual QA workflow documentation
13. Clean production-grade architecture

Prioritize:

* maintainability
* testability
* clean architecture
* production-quality code
* safe Git history rewriting

Important:
Start by generating an MVP skeleton first, then implement features incrementally with clear milestones.
