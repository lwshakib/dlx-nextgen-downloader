# DLX NextGen Web

The DLX NextGen Web app is a modern frontend interface built with TanStack Start, React, and Tailwind CSS. It serves as the web counterpart within the DLX NextGen Downloader ecosystem.

## Features

- **Modern Stack**: Built using TanStack Start and TanStack Router for type-safe routing and server-side rendering (SSR) capabilities.
- **Shared UI**: Utilizes the `@workspace/ui` package (based on Shadcn/UI) to maintain design consistency with the Desktop app.
- **Vite Powered**: Extremely fast development server and optimized production builds.

## Getting Started

1. Navigate to the web app directory:
   ```bash
   cd apps/web
   ```

2. Install dependencies (if not already done at the root):
   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```
   The app will be available at `http://localhost:3000`.

## Building for Production

To build the application for production:

```bash
pnpm build
```

To preview the production build locally:

```bash
pnpm preview
```

## Structure

- `src/`: Contains the React components, routes, and layout.
- `public/`: Static assets.
- `components.json`: Configuration for Shadcn/UI component generation.
