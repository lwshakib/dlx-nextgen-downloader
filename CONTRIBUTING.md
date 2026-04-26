# Contributing to DLX NextGen Downloader

First off, thank you for considering contributing to DLX NextGen Downloader! It's people like you that make this tool great.

## Development Setup

1. **Prerequisites**: Ensure you have Node.js v20+ and `pnpm` v9+ installed.
2. **Install dependencies**: Run `pnpm install` in the root directory.
3. **Run development server**: Run `pnpm dev` to start the development servers for all apps.

## Monorepo Architecture

This project is a monorepo managed by Turborepo.
- `apps/desktop`: Electron application.
- `apps/cli`: CLI application.
- `apps/extension`: Chrome Extension.
- `apps/web`: Web application.
- `packages/ui`: Shared UI components.

When adding new UI components, always add them to `packages/ui` so they can be shared across the desktop and web apps.

## Pull Request Process

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. Ensure your code passes all linting (`pnpm lint`) and type-checking (`pnpm typecheck`).
4. Update the documentation (READMEs) if your changes affect user-facing features or setup instructions.
5. Issue that pull request!

## Code Style Guidelines

- We use **Prettier** for code formatting. Run `pnpm format` before committing.
- We use **ESLint** for static analysis. Run `pnpm lint` to ensure no warnings or errors exist.
- Use **TypeScript** strictly. Avoid `any` types whenever possible.

## Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:
* OS version.
* App version (Desktop, CLI, Extension, Web).
* Steps to reproduce the bug.

## Feature Requests

If you have an idea for a new feature, please submit an issue with the "enhancement" label. Describe the feature in detail and explain how it would benefit the project.

We look forward to your contributions!
