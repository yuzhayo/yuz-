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

## Recent Changes (September 29, 2025)

### **Latest GitHub Import Session - September 29, 2025**
- **Fresh Repository Import**: Successfully imported fresh GitHub clone to Replit environment
- **Dependencies Verification**: Confirmed all npm dependencies already installed for monorepo structure
- **Workflow Setup**: Configured Launcher workflow on port 5000 with webview output for proper user preview
- **Renderer Compatibility**: Enhanced Pixi.js application creation with robust fallback handling for limited rendering environments
- **Mock Renderer Implementation**: Added comprehensive fallback system including mock application for environments without full graphics support
- **Deployment Configuration**: Set up autoscale deployment with correct build and preview commands
- **Environment Optimization**: Ensured proper host configuration (0.0.0.0) and allowed hosts for Replit proxy compatibility
- **Import Status**: Project successfully running with development server active on port 5000

### **Fresh GitHub Import to Replit Environment**
- **Fresh GitHub Import**: Successfully imported fresh GitHub repository clone to Replit environment
- **Dependencies Installation**: Installed all npm dependencies for monorepo and workspaces (bypassed Husky git hooks with --ignore-scripts)
- **Vite Configuration Verification**: Confirmed all app vite configurations use `allowedHosts: true` and `host: "0.0.0.0"` for proper Replit proxy compatibility
- **Workflow Configuration**: Set up Launcher workflow running on port 5000 (`npm run dev:launcher`)
- **Application Testing**: Verified Launcher app runs correctly with Pixi.js graphics rendering and HMR
- **Deployment Setup**: Configured autoscale deployment with build (`npm run build:launcher`) and run (`npm run preview:5000`) commands
- **Import Complete**: Project is fully operational in Replit environment

### **Fresh GitHub Clone Import Setup - September 29, 2025**
- **Fresh Repository Clone**: Successfully imported and configured fresh GitHub repository clone
- **Node.js Dependencies**: Installed all npm dependencies with `--ignore-scripts` to bypass Husky git hooks
- **Workspace Dependencies**: Ensured all workspace packages have proper dependency installations
- **Vite Development Server**: Confirmed Launcher app runs correctly on port 5000 with proper Replit configuration
- **Pixi.js Renderer**: Application successfully renders using Pixi.js with fallback renderer handling (WebGL/Canvas auto-detection)
- **HMR Testing**: Verified Hot Module Replacement working correctly with Vite development server
- **Production Deployment**: Configured autoscale deployment with build and preview commands
- **Environment Ready**: Project fully operational and ready for development in Replit environment

### **Phase 2: DOM Fallback Removal & Pixi-Only Refactoring**
- **Architecture Simplification**: Removed DOM fallback rendering to use only Pixi.js for better performance and maintainability
- **Type System Cleanup**: Simplified `RendererMode` type from `"auto" | "pixi" | "dom"` to just `"pixi"`
- **LayerCreator.ts Refactoring**: Removed `detectRenderer()`, `isWebGLAvailable()`, and `getOverride()` functions; fixed circular dependencies
- **MainScreen.tsx Simplification**: Removed conditional rendering logic to always use LogicStage with Pixi's buildSceneFromLogic
- **EnginePixi.ts Cleanup**: Removed LogicRenderer component and DOM handling in LogicEngineAdapter class
- **EngineDom.ts Removal**: Deleted entire DOM engine implementation (~500+ lines of DOM-specific code)
- **TypeScript Fixes**: Resolved all type casting issues and import/export errors
- **WebGL Configuration**: Added explicit WebGL renderer preference to Pixi Application constructors
- **UI State Fix**: Removed full-screen loading overlay to reveal cosmic clock interface as primary visual experience
- **Project Import Complete**: All components working - Pixi-only rendering, simplified architecture, ~600+ lines of code removed

## Architecture Notes
- The Launcher app uses Pixi.js exclusively for interactive graphics with WebGL acceleration
- Shared components and utilities are in the `/shared` directory
- Each app has its own package.json and can be developed independently
- Uses passkey authentication system in shared/auth
- Local data storage system in shared/storage
- Simplified single rendering path (Pixi-only) for better performance and maintainability

## User Preferences
- Project uses TypeScript with strict type checking
- ESLint and Prettier configured for code quality
- Husky for git hooks (disabled in Replit environment)
- Tailwind CSS for consistent styling across all apps