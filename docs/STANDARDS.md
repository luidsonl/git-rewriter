# Git Rewriter - Coding Standards

## 1. General Principles
- **Safety First:** The primary goal of this application is safe Git history manipulation. All destructive actions must be reversible or performed on a backup first.
- **TDD (Test-Driven Development):** Especially mandatory for the Rust Backend (Rewrite Engine). Ensure edge cases (merge commits, empty commits, detached heads) are tested.
- **Strict Typing:** Frontend must use strict TypeScript. Backend must use strict Rust with clippy lints.

## 2. Frontend Architecture (Atomic Design)
Components must follow the Atomic Design pattern:
- `atoms/`: Basic UI building blocks (Buttons, Inputs, Text, Badges, Icons). Cannot contain other atomic components (except basic elements like text inside a button). No business logic.
- `molecules/`: Simple groups of UI elements functioning together as a unit (Search Bar, Form Field, User Card).
- `organisms/`: Relatively complex UI components that form distinct sections of an interface (Sidebar, Header, Contributor Table, Commit Graph).
- `templates/`: Page-level objects that place components into a layout. Usually don't fetch data.
- `pages/`: Specific instances of templates that handle routing, data fetching, and state management.

## 3. Tech Stack Conventions
- **Styling:** Tailwind CSS. Use utility classes. For complex reusable styles, consider using `cva` (class-variance-authority). Dark mode is default.
- **State Management:** Keep state as close to where it's used as possible. Use React Context or a lightweight library (Zustand) for global state if necessary.
- **Data Fetching:** Tauri commands (`invoke`) should be wrapped in custom hooks or services to separate UI from data fetching logic.

## 4. Backend Architecture
- **Git Engine:** Use `gix` (gitoxide) exclusively for git operations. Do not spawn `git` cli processes.
- **Command Layer:** Tauri commands (`src/commands`) should only handle serializing/deserializing data and calling domain logic.
- **Services:** Business logic (scanning, rewriting) goes into `src/services`.
- **Models:** Strongly typed structs defining the data boundary (e.g., `CommitInfo`, `Contributor`).

## 5. Commit Guidelines
Use Conventional Commits:
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `chore:` Changes to the build process or auxiliary tools and libraries
