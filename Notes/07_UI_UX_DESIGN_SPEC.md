# CosyUI Visual Design System & UI/UX Specification

> **Document Version**: 1.0.0  
> **Author**: Agent 07 - UI/UX & CSS Aesthetics Specialist  
> **Target**: Graph Engine (Agent 02), UI Customizer (Agent 04), Game Logic (Agent 05), Lead Architect (Agent 01)  
> **Core Principle**: Zero-dependency CSS, no external fonts or CDN frameworks, warm dark slate aesthetic, hardware-accelerated 60 FPS rendering.

---

## 1. Executive Design Philosophy: "Warm Dark Cosy"

CosyUI bridges visual node-based workflow programming with custom user-facing web/game UIs. Rather than a sterile, icy-blue enterprise dashboard or an overwhelming complex DAW interface, CosyUI provides an inviting, comfortable, "cosy" environment tailored for hours of deep creative exploration.

### Key Pillars
1. **Zero External Dependencies**:
   - 100% native modern CSS3.
   - No Tailwind, no Bootstrap, no React/Vue/Svelte runtimes, no external CDNs (FontAwesome, Google Fonts, etc.) that could fail in offline environments or introduce latency.
   - Native system font stacks tuned for maximum readability across macOS, Windows, Linux, Android, and iOS.
2. **Warm Slate Tone Hierarchy**:
   - Carefully calibrated dark slate surfaces with subtle warm undertones (`#18191f`, `#232530`, `#2b2d3c`) rather than harsh pure black (`#000000`) or cold blue slates.
   - Gentle ambient glows and amber/indigo accents provide tactile feedback without visual fatigue.
3. **Information Density & Ergonomics**:
   - Clean socket spacing preventing misclicks.
   - Inline controls directly accessible without separate inspector modals.
   - Seamless one-click collapsible nodes for massive graphs.
4. **Instant 60 FPS Tactile Responsiveness**:
   - GPU-promoted layers (`transform: translate3d`, `will-change`).
   - Viewport culling and CSS containment (`contain: layout style paint`).
   - SVG vector cables with subpixel precision and magnetic connection snapping.

---

## 2. Complete Design Tokens & Color Palette

All styling is built upon standardized CSS custom properties (`:root`). This ensures instant global theming, dark/light variations if desired, and unified color-coding across both the node graph editor and runtime UI elements.

### 2.1 CSS Custom Properties Dictionary

```css
:root {
  /* ==========================================================================
     1. Surface & Background Colors (Warm Dark Slate)
     ========================================================================== */
  --bg-canvas:        #18191f; /* Deep warm slate editor canvas background */
  --bg-grid-dot:      rgba(255, 255, 255, 0.06); /* Subtle dot grid coordinate markers */
  --bg-grid-line:     rgba(255, 255, 255, 0.03); /* Major grid division lines */
  --bg-surface:       #232530; /* Primary card / node background */
  --bg-surface-elev:  #2b2d3c; /* Node headers, modal dialogs, floating toolbars */
  --bg-surface-hover: #323546; /* Hover state for interactive panels and cards */
  --bg-input:         #131418; /* Dark inset for text boxes, number inputs, dropdowns */
  --bg-input-focus:   #1a1b22; /* Focused input state */
  --bg-overlay:       rgba(10, 11, 15, 0.75); /* Dimming backdrop overlay */

  /* ==========================================================================
     2. Border & Outline Tokens
     ========================================================================== */
  --border-subtle:    rgba(255, 255, 255, 0.08); /* Internal node dividers, socket rows */
  --border-default:   #323546; /* Standard card and node borders */
  --border-hover:     #43475d; /* Active mouseover border highlight */
  --border-active:    #6c5ce7; /* Selection outline for active nodes */
  --border-amber:     #e5a93c; /* Secondary highlight border */

  /* ==========================================================================
     3. Typography & Text Hierarchy
     ========================================================================== */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
  --font-mono: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "Courier New", monospace;

  --text-main:        #f0f1f5; /* High contrast primary body text */
  --text-muted:       #9fa4b8; /* Secondary labels, socket type descriptions */
  --text-dim:         #62677d; /* Placeholder text, inactive hints */
  --text-inverse:     #131418; /* Text on bright accent badges */

  /* ==========================================================================
     4. Accent Colors
     ========================================================================== */
  --accent-primary:   #6c5ce7; /* Warm Royal Indigo - primary brand & action buttons */
  --accent-primary-hover: #7d6df0;
  --accent-warm:      #e5a93c; /* Warm Amber - status highlights, focus rings, gold badges */
  --accent-warm-hover: #f1b74d;
  --accent-success:   #2ecc71; /* Emerald Green - execution success, online status */
  --accent-danger:    #e74c3c; /* Coral Rose - errors, node execution failure, delete */
  --accent-info:      #0ea5e9; /* Sky Blue - information toasts, tips */

  /* ==========================================================================
     5. Universal Data Socket Type Colors
     ========================================================================== */
  --socket-trigger:   #ff7a00; /* Execution Flow / Impulse: Vivid Signal Orange */
  --socket-string:    #2ecc71; /* Text / String data: Emerald Green */
  --socket-number:    #0ea5e9; /* Integer / Float / Math: Sky Blue */
  --socket-boolean:   #f43f5e; /* Boolean / Flags: Rose Pink */
  --socket-object:    #f59e0b; /* Object / JSON / Dict / Array: Warm Amber */
  --socket-ui:        #a855f7; /* UI Element / Virtual Component: Electric Violet */
  --socket-wildcard:  #94a3b8; /* Any / Polymorphic: Slate Grey */

  /* ==========================================================================
     6. Shadows & Ambient Lighting
     ========================================================================== */
  --shadow-sm:        0 2px 4px rgba(0, 0, 0, 0.25);
  --shadow-md:        0 4px 12px rgba(0, 0, 0, 0.35);
  --shadow-lg:        0 8px 24px rgba(0, 0, 0, 0.50);
  --shadow-node:      0 6px 16px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--border-default);
  --shadow-node-selected: 0 0 0 2px var(--accent-primary), 0 8px 28px rgba(108, 92, 231, 0.35);
  --glow-executing:   0 0 20px rgba(229, 169, 60, 0.65), 0 0 0 2px var(--accent-warm);
  --glow-error:       0 0 20px rgba(231, 76, 60, 0.65), 0 0 0 2px var(--accent-danger);
  --glow-success:     0 0 16px rgba(46, 204, 113, 0.65), 0 0 0 2px var(--accent-success);

  /* ==========================================================================
     7. Radii & Dimensions
     ========================================================================== */
  --radius-sm:        4px;
  --radius-md:        8px;
  --radius-lg:        12px;
  --radius-full:      9999px;
  --node-min-width:   240px;
  --socket-size:      12px;

  /* ==========================================================================
     8. Z-Index Layering
     ========================================================================== */
  --z-canvas-grid:    0;
  --z-canvas-cables:  10;
  --z-canvas-nodes:   20;
  --z-canvas-select:  30;
  --z-hud-controls:   50;
  --z-minimap:        60;
  --z-search-palette: 100;
  --z-modal-backdrop: 200;
  --z-modal-window:   210;
  --z-toast-tooltip:  300;
}
```

---

## 3. Layout Modes & Viewport Architecture

CosyUI provides three distinct operational views, seamlessly switchable via the top HUD toolbar or keyboard shortcuts:
- **Editor View (`Ctrl+1` / `Cmd+1`)**: Visual programming canvas for wiring LLMs and logic.
- **Player View (`Ctrl+2` / `Cmd+2`)**: Dedicated standalone runtime output for story boxes, chat apps, and RPG dashboards.
- **Split View (`Ctrl+3` / `Cmd+3`)**: Live synchronized side-by-side or over-under design view.

```
+-----------------------------------------------------------------------------------+
| Top Navigation & HUD Toolbar (Modes, Project Title, Play/Pause, Preset, Export)  |
+---------------------------------------------------+-------------------------------+
|                                                   |                               |
|                  EDITOR CANVAS                    |          PLAYER VIEW          |
|                                                   |                               |
|   [Node A] ===(cable)===> [Node B]                |   +-----------------------+   |
|                                                   |   |  Dynamic Story UI     |   |
|   +-----------------+                             |   |  - HP: [========  ]   |   |
|   | Minimap         |                             |   |  - Chat & Choice Btns |   |
|   +-----------------+                             |   +-----------------------+   |
|                                                   |                               |
+---------------------------------------------------+-------------------------------+
| Status Bar (Coordinates, Zoom Level, Node Count, Active Execution Status, FPS)    |
+-----------------------------------------------------------------------------------+
```

### 3.1 Mode Definitions

| Mode | Target User Action | Canvas State | Player UI State | Performance Benefit |
| :--- | :--- | :--- | :--- | :--- |
| **Editor View** | Graph editing, socket connecting, debugging | 100% viewport width/height; active pan/zoom | Hidden (`display: none`) | Frees DOM calculation for player UI |
| **Player View** | Playing games, chatting with LLM, testing UX | Paused rendering or offscreen; background logic active | 100% viewport, focused input, immersive game mode | Canvas redraw loops stop; 100% GPU to runtime |
| **Split View (Side-by-Side)** | Real-time tweaking: edit node parameters & watch UI update | Left pane: 50% width (resizable divider) | Right pane: 50% width (resizable divider) | Immediate feedback loop |
| **Split View (Over-Under)** | Ideal for wide cinematic games or vertical workflows | Top pane: 50% height (resizable divider) | Bottom pane: 50% height (resizable divider) | Maximizes horizontal reading width |

### 3.2 Draggable Splitter Divider Mechanics

- **Divider Handle**: 6px wide (or tall), with a 14px invisible hit target (`cursor: col-resize` or `row-resize`).
- **Divider Visual**: `#323546` default with `#6c5ce7` accent highlight on `:hover` and `:active`.
- **Drag Constraint**: Prevents collapse below minimum threshold (minimum 260px on either side).
- **Double Click Action**: Instantly resets splitter to exact 50% / 50% split.

### 3.3 CSS Implementation for Layout Shell

```css
/* Layout Container */
.cosy-app {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-canvas);
  color: var(--text-main);
  font-family: var(--font-sans);
  user-select: none;
}

/* Main Workspace Flex */
.cosy-workspace {
  display: flex;
  flex: 1;
  position: relative;
  overflow: hidden;
  width: 100%;
}

/* Editor Panel */
.cosy-panel-editor {
  position: relative;
  flex: 1;
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-canvas);
}

/* Player Panel */
.cosy-panel-player {
  position: relative;
  flex: 1;
  height: 100%;
  overflow-y: auto;
  background-color: #1a1b23;
  box-shadow: inset 1px 0 0 var(--border-default);
}

/* Mode Modifiers */
.cosy-app[data-layout="editor"] .cosy-panel-editor { display: block; flex: 1; }
.cosy-app[data-layout="editor"] .cosy-panel-player { display: none; }
.cosy-app[data-layout="editor"] .cosy-splitter     { display: none; }

.cosy-app[data-layout="player"] .cosy-panel-editor { display: none; }
.cosy-app[data-layout="player"] .cosy-panel-player { display: block; flex: 1; }
.cosy-app[data-layout="player"] .cosy-splitter     { display: none; }

.cosy-app[data-layout="split-horizontal"] .cosy-workspace { flex-direction: row; }
.cosy-app[data-layout="split-vertical"]   .cosy-workspace { flex-direction: column; }

/* Splitter Bar */
.cosy-splitter {
  background-color: var(--border-default);
  z-index: var(--z-hud-controls);
  transition: background-color 0.15s ease;
  position: relative;
}
.cosy-app[data-layout="split-horizontal"] .cosy-splitter {
  width: 6px;
  cursor: col-resize;
}
.cosy-app[data-layout="split-vertical"] .cosy-splitter {
  height: 6px;
  cursor: row-resize;
}
.cosy-splitter:hover, .cosy-splitter.is-dragging {
  background-color: var(--accent-primary);
}
```

---

## 4. Node Ergonomics & Anatomical Architecture

Nodes are the heart of the CosyUI interface. They must convey rich information at a glance, maintain clean alignment, offer frictionless manipulation, and display real-time execution feedback.

```
+--------------------------------------------------------------+
| [O] [Icon] Node Title                       [-] [o] [x] Menu |  <- Header (Draggable)
+--------------------------------------------------------------+
| IN SOCKETS              INLINE CONTROLS          OUT SOCKETS |
|                                                              |
| (*) Trigger In                                 (*) Exec Out  |
|                                                              |
| (G) Prompt [str]       +--------------------+  (G) Response  |
|                        | Textarea input...  |                |
| (B) Temperature [num]  | [ 0.70 ] [Slider]  |  (Y) State Out |
|                        +--------------------+                |
|                                                              |
+--------------------------------------------------------------+
| Active execution glow aura: box-shadow pulse animation       |
+--------------------------------------------------------------+
```

### 4.1 Node Anatomy & Component Breakdown

1. **Node Header**:
   - **Type Color Pill / Icon**: Left-aligned icon or category badge (e.g., Orange for Event, Violet for UI, Green for Logic, Indigo for LLM).
   - **Editable Title**: Single-click focus or double-click to rename; inline editable `<span>`.
   - **Status Indicator Dot**: 6px pulsing dot (Idle = grey, Active = pulsating amber, Done = momentary green, Error = glowing red).
   - **Collapse Toggle (`[-]`/`[+]`)**: Toggles node between full view and compact socket strip.
   - **Node Action Menu (`...`)**: Duplicate, Delete, Mute/Bypass, Export Node.
2. **Node Body**:
   - **Three-Column Grid Layout**:
     - **Left Column**: Inputs with round sockets protruding 6px over the left node edge.
     - **Center Column**: Inline inputs, parameter sliders, dropdown selects, and text fields.
     - **Right Column**: Outputs with round sockets protruding 6px over the right node edge.
3. **Socket Specs & Magnetism**:
   - **Socket Diameter**: 12px circle with a 2px inner solid border and colored core matching socket type.
   - **Hover Halo**: When dragging a cable, valid target sockets expand slightly to 16px with a luminous radial drop shadow (`filter: drop-shadow(0 0 6px currentColor)`).
   - **Magnetic Snap**: When user cursor reaches within 18px of a compatible socket, the connecting bezier wire automatically snaps to center.
   - **Type Compatibility Validation**: Incompatible sockets are dimmed to 25% opacity during cable drag to prevent illegal connections.
4. **Inline Controls**:
   - Numeric inputs include custom scrubbable drag behavior (click and drag left/right to decrease/increase value).
   - Textareas auto-expand vertically up to `max-height: 240px` with a custom thin dark scrollbar.
   - Checkboxes are styled as smooth toggle switches.
5. **Execution Glow & Visual Feedback**:
   - When a node receives an execution pulse, a keyframe animation triggers:
     ```css
     @keyframes node-exec-glow {
       0% {
         box-shadow: 0 0 0 0 rgba(229, 169, 60, 0.7), var(--shadow-node);
       }
       50% {
         box-shadow: 0 0 24px 4px rgba(229, 169, 60, 0.85), var(--shadow-node);
       }
       100% {
         box-shadow: 0 0 0 0 rgba(229, 169, 60, 0), var(--shadow-node);
       }
     }
     .cosy-node.is-executing {
       animation: node-exec-glow 0.8s ease-out;
       border-color: var(--accent-warm);
     }
     ```
   - Wire flow effect: Connecting SVG path flashes an illuminated dash stroke propagating from source to target.

### 4.2 Complete CSS Specification for Nodes

```css
/* Node Container */
.cosy-node {
  position: absolute;
  min-width: var(--node-min-width);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-node);
  contain: layout style;
  cursor: default;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.cosy-node:hover {
  border-color: var(--border-hover);
}

.cosy-node.is-selected {
  border-color: var(--accent-primary);
  box-shadow: var(--shadow-node-selected);
  z-index: 25 !important;
}

/* Node Header */
.cosy-node-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--bg-surface-elev);
  border-top-left-radius: calc(var(--radius-md) - 1px);
  border-top-right-radius: calc(var(--radius-md) - 1px);
  border-bottom: 1px solid var(--border-subtle);
  cursor: grab;
}

.cosy-node-header:active {
  cursor: grabbing;
}

.cosy-node-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.cosy-node-icon {
  width: 14px;
  height: 14px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Category Accent Stripe on Headers */
.cosy-node[data-category="llm"]      .cosy-node-header { border-left: 3px solid var(--accent-primary); }
.cosy-node[data-category="game"]     .cosy-node-header { border-left: 3px solid var(--accent-warm); }
.cosy-node[data-category="ui"]       .cosy-node-header { border-left: 3px solid var(--socket-ui); }
.cosy-node[data-category="logic"]    .cosy-node-header { border-left: 3px solid var(--socket-string); }
.cosy-node[data-category="variable"] .cosy-node-header { border-left: 3px solid var(--socket-number); }

/* Node Body & Sockets */
.cosy-node-body {
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cosy-socket-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  min-height: 24px;
  padding: 0 12px;
}

.cosy-socket-input-group,
.cosy-socket-output-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cosy-socket-label {
  font-size: 12px;
  color: var(--text-muted);
}

/* Socket Plug Point */
.cosy-socket {
  width: var(--socket-size);
  height: var(--socket-size);
  border-radius: var(--radius-full);
  background-color: var(--bg-canvas);
  border: 2px solid var(--border-default);
  position: absolute;
  cursor: crosshair;
  transition: transform 0.1s ease, filter 0.15s ease;
}

.cosy-socket-in {
  left: calc(var(--socket-size) / -2);
}

.cosy-socket-out {
  right: calc(var(--socket-size) / -2);
}

.cosy-socket:hover {
  transform: scale(1.3);
}

/* Universal Socket Color Mapping */
.cosy-socket[data-type="trigger"] { border-color: var(--socket-trigger); background-color: var(--socket-trigger); }
.cosy-socket[data-type="string"]  { border-color: var(--socket-string);  background-color: var(--socket-string); }
.cosy-socket[data-type="number"]  { border-color: var(--socket-number);  background-color: var(--socket-number); }
.cosy-socket[data-type="boolean"] { border-color: var(--socket-boolean); background-color: var(--socket-boolean); }
.cosy-socket[data-type="object"]  { border-color: var(--socket-object);  background-color: var(--socket-object); }
.cosy-socket[data-type="ui"]      { border-color: var(--socket-ui);      background-color: var(--socket-ui); }
.cosy-socket[data-type="any"]     { border-color: var(--socket-wildcard); background-color: var(--socket-wildcard); }

/* Inline Controls */
.cosy-control-input {
  width: 100%;
  padding: 4px 8px;
  background-color: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  color: var(--text-main);
  font-family: var(--font-sans);
  font-size: 12px;
  box-sizing: border-box;
}

.cosy-control-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  background-color: var(--bg-input-focus);
}

/* Collapsed Node Mode */
.cosy-node.is-collapsed .cosy-node-body {
  display: none;
}
.cosy-node.is-collapsed {
  min-width: 160px;
}
```

---

## 5. Quick Search Node Palette

The quick search palette provides keyboard-first node discovery. It enables instant creation of any node without touching the mouse or navigating deep menus.

```
+--------------------------------------------------------------+
| [Search Icon] Search nodes or logic (e.g., "LLM", "Dice")... |
+--------------------------------------------------------------+
| RECENT: [OpenAI Call]  [Chatbox UI]  [Roll Dice]             |
+--------------------------------------------------------------+
| CATEGORIES                                                   |
| > LLM Runtime                                                |
|   [*] Universal LLM Prompt (OpenAI, Anthropic, Ollama)       |
|   [*] Mock LLM Tester (Offline simulator)                    |
| > Frontend UI Elements                                       |
|   [*] Story & Dialogue Box                                   |
|   [*] Interactive Chat Log                                   |
|   [*] Dynamic Stat / Health Bar                              |
|   [*] Inventory Slot Grid                                    |
|   [*] Choice Action Button                                   |
| > Game & Workflow Logic                                      |
|   [*] State Machine / Turn Manager                           |
|   [*] Dice Roller (d20, d6, NdM + Mod)                       |
|   [*] Variable Store (Number, String, Flag)                  |
|   [*] Conditional Branch (If / Else / Switch)                |
+--------------------------------------------------------------+
| [Enter] Insert Node   [↑/↓] Navigate   [Esc] Dismiss         |
+--------------------------------------------------------------+
```

### 5.1 Palette Triggering & Interaction Rules

1. **Trigger Events**:
   - `Space` bar anywhere on empty canvas (unless an input element currently has active focus).
   - `Double-Click` with mouse left button on empty canvas area.
   - `/` shortcut key.
2. **Spawn Coordinates**:
   - Appears centered directly at the mouse cursor's current canvas world position, accounting for pan offset and zoom scaling factor.
3. **Fuzzy Filter Engine**:
   - Matches against node title, category, tags, and socket input/output types (e.g. typing "text" shows nodes that output or accept strings).
4. **Keyboard Navigation Flow**:
   - `ArrowDown` / `ArrowUp`: Highlights next/previous item with active pill indicator.
   - `Enter`: Instantly spawns selected node at the click location, closes palette, and auto-focuses primary socket or parameter.
   - `Escape`: Closes palette immediately without action.

### 5.2 Palette CSS Stylesheet

```css
.cosy-search-palette {
  position: fixed;
  z-index: var(--z-search-palette);
  width: 360px;
  max-height: 480px;
  background-color: var(--bg-surface-elev);
  border: 1px solid var(--border-hover);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(8px);
}

.cosy-palette-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
}

.cosy-palette-input {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-main);
  font-size: 14px;
  font-family: var(--font-sans);
  outline: none;
}

.cosy-palette-input::placeholder {
  color: var(--text-dim);
}

.cosy-palette-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  margin: 0;
  list-style: none;
}

.cosy-palette-category-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 8px 8px 4px 8px;
  letter-spacing: 0.05em;
}

.cosy-palette-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-main);
  transition: background-color 0.1s ease;
}

.cosy-palette-item:hover,
.cosy-palette-item.is-selected {
  background-color: var(--accent-primary);
  color: #ffffff;
}

.cosy-palette-footer {
  padding: 6px 12px;
  background-color: var(--bg-input);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-dim);
}
```

---

## 6. Minimap Specification & Viewport Navigation

The minimap provides spatial awareness across massive workflow graphs, rendering a high-performance 2D radar view of all nodes and an interactive camera viewport bounding box.

```
+-----------------------------------+
| MINIMAP                       [x] |
| +-------------------------------+ |
| |        [■]                    | |
| |    +----------+               | |
| |    | Viewport |    [■]        | |
| |    |  Rect    |               | |
| |    +----------+               | |
| |  [■]           [■]            | |
| +-------------------------------+ |
| Scale: 1:12 | [Fit View] [Reset]  |
+-----------------------------------+
```

### 6.1 Minimap Design & Interaction Rules

1. **Placement**:
   - Fixed bottom-right corner of editor viewport, positioned `16px` from bottom and right edges.
   - Dimensions: Standard width `220px`, height `150px`. Expandable or collapsable with shortcut `M`.
2. **Rendering Engine**:
   - Lightweight `<canvas>` element drawn synchronously via `requestAnimationFrame`.
   - Node Simplification: Nodes are rendered as solid rounded rects with their respective category color. No expensive text rendering or socket details inside minimap.
   - Cable Simplification: Straight lines or omitted when zoomed out beyond 1:10 scale to preserve 60 FPS.
3. **Interactive Viewport Bounding Box**:
   - Semi-transparent white/indigo rectangle (`rgba(108, 92, 231, 0.25)`) with a crisp 1.5px border (`#6c5ce7`).
   - Represents the current screen camera view.
   - **Click-to-Pan**: Clicking anywhere inside the minimap instantly centers the main editor canvas at that world coordinate.
   - **Drag-to-Pan**: Dragging the viewport rectangle continuously translates the main camera view with real-time dampening.
4. **Auto-Framing Controls**:
   - Includes quick action buttons:
     - `[Fit View]`: Calculates graph bounding box and animates camera zoom/pan to encapsulate all nodes with 10% padding.
     - `[1:1 Reset]`: Resets zoom to 100% and centers on origin `(0, 0)`.

---

## 7. High-DPI Crisp Rendering & Performance Benchmarks

CosyUI guarantees butter-smooth 60 FPS performance even when running complex game state machines with 100+ nodes and dozens of animated cables.

### 7.1 High-DPI & Retina Formula

For canvas-based elements (minimap, background dot grid) and SVG overlays (bezier cables), high-DPI scaling prevents fuzzy or blurry rendering on 4K monitors and MacBook Retina screens:

```javascript
// High-DPI Canvas Scaling Formula
function configureHighDPICanvas(canvas, width, height) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;
}
```

### 7.2 Crisp Vector SVG Cables

Connecting wires are drawn on an absolute SVG overlay (`<svg class="cosy-cables-layer">`):
```css
.cosy-cables-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Mouse clicks pass through to nodes/canvas */
  z-index: var(--z-canvas-cables);
}

.cosy-cable {
  fill: none;
  stroke-width: 2.5px;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke; /* Keeps 2.5px width regardless of canvas zoom level */
  transition: stroke 0.15s ease, stroke-width 0.15s ease;
}

.cosy-cable:hover {
  stroke-width: 4px;
  cursor: pointer;
}
```

### 7.3 Performance Optimization Benchmarks

To maintain 60 FPS without lag:

1. **Hardware Acceleration**:
   - Canvas translation and zoom use pure CSS transforms:  
     `transform: translate3d(${panX}px, ${panY}px, 0) scale(${zoom});`
   - Node elements apply `will-change: transform` only during active dragging, unsetting it upon mouseup to release GPU memory.
2. **CSS Layout Containment**:
   - Every node has `contain: layout style;` set. Changes to an input inside Node A never trigger reflow in Node B or across the whole DOM tree.
3. **Viewport Culling**:
   - If a node's bounding rectangle lies outside the current viewport frustum `[0, 0, screenWidth, screenHeight]`, its DOM element receives `visibility: hidden;`. This skips style recalculations and compositing passes entirely for off-screen nodes.
4. **Event Throttling & RAF Coalescing**:
   - Pan, zoom, and mouse drag listeners never invoke heavy DOM manipulations directly on `mousemove`. Instead, coordinates are cached and flushed inside `window.requestAnimationFrame()`.
5. **Memory Footprint**:
   - Total base bundle memory footprint < 15MB.
   - Zero garbage collection pauses from unnecessary object allocations inside render loops.

---

## 8. Frontend Customizer (Player View) Aesthetic Guide

When Agent 04's UI nodes render dynamic components in the Player View, they inherit the CosyUI visual standard to ensure that user games look polished right out of the box.

### 8.1 UI Components Standard Specs

1. **Story / Dialogue Box**:
   - Deep obsidian background (`#131418`), warm amber borders (`#e5a93c`), padded narrative text with comfortable line-height (`1.65`).
   - Speaker avatar thumbnail and character title badge.
2. **Dynamic Stat & Health Bars**:
   - Rounded container with dark grooved track.
   - Smooth CSS width transitions (`transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1)`).
   - Built-in color tiers (Health = Green to Red gradient, Mana = Sky Blue, Stamina = Warm Gold).
3. **Inventory Grid**:
   - Responsive CSS Grid of `48px x 48px` or `64px x 64px` item slots.
   - Hover magnification, item count badge in bottom-right corner, rarity tier borders (Common = Slate, Rare = Blue, Epic = Purple, Legendary = Gold).
4. **Choice Action Buttons**:
   - Pill or rounded rectangular cards with subtle border highlight.
   - Hover: slight upward translation (`transform: translateY(-2px)`) with warm indigo glow.
   - Active: tactile press down (`transform: translateY(1px)`).

---

## 9. Verification & Quality Checklist for Implementers

Before any UI or graph engine code is merged, verify against this criteria:

- [ ] **Zero External Network Requests**: Confirm Network tab in DevTools shows 0 external HTTP/CDN calls.
- [ ] **Socket Color Standard Compliance**: All 6 universal types match exact hex codes (Trigger: Orange, String: Green, Number: Blue, Boolean: Pink, Object: Amber, UI: Violet).
- [ ] **60 FPS Pan & Zoom**: Pan canvas with 50+ nodes; verify frame rate stays at a solid 60 FPS.
- [ ] **High-DPI Clarity**: Inspect on high-density Retina display; confirm text and cable lines show zero pixelation or blur.
- [ ] **Keyboard Shortcuts**: Verify `Space` (Palette), `Ctrl+1/2/3` (Layout switch), `M` (Minimap toggle) operate smoothly without conflicts.
- [ ] **Responsive Resizing**: Verify split view divider drags smoothly without jumping or breaking pane content.

---
*Signed by: Agent 07 - UI/UX & CSS Aesthetics Specialist*
