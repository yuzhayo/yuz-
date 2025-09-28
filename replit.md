# Yuzha Monorepo

## Overview
This is a React-based monorepo containing multiple applications with a shared component library. The project uses Vite for build tooling, TypeScript for type safety, and Tailwind CSS for styling. The main application is a Launcher app built with Pixi.js for interactive graphics.

## Project Structure
- **Launcher/**: Main launcher application with Pixi.js-based interactive interface (moved from apps/Launcher/)
- **apps/0Setting/**: Settings module application  
- **apps/1Meng/**: Meng module application
- **apps/3Database/**: Database module application
- **apps/4Extra/**: Extra module application
- **apps/5Rara/**: Rara module application
- **shared/**: Shared utilities, hooks, styles, and authentication components

## Current Configuration
- **Framework**: React 18 + TypeScript + Vite 7
- **UI**: Tailwind CSS with custom fonts (Taimingda)
- **Graphics**: Pixi.js for interactive launcher interface
- **Development Server**: Configured for Replit environment on port 5000
- **Build System**: Vite with ES2020 target
- **Package Management**: npm workspaces for monorepo structure

## Development Setup (Replit Environment)
The project is configured to work seamlessly in the Replit environment:

1. **Workflow**: Launcher app runs on port 5000 with `npm run dev:launcher`
2. **Host Configuration**: Set to `0.0.0.0` with `allowedHosts: true` for proxy compatibility
3. **Dependencies**: All packages installed and configured
4. **HMR**: Vite Hot Module Replacement working correctly

## Available Scripts
- `npm run dev:launcher`: Start the main launcher app
- `npm run dev:all`: Start all apps concurrently
- `npm run build:launcher`: Build the launcher for production
- `npm run build:all`: Build all apps
- `npm run lint`: Run ESLint on all TypeScript files
- `npm run test`: Run Vitest test suite

## Recent Changes (September 28, 2025)
- **Fresh GitHub Import**: Successfully imported fresh GitHub repository clone to Replit environment
- **Dependencies Installation**: Installed all npm dependencies for monorepo and workspaces (bypassed Husky git hooks with --ignore-scripts)
- **Vite Configuration Fix**: Updated all app vite configurations to use `allowedHosts: true` for proper Replit proxy compatibility
- **Workflow Configuration**: Set up Launcher workflow running on port 5000 (`npm run dev:launcher`)
- **Application Testing**: Verified Launcher app runs correctly with Pixi.js graphics, interactive cosmic clock interface, and HMR
- **Deployment Setup**: Configured autoscale deployment with build (`npm run build:launcher`) and run (`npm run preview:5000`) commands
- **Project Import Complete**: All components working - monorepo structure, frontend on port 5000, all apps properly configured, deployment ready for production

## Architecture Notes
- The Launcher app uses Pixi.js for interactive graphics with DOM fallback
- Shared components and utilities are in the `/shared` directory
- Each app has its own package.json and can be developed independently
- Uses passkey authentication system in shared/auth
- Local data storage system in shared/storage

## User Preferences
- Project uses TypeScript with strict type checking
- ESLint and Prettier configured for code quality
- Husky for git hooks (disabled in Replit environment)
- Tailwind CSS for consistent styling across all apps