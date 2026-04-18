# Contributing to Flux Video Downloader

Thank you for your interest in contributing to Flux Video Downloader! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [Adding New Features](#adding-new-features)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/flux-video-downloader.git
   cd flux-video-downloader
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/lwshakib/flux-video-downloader.git
   ```

## Development Setup

Flux Video Downloader consists of three main components. You can work on them independently or together.

### Prerequisites

- **Node.js**: v18 or higher
- **npm** or **yarn**
- **Git**
- **Chrome/Chromium** (for testing the extension)
- **RapidAPI Key** (optional, for YouTube crawling in web app)

### Component Setup

#### 1. Web App (`flux-web-app/`)

```bash
cd flux-web-app
npm install

# Create .env.local file
echo "RAPIDAPI_KEY=your_key_here" > .env.local

# Start development server
npm run dev
```

The web app will be available at `http://localhost:3000`.

#### 2. Desktop App (`flux-desktop-app/`)

```bash
cd flux-desktop-app
npm install

# Start development server
npm run dev
```

#### 3. Chrome Extension (`flux-chrome-extension/`)

```bash
cd flux-chrome-extension
npm install

# Create .env file (optional)
echo "VITE_WEB_API_URL=http://localhost:3000" > .env

# Build the extension
npm run build

# Load dist/ folder in Chrome as unpacked extension
```

## Project Structure

```
flux-video-downloader/
├── flux-web-app/              # Next.js web application
│   ├── app/                  # App Router pages and API routes
│   ├── components/           # React components
│   ├── utilities/            # Utility functions
│   └── lib/                  # Library utilities
├── flux-desktop-app/         # Electron desktop application
│   ├── electron/            # Electron main process
│   ├── src/                 # React renderer process
│   └── public/              # Static assets
├── flux-chrome-extension/    # Chrome extension
│   ├── src/
│   │   ├── background/      # Background service worker
│   │   ├── content/         # Content scripts
│   │   └── popup/           # Extension popup
│   └── public/              # Static assets
└── assets/                   # Shared assets (logos, etc.)
```

See individual README files in each component directory for detailed structure.

## Coding Standards

### TypeScript

- Use **TypeScript** for all new code
- Enable **strict mode** in `tsconfig.json`
- Avoid `any` types; use proper types or `unknown`
- Use interfaces for object shapes, types for unions/intersections
- Export types and interfaces that are used across modules

### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings (where consistent with existing code)
- Use **semicolons** at the end of statements
- Use **camelCase** for variables and functions
- Use **PascalCase** for components and classes
- Use **kebab-case** for file names (except React components: `PascalCase.tsx`)

### React Components

- Use **functional components** with hooks
- Prefer named exports for components
- Use TypeScript interfaces for props:

  ```typescript
  interface ButtonProps {
    label: string;
    onClick: () => void;
  }

  export function Button({ label, onClick }: ButtonProps) {
    // ...
  }
  ```

- Keep components small and focused
- Extract reusable logic into custom hooks

### ESLint

All components use ESLint. Run linting before committing:

```bash
# Web App
cd flux-web-app && npm run lint

# Desktop App
cd flux-desktop-app && npm run lint
```

**Rules:**

- Follow ESLint recommendations
- Fix all warnings before submitting PRs
- Use `// eslint-disable-next-line` sparingly and with justification

### File Organization

- Group related files together
- Use index files for clean imports
- Keep utility functions in `utilities/` or `lib/`
- Place shared types in appropriate type definition files

### Comments

- Write self-documenting code; comments should explain "why" not "what"
- Use JSDoc comments for public APIs
- Add comments for complex algorithms or business logic

## Git Workflow

### Branch Naming

Use descriptive branch names:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

Examples:

- `feature/add-instagram-support`
- `fix/youtube-quality-selection`
- `docs/update-api-documentation`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Build process or auxiliary tool changes

**Examples:**

```
feat(web-app): add Instagram video support

Add new crawler endpoint and UI page for Instagram videos.
Includes quality selection and download functionality.

Closes #123
```

```
fix(desktop-app): resolve download progress not updating

The progress bar was not updating correctly for paused/resumed
downloads. Fixed by properly tracking state changes.

Fixes #456
```

### Keeping Your Fork Updated

```bash
# Fetch upstream changes
git fetch upstream

# Switch to main branch
git checkout main

# Merge upstream changes
git merge upstream/main

# Push to your fork
git push origin main
```

## Pull Request Process

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following coding standards

3. **Test your changes**:

   - Run linting: `npm run lint`
   - Test the affected component(s)
   - Ensure no console errors

4. **Commit your changes** with descriptive commit messages

5. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub:

   - Use a clear, descriptive title
   - Fill out the PR template (if available)
   - Reference related issues
   - Add screenshots for UI changes
   - Describe what was changed and why

7. **Respond to feedback**:
   - Address review comments
   - Make requested changes
   - Keep the PR updated with `main` if needed

### PR Checklist

Before submitting, ensure:

- [ ] Code follows project coding standards
- [ ] All linting passes (`npm run lint`)
- [ ] TypeScript compiles without errors
- [ ] Changes are tested manually
- [ ] Documentation is updated (if needed)
- [ ] Commit messages follow conventional commits
- [ ] PR description is clear and complete

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Detailed steps to reproduce
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**:
   - OS and version
   - Node.js version
   - Component version
   - Browser (for web app/extension)
6. **Screenshots**: If applicable
7. **Logs**: Console errors or relevant logs

### Feature Requests

For feature requests, include:

1. **Use Case**: Why is this feature needed?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: Other solutions considered
4. **Additional Context**: Any other relevant information

## Adding New Features

### Adding a New Video Platform

1. **Web App**:

   - Create page: `app/{platform}/page.tsx`
   - Create crawler: `app/api/crawl/{platform}/route.ts`
   - Add download proxy if needed: `app/api/download/{platform}/route.ts`
   - Update navigation/components

2. **Desktop App**:

   - Add page: `src/pages/{platform}-results.tsx`
   - Update sidebar navigation
   - Add crawler integration if needed

3. **Chrome Extension**:

   - Update platform detection in `src/content/views/App.tsx`
   - Add URL extraction logic
   - Update quality selection UI

4. **Documentation**:
   - Update README files
   - Add API documentation
   - Update supported platforms list

### Adding UI Components

- Use **shadcn/ui** components when possible
- Follow existing component patterns
- Ensure responsive design
- Support dark/light themes
- Add proper TypeScript types

## Testing

### Manual Testing

Before submitting PRs, manually test:

- **Web App**: Test on different browsers, test all affected pages
- **Desktop App**: Test on your OS, verify downloads work
- **Chrome Extension**: Load in Chrome, test download interception

### Testing Checklist

- [ ] Feature works as expected
- [ ] No console errors
- [ ] Responsive design works
- [ ] Dark/light themes work (if UI change)
- [ ] Error handling works
- [ ] Edge cases are handled

## Documentation

### Code Documentation

- Document complex functions with JSDoc
- Add comments for non-obvious logic
- Keep README files updated

### Updating READMEs

When adding features:

- Update relevant component README
- Update root README if needed
- Add API documentation for new endpoints
- Update project structure if changed

## Getting Help

- **Issues**: Check existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: Be open to feedback and suggestions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Thank You!

Thank you for contributing to Flux Video Downloader! Your contributions help make this project better for everyone.
