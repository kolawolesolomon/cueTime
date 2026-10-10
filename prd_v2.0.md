# cueTime Application - Product Requirements Document (v2.0)

**Version:** 2.0.0
**Date:** 2026-01-26
**Status:** In Development / Public Beta

## 1. Product Overview
**cueTime** (formerly FocusTimer) is a professional event timing solution designed for stage managers, producers, and public speakers. It separates the control logic (Operator Dashboard) from the presentational layer (Viewer Window), ensuring seamless event flows.

## 2. Core Architecture
- **Framework**: Electron (Main Process + 2 Renderer Processes).
- **Styling Engine**: Tailwind CSS (v3.4).
- **Fonts**: Inter (UI), Space Grotesk (Headers), Material Symbols (Icons).
- **State Management**: Reactive state logic via `timer.js` (Shared Class), broadcast via IPC.

## 3. Key Features

### 3.1. Launch & Setup
- **New Modern Splash Screen**:
    - **Design**: Floating, frameless, transparent card with rounded corners (`border-radius: 24px`).
    - **Visuals**: "Breathing" logo animation, deep dark theme (`#0B0D10`), subtle grid texture.
    - **Progress**: Animated indeterminate progress bar.
    - **UX**: Auto-closes after 3 seconds or when Dashboard is ready.
- **Multi-Screen Logic**:
    - **Auto-Detect**: Launches Viewer on secondary display if present.
    - **Smart Prompt**: If a new screen is plugged in *during* a session, a modal prompts to move the viewer there.
    - **Single Screen Warning**: Modal warning if launching viewer on the same screen (avoiding takeover).

### 3.2. Operator Dashboard
**UI Specifications:**
- **Layout**: 12-column Grid.
    - **Left (5 Cols)**: Timer Control & Presets.
    - **Right (7 Cols)**: Session Management / Run of Show.
- **Theme**: "Surface Dark" (`#1e1e1e`), Zinc Grays (`#71717a`), Brand Primary Blue (`#273472`).

**Controls & Features:**
- **Timer Display**: Massive, clickable `00:00:00` readout.
- **Manual Input**:
    - **Status**: Click timer to edit. Support `MM:SS` or pure minutes.
- **Transport Controls**:
    - `START` (Green, Primary): Text + Icon.
    - `RESET` (Icon only): Rotates on hover.
    - `PAUSE` (Dynamic): Replaces Start when running.
- **Presets**:
    - **Additive**: `+1m`, `+5m`, `+10m`, `+30m`.
    - **Subtractive**: `-1m`, `-5m`, `-30s`.
    - **Seconds**: `+30s` precision.

**Session Management (Run of Show):**
- **Event Schedule List**:
    - **Cards**: Draggable, reorderable event cards.
    - **Status**: Pending (White), Active (Primary Border/Glow), Completed (Green Check, Dimmed).
    - **Metadata**: Title, Duration, Speaker Name.
    - **Actions**: Play (Start specific event), Edit, Delete.
- **Session Title Global**:
    - **Status**: Input field in header.
    - **Current State**: Visual/Interaction **Disabled** (Enter key disabled) pending "Save Schedule" feature.

### 3.3. Viewer Mode (Speaker Display)
**Visual Specifications:**
- **Typography**: Inter (Clean, Modern). Tabular Nums for Timer.
- **Layout**:
    - **Top**: Session Title (Upper Center, `z-index: 20` to specific overlay handling).
    - **Center**: Giant Countdown Timer (`35vw`).
    - **Bottom**: Speaker Name (Lower Center).
- **Z-Index Fix**: Session Title overlay is prioritized (`relative z-20`) to prevent clipping by the timer.

**States:**
1.  **Idle/Running**: Clean White on Black.
2.  **Warning System**:
    - **Ambient Glow**: Soft background pulse (Yellow/Red) instead of harsh borders.
3.  **Overtime**:
    - **Logic**: Timer counts UP (negative numbers not shown, just "TIME UP").
    - **Visual**: "TIME UP" text replaces numbers. Dissolve transition.
    - **Background**: Red ambient pulse.

## 4. Technical Stack
- **Engine**: Node.js / Electron v39.
- **Frontend**: Vanilla JS + Tailwind CSS (No React/Vue framework overhead).
- **Build System**: `electron-builder` (NSIS target).
- **Local Assets**: All fonts (Inter, Space Grotesk) and heavy assets are bundled offline.

## 5. Change Log (Recent)
| Version | Change Summary |
| :--- | :--- |
| **v2.0.0** | Full UI Redesign (Dark Mode, Glassmorphism). |
| **v2.0.0** | Rename to **cueTime**. |
| **v2.0.0** | New Splash Screen (Transparent/Floating). |
| **v2.0.0** | Event Schedule Implementation (Run of Show). |
| **v2.0.0** | Viewer Z-Index Layering Fixes. |
| **v2.0.0** | Migration to Tailwind CSS. |
