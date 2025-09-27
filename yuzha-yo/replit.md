# Overview

This is a modern TypeScript animation framework built around a "Layer System" that processes JSON configurations into animated visual outputs. The project uses a monorepo structure with workspaces, combining a pure functional animation logic library with multiple rendering implementations (Three.js/WebGL and Pixi.js). The main application "Yuzha" serves as a template launcher showcasing various animation presets and configurations.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Core Layer System (Pure Logic)

The heart of the project is a pure, functional animation engine in `/shared/layer/` that:

- Takes JSON configurations as input describing animations, positions, behaviors
- Validates and normalizes configurations with strict TypeScript typing
- Processes time-based animations (spin, orbit, pulse, fade) through composable functions
- Outputs structured LayerData for consumption by rendering systems
- Maintains complete determinism with no side effects or I/O operations

## Dual Rendering Architecture

Two separate rendering implementations provide flexibility:

**Stages Engine** (`/shared/stages/`): Three.js-based WebGL renderer

- Uses Three.js for 3D-capable rendering with 2D projections
- Coordinate system with configurable origin (center/top-left)
- Performance monitoring and adaptive quality adjustment
- Modular architecture with separate transform, device detection, and performance modules

**Pixi Renderer** (in Launcher): Pixi.js-based 2D renderer

- Lightweight 2D graphics optimized for UI elements
- WebGL acceleration with Canvas fallback
- Specialized for interactive launcher interfaces

## Monorepo Structure

- **Root workspace**: Shared configuration, linting, testing infrastructure
- **Yuzha app**: Main template launcher demonstrating Layer System capabilities
- **Shared libraries**: Reusable animation logic, rendering engines, utilities
- **Attached assets**: Additional applications like specialized Launchers

## Animation Behavior System

Animations are built as composable "behaviors" that can be combined:

- **Spin**: Continuous rotation with configurable speed and direction
- **Orbit**: Circular movement around anchor points
- **Pulse**: Scale-based breathing effects
- **Fade**: Opacity oscillation
- **Basic transforms**: Position, scale, rotation, tilt

## Configuration Management

- JSON-based configuration with TypeScript validation
- Asset registry system for image resource management
- UI-friendly converters for editor interfaces (degrees ↔ radians, RPM ↔ speed)
- Preset system for common animation combinations

# External Dependencies

## Core Runtime Dependencies

- **React 18**: UI framework for interactive components
- **Three.js**: 3D graphics library for WebGL rendering
- **Pixi.js**: 2D graphics library for lightweight rendering
- **TypeScript**: Type safety and development experience

## Development Infrastructure

- **Vite**: Build tool and development server
- **Vitest**: Testing framework with coverage reporting
- **ESLint**: Code linting with TypeScript integration
- **Prettier**: Code formatting
- **Tailwind CSS**: Utility-first styling with typography plugins

## Build and Deployment Tools

- **Autoprefixer**: CSS vendor prefixing
- **PostCSS**: CSS processing pipeline
- **Concurrently**: Parallel script execution for monorepo workflows

The system is designed to be self-contained with no external APIs or database dependencies for core animation functionality, though it includes infrastructure for potential database integration via Drizzle ORM patterns.
