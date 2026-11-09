# CosyUI — Frontend UI Customization Specification
**Document ID:** `04_UI_CUSTOMIZATION_SPEC.md`  
**Agent:** Agent 04 — Frontend UI Customizer Specialist  
**Status:** COMPLETE / SPECIFICATION READY  
**Target:** Node-Driven Visual Player Interface Customization & Reactive Two-Way Graph Binding  

---

## Table of Contents
1. [Architectural Overview & Core Philosophy](#1-architectural-overview--core-philosophy)
2. [Dual-Mode Paradigm: Editor vs Player](#2-dual-mode-paradigm-editor-vs-player)
3. [Virtual UI Hierarchy & Layout Assembly](#3-virtual-ui-hierarchy--layout-assembly)
4. [Two-Way Binding & Reactive Graph Bridge](#4-two-way-binding--reactive-graph-bridge)
5. [Detailed UI Node Specifications](#5-detailed-ui-node-specifications)
   - 5.1 [UI Container / Layout Node (`ui_container`)](#51-ui-container--layout-node-ui_container)
   - 5.2 [UI Chatbox Node (`ui_chatbox`)](#52-ui-chatbox-node-ui_chatbox)
   - 5.3 [UI Stat Bar / Gauge Node (`ui_stat_bar`)](#53-ui-stat-bar--gauge-node-ui_stat_bar)
   - 5.4 [UI Inventory / Grid Node (`ui_inventory_grid`)](#54-ui-inventory--grid-node-ui_inventory_grid)
   - 5.5 [UI Choice Buttons Node (`ui_choice_buttons`)](#55-ui-choice-buttons-node-ui_choice_buttons)
   - 5.6 [UI Story / Narrative Box Node (`ui_story_box`)](#56-ui-story--narrative-box-node-ui_story_box)
   - 5.7 [UI Theme Customizer Node (`ui_theme_customizer`)](#57-ui-theme-customizer-node-ui_theme_customizer)
6. [Design System & Theme Tokens](#6-design-system--theme-tokens)
7. [DOM Lifecycle & 60 FPS Performance Guarantee](#7-dom-lifecycle--60-fps-performance-guarantee)
8. [Standalone Export & Headless Player Mounting](#8-standalone-export--headless-player-mounting)
9. [Integration Interfaces with Other Agents](#9-integration-interfaces-with-other-agents)

---

## 1. Architectural Overview & Core Philosophy

In traditional game engines or web apps, UI development requires writing template code (React, Vue, HTML/CSS) separate from logic. **CosyUI flips this model:**
> **The player interface itself is a live, reactive projection of graph nodes.**

### Core Tenets
1. **Zero External Dependencies**: 100% vanilla JavaScript (ES2022+), CSS Custom Properties, and native DOM APIs. No React, no Tailwind CDN, no npm bloat.
2. **Visual Layout Assembly**: Creators place and link UI nodes on the graph canvas (e.g., nesting a `Stat Bar` inside a `Container`, or wiring an `LLM Streamer` output directly to a `Chatbox`).
3. **Strict Data-Down, Triggers-Up Flow**:
   - **Data-Down (Graph → UI)**: Node data ports supply dynamic text, numerical metrics, arrays of inventory items, choices, or streaming token chunks.
   - **Triggers-Up (UI → Graph)**: User interactions (button clicks, chat submissions, item clicks) fire output execution pulses with event payloads back into the graph scheduler.
4. **Deterministic Rendering**: The entire Player UI can be re-rendered cleanly from graph state snapshot at any time without visual artifacts or memory leaks.

---

## 2. Dual-Mode Paradigm: Editor vs Player

CosyUI provides three viewing configurations seamlessly switchable via the top navigation bar or keyboard shortcuts:

```
+-----------------------------------------------------------------------------------------+
| [CosyUI]  [Project: Cyberpunk RPG v1]   (Mode: [Graph Canvas] [Split View] [Player Mode]) |
+-----------------------------------------------------------------------------------------+
|                              SPLIT VIEW MODE (Default)                                  |
| +-----------------------------------------+ +-----------------------------------------+ |
| |        GRAPH CANVAS (Left Pane)         | |       PLAYER INTERFACE (Right Pane)     | |
| |                                         | |                                         | |
| |  [LLM Node] ---> [UI Story Box]         | |  +-----------------------------------+  | |
| |         \                               | |  | Story Box                         |  | |
| |          \--> [UI Choice Buttons] ----> | |  | "The neon rain slickers the..."   |  | |
| |                                   |     | |  +-----------------------------------+  | |
| |  [Variable: HP] -> [UI Stat Bar]  |     | |  | [ Choice 1: Jack into terminal ] |  | |
| |                                   v     | |  | [ Choice 2: Slip into alleys   ] |  | |
| |                       (Trigger on click)| |  +-----------------------------------+  | |
| |                                         | |  | HP [====================] 100/100 |  | |
| +-----------------------------------------+ +-----------------------------------------+ |
+-----------------------------------------------------------------------------------------+
```

1. **Graph Canvas Mode (`view-graph`)**: Fullscreen node editor canvas with bezier connections, minimap, node inspector, and palette. UI nodes show live mini-previews in their card body.
2. **Split View Mode (`view-split`)**: Left side shows graph canvas with real-time active execution pulses; right side renders the live Player Interface in a responsive sandbox panel.
3. **Player Mode (`view-player`)**: The graph editor is hidden. The entire window becomes the responsive player viewport, matching what the end-player sees when running standalone games or tools.

---

## 3. Virtual UI Hierarchy & Layout Assembly

UI layout in CosyUI is declarative and hierarchical. Every UI node represents either a **Layout Container** (a parent flex/grid element) or a **Leaf UI Element** (chat, gauge, button group, story box).

### 3.1 Parent-Child Relationship Mechanisms
CosyUI supports two intuitive wiring strategies for composition:

#### Strategy A: Direct Hierarchy Sockets (Visual Cable Binding)
- Every UI node has an input port: `parent_container` (Type: `UI_CONTAINER`).
- `UI Container` nodes have an output port: `container_slot` (Type: `UI_CONTAINER`).
- Connecting `Container A [slot]` to `Chatbox [parent_container]` mounts the chatbox inside Container A's DOM tree.

#### Strategy B: Target Slot ID / Region Binding (Property Inspector)
- Containers expose named regions (`header`, `main`, `sidebar`, `footer`, or slot indices `slot_0`, `slot_1`, etc.).
- UI elements can specify their target container ID or mount region in their property dropdown.
- If unassigned, UI nodes automatically flow into the default `#cosy-player-root` layout in canvas order or user-defined sort order.

### 3.2 UI Render Tree Model
```javascript
// Internal Virtual UI Tree Representation
{
  id: "ui_root",
  type: "container",
  props: { direction: "row", gap: "16px", padding: "16px" },
  children: [
    {
      id: "node_sidebar",
      type: "ui_container",
      props: { width: "280px", direction: "column", gap: "12px" },
      children: [
        { id: "node_hp_bar", type: "ui_stat_bar", targetSlot: "top" },
        { id: "node_inventory", type: "ui_inventory_grid", targetSlot: "center" }
      ]
    },
    {
      id: "node_main_pane",
      type: "ui_container",
      props: { flex: "1", direction: "column", gap: "16px" },
      children: [
        { id: "node_story", type: "ui_story_box", targetSlot: "main" },
        { id: "node_choices", type: "ui_choice_buttons", targetSlot: "bottom" }
      ]
    }
  ]
}
```

---

## 4. Two-Way Binding & Reactive Graph Bridge

The communication bridge between the Graph Execution Engine and the DOM Player View operates on a high-speed, decoupled Event-Bus and State Store:

```
+---------------------------------------------------------------------------+
|                          GRAPH EXECUTION ENGINE                           |
+---------------------------------------------------------------------------+
         |                                                 ^
         | [1] Data Push / Token Stream                    | [4] Action Trigger Pulse
         v                                                 |     (on_click, on_submit)
+---------------------------------------------------------------------------+
|                       COSY UI REACTIVE BRIDGE (Store)                     |
|  - Channel: Port signals & State Subscriptions                           |
|  - Batching: requestAnimationFrame DOM update queue                      |
|  - Loop Guard: Timestamped trigger deduplication                         |
+---------------------------------------------------------------------------+
         |                                                 ^
         | [2] DOM Mutation / Style Update                 | [3] Native DOM Event
         v                                                 |     (click, keydown, drag)
+---------------------------------------------------------------------------+
|                          PLAYER VIEWPORT (DOM)                            |
+---------------------------------------------------------------------------+
```

### 4.1 Data-Down Flow (Engine → UI)
1. **Discrete Port Updates**: When a graph node produces an output (e.g. `Math: HP -> 75`), the engine emits `signal(targetNodeId, portId, value)`.
2. **Streaming Port Updates**: When an LLM node streams tokens, it emits `stream_chunk(targetNodeId, portId, token, isDone)`. The UI Chatbox or Story Box appends chunks immediately without re-rendering the full message list.
3. **Dirty-Flag Scheduling**: Updates are batched into a microtask queue and flushed during `requestAnimationFrame`. If a stat bar updates 50 times in one tick, it renders only once on the next animation frame.

### 4.2 Triggers-Up Flow (UI → Engine)
1. User clicks Choice Button #2 ("Search the room").
2. The UI node intercepts the event, formats the payload:
   ```javascript
   {
     trigger: "on_choice_selected",
     choiceIndex: 1,
     choiceText: "Search the room",
     choiceValue: "opt_search_room",
     timestamp: performance.now()
   }
   ```
3. The bridge calls `GraphEngine.triggerOutput(nodeId, "on_choice_selected", payload)`.
4. Downstream connected nodes (e.g. LLM Prompt Template or State Machine) awaken and execute immediately.

### 4.3 Circular Loop & Echo Prevention
To avoid infinite cascades (e.g., Graph sets Input text -> Input fires change event -> Graph sets Input text):
- Every event carries an `origin` flag (`"user_input"` vs `"graph_signal"`).
- UI elements suppress firing output triggers when their value is mutated via an incoming graph port signal. Only direct user interactions (pointer/keyboard) dispatch output pulses.

---

## 5. Detailed UI Node Specifications

---

### 5.1 UI Container / Layout Node (`ui_container`)

#### Overview
Defines a structural layout box in the player interface. Organizes child UI components into responsive rows, columns, or CSS grids with custom spacing, background styling, borders, and scrolling rules.

#### Port Definitions
| Direction | Port Name | Data Type | Description |
|---|---|---|---|
| **Input** | `parent` | `UI_CONTAINER` | Optional parent container socket for recursive nesting. |
| **Input** | `visible` | `BOOLEAN` | Shows or hides this container and all its children dynamically. |
| **Input** | `title` | `STRING` | Optional panel header title bar. |
| **Input** | `set_active_tab` | `INTEGER` | When in Tab mode, switches active view tab. |
| **Output** | `slot_out` | `UI_CONTAINER` | Outlet socket to wire child UI nodes into this container. |
| **Output** | `on_click` | `TRIGGER` | Trigger pulse fired if the container itself is clicked. |

#### Node Inspector Properties (Config Schema)
```json
{
  "layoutType": { "type": "enum", "options": ["flex_column", "flex_row", "grid", "tabs", "split_pane"], "default": "flex_column" },
  "gridColumns": { "type": "string", "default": "repeat(auto-fit, minmax(200px, 1fr))" },
  "gap": { "type": "string", "default": "12px" },
  "padding": { "type": "string", "default": "16px" },
  "bgStyle": { "type": "enum", "options": ["glass", "solid", "transparent", "sunken", "accent_bordered"], "default": "glass" },
  "borderRadius": { "type": "string", "default": "var(--cosy-radius-md)" },
  "overflow": { "type": "enum", "options": ["hidden", "auto", "visible", "scroll_y"], "default": "auto" },
  "width": { "type": "string", "default": "100%" },
  "height": { "type": "string", "default": "auto" },
  "alignItems": { "type": "enum", "options": ["stretch", "flex-start", "center", "flex-end"], "default": "stretch" },
  "justifyContent": { "type": "enum", "options": ["flex-start", "center", "space-between", "space-around"], "default": "flex-start" }
}
```

#### DOM & CSS Structure
```html
<div class="cosy-ui-container cosy-bg-glass" id="cosy-container-{nodeId}" style="--cosy-gap: 12px; --cosy-padding: 16px;">
  <!-- Optional Header -->
  <div class="cosy-container-header">
    <span class="cosy-container-title">Character Stats</span>
  </div>
  <!-- Child Mounting Region -->
  <div class="cosy-container-slot cosy-layout-flex-column">
    <!-- Child UI Nodes mount here -->
  </div>
</div>
```

---

### 5.2 UI Chatbox Node (`ui_chatbox`)

#### Overview
A complete conversational dialogue interface. Features full chat history, distinct user and assistant speech bubbles, avatar rendering, live animated typing indicator, auto-scroll with user scroll lock, token-by-token message streaming, and action buttons embedded inside messages.

#### Port Definitions
| Direction | Port Name | Data Type | Description |
|---|---|---|---|
| **Input** | `append_message` | `OBJECT` | Appends a structured message `{ role: 'user'|'assistant', content: '...', sender: '...', avatar: '...' }`. |
| **Input** | `stream_chunk` | `STRING` | Appends streaming token chunks to the latest assistant message. |
| **Input** | `finish_stream` | `TRIGGER` | Marks current streaming assistant message complete. |
| **Input** | `set_typing` | `BOOLEAN` | Shows/hides animated "Assistant is thinking..." typing indicator. |
| **Input** | `clear_history` | `TRIGGER` | Clears all chat history. |
| **Input** | `parent` | `UI_CONTAINER` | Target container socket. |
| **Output** | `on_user_submit` | `TRIGGER` | Fired when player presses Enter or clicks Send. |
| **Output** | `user_message` | `STRING` | The text content submitted by the player. |
| **Output** | `on_action_click` | `TRIGGER` | Fired if user clicks an inline choice/action badge inside a message bubble. |
| **Output** | `action_payload` | `ANY` | Data payload associated with the clicked inline action badge. |

#### Node Inspector Properties
```json
{
  "placeholder": { "type": "string", "default": "Type your message or action here... (Enter to send)" },
  "userAvatar": { "type": "string", "default": "👤" },
  "assistantAvatar": { "type": "string", "default": "🤖" },
  "userName": { "type": "string", "default": "Player" },
  "assistantName": { "type": "string", "default": "Cosy Companion" },
  "autoScroll": { "type": "boolean", "default": true },
  "allowMarkdown": { "type": "boolean", "default": true },
  "showTimestamp": { "type": "boolean", "default": true },
  "inputMode": { "type": "enum", "options": ["single_line", "multiline_auto_expand"], "default": "multiline_auto_expand" },
  "maxHistoryLength": { "type": "number", "default": 100 }
}
```

#### Bubble & Typing DOM Structure
```html
<div class="cosy-chatbox-wrapper" id="cosy-chat-{nodeId}">
  <!-- Message Feed -->
  <div class="cosy-chat-messages" role="log" aria-live="polite">
    <!-- Assistant Message -->
    <div class="cosy-message-row cosy-msg-assistant">
      <div class="cosy-avatar" title="Cosy Companion">🤖</div>
      <div class="cosy-message-content">
        <div class="cosy-message-meta">
          <span class="cosy-sender-name">Cosy Companion</span>
          <span class="cosy-timestamp">12:45 PM</span>
        </div>
        <div class="cosy-bubble cosy-bubble-assistant">
          You step into the candlelit tavern. The smell of spiced cider fills the air.
        </div>
      </div>
    </div>

    <!-- User Message -->
    <div class="cosy-message-row cosy-msg-user">
      <div class="cosy-message-content">
        <div class="cosy-message-meta">
          <span class="cosy-sender-name">Player</span>
          <span class="cosy-timestamp">12:46 PM</span>
        </div>
        <div class="cosy-bubble cosy-bubble-user">
          I want to approach the hooded stranger in the corner.
        </div>
      </div>
      <div class="cosy-avatar" title="Player">👤</div>
    </div>

    <!-- Live Typing Indicator -->
    <div class="cosy-typing-indicator" style="display: flex;">
      <div class="cosy-avatar">🤖</div>
      <div class="cosy-typing-bubble">
        <span class="cosy-dot"></span>
        <span class="cosy-dot"></span>
        <span class="cosy-dot"></span>
      </div>
    </div>
  </div>

  <!-- Input Bar -->
  <div class="cosy-chat-input-bar">
    <textarea class="cosy-chat-textarea" placeholder="Type your message..." rows="1"></textarea>
    <button class="cosy-btn cosy-btn-primary cosy-chat-send" title="Send message (Enter)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
    </button>
  </div>
</div>
```

---

### 5.3 UI Stat Bar / Gauge Node (`ui_stat_bar`)

#### Overview
Renders dynamic numerical gauges, resource bars, and meters (HP, Mana, Stamina, Energy, XP, Gold, Sanity, Threat). Supports smooth CSS cubic-bezier animation on value change, secondary damage-ghost bars (flashing previous value), color transitions, customizable icon badges, and warning states.

#### Port Definitions
| Direction | Port Name | Data Type | Description |
|---|---|---|---|
| **Input** | `value` | `NUMBER` | Current stat value. |
| **Input** | `max_value` | `NUMBER` | Maximum stat capacity (e.g. 100). |
| **Input** | `label` | `STRING` | Dynamic label override (defaults to node config). |
| **Input** | `color` | `STRING` | Dynamic hex/CSS color override. |
| **Input** | `parent` | `UI_CONTAINER` | Target container socket. |
| **Output** | `on_change` | `TRIGGER` | Fired whenever the value changes. |
| **Output** | `on_depleted` | `TRIGGER` | Fired when value reaches <= 0 (e.g. Game Over trigger). |
| **Output** | `on_full` | `TRIGGER` | Fired when value reaches >= max_value (e.g. Level Up trigger). |
| **Output** | `normalized_pct` | `NUMBER` | Float 0.0 to 1.0 representing percentage fill. |

#### Node Inspector Properties
```json
{
  "preset": { "type": "enum", "options": ["hp", "mana", "energy", "gold", "sanity", "custom"], "default": "hp" },
  "label": { "type": "string", "default": "Health" },
  "icon": { "type": "string", "default": "❤️" },
  "displayFormat": { "type": "enum", "options": ["val_max", "percentage", "val_only", "compact_k"], "default": "val_max" },
  "barStyle": { "type": "enum", "options": ["solid", "gradient", "segmented", "glow_neon"], "default": "gradient" },
  "fillColor": { "type": "color", "default": "#ef4444" },
  "ghostBarColor": { "type": "color", "default": "rgba(239, 68, 68, 0.4)" },
  "height": { "type": "string", "default": "20px" },
  "showNumberOverlay": { "type": "boolean", "default": true },
  "animateDurationMs": { "type": "number", "default": 400 },
  "lowWarningThreshold": { "type": "number", "default": 0.25 }
}
```

#### Visual Behavior & Ghost Bar Damage Animation
When `value` decreases from 100 to 70:
1. The **foreground bar** snaps smoothly to 70% in 200ms.
2. The **ghost bar** (semi-transparent red trailing bar) pauses for 300ms, then slides down to 70% over 500ms, giving an authentic RPG hit-reaction.
3. If value drops below `lowWarningThreshold` (25%), the bar adds class `.cosy-stat-pulse-critical` with an alert glow.

#### DOM Structure
```html
<div class="cosy-stat-bar-container" id="cosy-stat-{nodeId}">
  <div class="cosy-stat-header">
    <span class="cosy-stat-label"><span class="cosy-stat-icon">❤️</span> Health</span>
    <span class="cosy-stat-numbers">75 / 100</span>
  </div>
  <div class="cosy-stat-track">
    <div class="cosy-stat-ghost-fill" style="width: 90%;"></div>
    <div class="cosy-stat-fill" style="width: 75%; background: var(--stat-fill-color, #ef4444);"></div>
  </div>
</div>
```

---

### 5.4 UI Inventory / Grid Node (`ui_inventory_grid`)

#### Overview
A slot-based interactive inventory and equipment grid. Displays item icons, item names, quantity badges, rarity border glows, and rich hover tooltips. Dispatches high-fidelity click, double-click, and drag/drop triggers back into the graph.

#### Port Definitions
| Direction | Port Name | Data Type | Description |
|---|---|---|---|
| **Input** | `items` | `ARRAY` | Complete array of item objects (replaces or reconciles inventory). |
| **Input** | `add_item` | `OBJECT` | Appends a single item `{ id, name, icon, quantity, rarity, desc }`. |
| **Input** | `remove_item_id` | `STRING` | Decrements or removes item by unique ID. |
| **Input** | `select_slot` | `INTEGER` | Programmatically selects slot index. |
| **Input** | `parent` | `UI_CONTAINER` | Target container socket. |
| **Output** | `on_item_click` | `TRIGGER` | Fired when player single-clicks an item slot. |
| **Output** | `on_item_use` | `TRIGGER` | Fired on double-click or "Use" button click. |
| **Output** | `selected_item` | `OBJECT` | Data payload of clicked/selected item. |
| **Output** | `selected_item_id` | `STRING` | ID string of clicked/selected item. |

#### Item Data Object Schema
```json
{
  "id": "healing_potion_minor",
  "name": "Minor Health Potion",
  "icon": "🧪",
  "quantity": 3,
  "rarity": "common",
  "description": "Restores 25 Health Points when consumed.",
  "category": "consumable",
  "weight": 0.5,
  "stats": { "heal": 25 }
}
```

#### Node Inspector Properties
```json
{
  "totalSlots": { "type": "number", "default": 16 },
  "columns": { "type": "number", "default": 4 },
  "slotSize": { "type": "string", "default": "60px" },
  "showEmptySlots": { "type": "boolean", "default": true },
  "showTooltips": { "type": "boolean", "default": true },
  "allowSelection": { "type": "boolean", "default": true },
  "rarityColors": {
    "type": "object",
    "default": {
      "common": "#94a3b8",
      "uncommon": "#22c55e",
      "rare": "#3b82f6",
      "epic": "#a855f7",
      "legendary": "#f59e0b"
    }
  }
}
```

#### DOM Structure
```html
<div class="cosy-inventory-grid" id="cosy-inv-{nodeId}" style="--inv-cols: 4; --slot-size: 60px;">
  <!-- Slot with Item -->
  <div class="cosy-inv-slot cosy-rarity-rare is-selected" data-item-id="potion_01" tabindex="0">
    <div class="cosy-item-icon">🧪</div>
    <span class="cosy-item-qty">3</span>
    <!-- Rich Floating Tooltip (CSS + Hover) -->
    <div class="cosy-item-tooltip">
      <div class="cosy-tooltip-title cosy-text-rare">Minor Health Potion</div>
      <div class="cosy-tooltip-meta">Consumable · Weight: 0.5kg</div>
      <div class="cosy-tooltip-desc">Restores 25 Health Points when consumed.</div>
      <div class="cosy-tooltip-hint">Double click to use</div>
    </div>
  </div>

  <!-- Empty Slot -->
  <div class="cosy-inv-slot is-empty"></div>
</div>
```

---

### 5.5 UI Choice Buttons Node (`ui_choice_buttons`)

#### Overview
Renders dynamic action choices or dialogue options. Designed for branching interactive fiction, RPG combat menus, and tool command bars. Receives dynamic choice lists from LLM outputs or game state nodes, and emits trigger pulses containing the player's selected option.

#### Port Definitions
| Direction | Port Name | Data Type | Description |
|---|---|---|---|
| **Input** | `choices` | `ARRAY` | Array of strings `["Option A", "Option B"]` or objects `[{ label, value, icon, disabled, badge }]`. |
| **Input** | `disabled` | `BOOLEAN` | Locks all buttons (e.g. while LLM is generating response). |
| **Input** | `clear` | `TRIGGER` | Clears all active choice buttons. |
| **Input** | `parent` | `UI_CONTAINER` | Target container socket. |
| **Output** | `on_choice_selected` | `TRIGGER` | Fired when any choice button is clicked. |
| **Output** | `selected_text` | `STRING` | The label text of the chosen button. |
| **Output** | `selected_value` | `ANY` | The value/identifier associated with the chosen button. |
| **Output** | `selected_index` | `INTEGER` | 0-based index of chosen button. |

#### Node Inspector Properties
```json
{
  "layout": { "type": "enum", "options": ["vertical_stack", "horizontal_wrap", "grid_2col", "grid_3col"], "default": "vertical_stack" },
  "variant": { "type": "enum", "options": ["cosy_warm", "glow_outline", "solid_flat", "subtle_ghost"], "default": "cosy_warm" },
  "enableHotkeys": { "type": "boolean", "default": true },
  "autoDisableOnClick": { "type": "boolean", "default": true },
  "buttonAnimation": { "type": "enum", "options": ["fade_slide_up", "pop_in", "instant"], "default": "fade_slide_up" }
}
```

#### Keyboard Hotkey Binding
When `enableHotkeys` is true, buttons display numeric badges `[1]`, `[2]`, `[3]`, etc. Pressing key `1` on the keyboard automatically triggers option 1, providing lightning-fast gameplay for keyboard enthusiasts.

#### DOM Structure
```html
<div class="cosy-choice-group cosy-choice-stack" id="cosy-choices-{nodeId}">
  <button class="cosy-choice-btn cosy-btn-variant-cosy" data-index="0" data-value="investigate">
    <span class="cosy-hotkey-badge">1</span>
    <span class="cosy-choice-label">Investigate the strange glowing runes on the wall</span>
  </button>
  <button class="cosy-choice-btn cosy-btn-variant-cosy" data-index="1" data-value="flee">
    <span class="cosy-hotkey-badge">2</span>
    <span class="cosy-choice-label">Turn around and sprint back down the corridor</span>
  </button>
</div>
```

---

### 5.6 UI Story / Narrative Box Node (`ui_story_box`)

#### Overview
Dedicated visual narrative container for formatted prose, story segments, scene descriptions, and dialogue logs. Features authentic **Typewriter Effect** with adjustable speed, instant skip-to-end on click, sound effect hooks, markdown formatting (bold, italic, quotes), and scene header image integration.

#### Port Definitions
| Direction | Port Name | Data Type | Description |
|---|---|---|---|
| **Input** | `text` | `STRING` | The narrative text to display or stream. |
| **Input** | `append_mode` | `BOOLEAN` | If `true`, appends to existing text; if `false`, replaces text. |
| **Input** | `header_image_url`| `STRING` | Optional URL for an ambient scene / portrait banner at top of box. |
| **Input** | `typewriter_speed`| `NUMBER` | Speed in characters per second (0 = instant render). |
| **Input** | `clear` | `TRIGGER` | Clears story content. |
| **Input** | `parent` | `UI_CONTAINER` | Target container socket. |
| **Output** | `on_typing_finished`| `TRIGGER` | Fired when typewriter printing finishes. |
| **Output** | `on_click` | `TRIGGER` | Fired when player clicks story box (useful for "Click to continue"). |

#### Typewriter Engine Algorithm
```javascript
class TypewriterRenderer {
  constructor(element, onComplete) {
    this.el = element;
    this.onComplete = onComplete;
    this.timer = null;
    this.fullText = "";
    this.currentIndex = 0;
    this.isTyping = false;
  }

  type(text, cps = 35) {
    this.stop();
    this.fullText = text;
    this.currentIndex = 0;
    this.isTyping = true;
    this.el.innerHTML = '<span class="cosy-typed-content"></span><span class="cosy-type-cursor">|</span>';
    const contentSpan = this.el.querySelector('.cosy-typed-content');

    const interval = Math.max(10, Math.floor(1000 / cps));

    const step = () => {
      if (this.currentIndex >= this.fullText.length) {
        this.finish();
        return;
      }
      const char = this.fullText[this.currentIndex++];
      contentSpan.textContent += char;
      
      // Natural cadence pauses for punctuation
      let delay = interval;
      if (char === '.' || char === '!' || char === '?') delay = interval * 6;
      else if (char === ',' || char === ';' || char === ':') delay = interval * 3;

      this.timer = setTimeout(step, delay);
    };

    step();
  }

  finish() {
    this.stop();
    this.el.innerHTML = `<span class="cosy-typed-content">${this.escapeAndFormat(this.fullText)}</span>`;
    this.isTyping = false;
    if (this.onComplete) this.onComplete();
  }

  skip() {
    if (this.isTyping) this.finish();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  escapeAndFormat(raw) {
    // Lightweight inline markdown (bold, italic, line breaks)
    return raw
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }
}
```

---

### 5.7 UI Theme Customizer Node (`ui_theme_customizer`)

#### Overview
Controls the visual styling, color palette, typography, border radius, and ambient aesthetic of the entire Player Interface at runtime. Enables creators to switch themes dynamically via graph signals (e.g. entering a dark cave switches to Cyberpunk Neon or Dark Cosy; finding an ancient scroll switches to Fantasy Parchment).

#### Port Definitions
| Direction | Port Name | Data Type | Description |
|---|---|---|---|
| **Input** | `theme_name` | `STRING` | Selects preset: `'cosy'`, `'cyberpunk'`, `'fantasy'`, `'minimalist'`. |
| **Input** | `custom_overrides` | `OBJECT` | Key-value dictionary of CSS variable overrides. |
| **Input** | `apply_theme` | `TRIGGER` | Trigger pulse to immediately apply theme changes. |
| **Output** | `on_theme_applied` | `TRIGGER` | Fired when theme has been updated in the DOM. |
| **Output** | `active_theme` | `STRING` | Current active theme key. |

---

## 6. Design System & Theme Tokens

CosyUI features 4 built-in, highly refined theme token sets defined exclusively via CSS Custom Properties. Switching a theme takes **1 DOM operation** by modifying the `data-cosy-theme` attribute on `#cosy-player-root`:

### 6.1 Theme Token Definitions

#### 1. Dark Cosy (`theme-cosy` - Default)
*A warm, comforting, fireplace-lit aesthetic designed for deep immersion and long sessions.*
```css
[data-cosy-theme="cosy"] {
  --cosy-bg-app: #181614;
  --cosy-bg-panel: rgba(36, 32, 28, 0.85);
  --cosy-bg-card: #2c2722;
  --cosy-bg-input: #201c18;
  --cosy-border: #443c34;
  --cosy-border-focus: #d97706;
  --cosy-text-primary: #fef3c7;
  --cosy-text-secondary: #d6cbba;
  --cosy-text-muted: #8e8273;
  --cosy-accent: #f59e0b;
  --cosy-accent-hover: #fbbf24;
  --cosy-accent-glow: rgba(245, 158, 11, 0.25);
  --cosy-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --cosy-font-narrative: 'Merriweather', Georgia, serif;
  --cosy-radius-sm: 6px;
  --cosy-radius-md: 12px;
  --cosy-radius-lg: 18px;
  --cosy-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  --cosy-backdrop-blur: 12px;
}
```

#### 2. Cyberpunk Neon (`theme-cyberpunk`)
*Obsidian black, vivid electric cyan and neon magenta, sharp technical edges, and scanline glows.*
```css
[data-cosy-theme="cyberpunk"] {
  --cosy-bg-app: #090a0f;
  --cosy-bg-panel: rgba(18, 20, 32, 0.90);
  --cosy-bg-card: #151828;
  --cosy-bg-input: #0d0f1a;
  --cosy-border: #00f0ff;
  --cosy-border-focus: #ff0055;
  --cosy-text-primary: #e0f8ff;
  --cosy-text-secondary: #00f0ff;
  --cosy-text-muted: #5e6b8c;
  --cosy-accent: #ff0055;
  --cosy-accent-hover: #ff3377;
  --cosy-accent-glow: 0 0 15px rgba(0, 240, 255, 0.5), 0 0 30px rgba(255, 0, 85, 0.3);
  --cosy-font-family: 'JetBrains Mono', 'Fira Code', monospace;
  --cosy-font-narrative: 'JetBrains Mono', monospace;
  --cosy-radius-sm: 2px;
  --cosy-radius-md: 4px;
  --cosy-radius-lg: 6px;
  --cosy-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
  --cosy-backdrop-blur: 8px;
}
```

#### 3. Fantasy Parchment (`theme-fantasy`)
*Warm antiqued vellum, sepia tones, illuminated manuscript styling, and vintage serif typography.*
```css
[data-cosy-theme="fantasy"] {
  --cosy-bg-app: #e8dcbf;
  --cosy-bg-panel: rgba(244, 236, 216, 0.92);
  --cosy-bg-card: #dfceaa;
  --cosy-bg-input: #eee3cd;
  --cosy-border: #8b6b43;
  --cosy-border-focus: #8b2500;
  --cosy-text-primary: #2b1d0c;
  --cosy-text-secondary: #573e21;
  --cosy-text-muted: #8a7155;
  --cosy-accent: #8b2500;
  --cosy-accent-hover: #a53208;
  --cosy-accent-glow: rgba(139, 37, 0, 0.2);
  --cosy-font-family: 'Cinzel', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
  --cosy-font-narrative: 'Cinzel', Georgia, serif;
  --cosy-radius-sm: 4px;
  --cosy-radius-md: 8px;
  --cosy-radius-lg: 14px;
  --cosy-shadow: 0 4px 18px rgba(71, 47, 18, 0.25);
  --cosy-backdrop-blur: 4px;
}
```

#### 4. Modern Minimalist (`theme-minimalist`)
*High-precision monochrome slate/zinc, deep blacks, crisp neutral whites, subtle borders, and blur glassmorphism.*
```css
[data-cosy-theme="minimalist"] {
  --cosy-bg-app: #0b0f17;
  --cosy-bg-panel: rgba(17, 24, 39, 0.75);
  --cosy-bg-card: #1f2937;
  --cosy-bg-input: #111827;
  --cosy-border: #374151;
  --cosy-border-focus: #6366f1;
  --cosy-text-primary: #f9fafb;
  --cosy-text-secondary: #9ca3af;
  --cosy-text-muted: #6b7280;
  --cosy-accent: #6366f1;
  --cosy-accent-hover: #818cf8;
  --cosy-accent-glow: rgba(99, 102, 241, 0.3);
  --cosy-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --cosy-font-narrative: -apple-system, BlinkMacSystemFont, sans-serif;
  --cosy-radius-sm: 8px;
  --cosy-radius-md: 14px;
  --cosy-radius-lg: 20px;
  --cosy-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  --cosy-backdrop-blur: 16px;
}
```

---

## 7. DOM Lifecycle & 60 FPS Performance Guarantee

To prevent jank, UI updates must adhere to strict browser rendering performance standards:

### 7.1 Component Lifecycle Protocol
Every UI Node implements a standard lightweight contract:
```javascript
class BaseUIComponent {
  constructor(nodeId, config, bridge) {
    this.nodeId = nodeId;
    this.config = config;
    this.bridge = bridge;
    this.domElement = null;
    this.isMounted = false;
  }

  // 1. Initial DOM creation
  mount(parentElement) {
    this.domElement = this.render();
    parentElement.appendChild(this.domElement);
    this.bindEvents();
    this.isMounted = true;
  }

  // 2. Incoming Graph Signal / Port Update
  onPortSignal(portName, value) {
    // Schedule update via requestAnimationFrame
  }

  // 3. User Interaction -> Graph Output Trigger
  emitTrigger(outputPortName, payload) {
    this.bridge.dispatchTrigger(this.nodeId, outputPortName, payload);
  }

  // 4. Teardown
  destroy() {
    if (this.domElement && this.domElement.parentNode) {
      this.domElement.parentNode.removeChild(this.domElement);
    }
    this.isMounted = false;
  }
}
```

### 7.2 Performance Rules
1. **No Layout Thrashing**: Never read DOM dimensions (`offsetWidth`, `clientHeight`) in the same tick as writing styles.
2. **CSS Transform & Opacity Only for Animations**: All stat bar transitions, typing cursors, and choice button fades use hardware-accelerated CSS properties (`transform: scaleX(...)`, `opacity`).
3. **Passive Event Listeners**: Chatbox scroll containers use `{ passive: true }` scroll event listeners to ensure butter-smooth 60fps touchpad scrolling.
4. **DocumentFragment Batching**: Populating inventory grids or choice button lists inserts all elements via a single `DocumentFragment`, preventing multiple browser recalculate-style passes.

---

## 8. Standalone Export & Headless Player Mounting

One of CosyUI's signature features is **"Export as Standalone Runnable HTML Game"**:
- When the user selects "Export Standalone", Agent 06 packages the entire project into a self-contained `.html` file.
- In this standalone file, the Graph Canvas editor code is completely omitted or turned off.
- The UI Engine mounts directly into document `<body>`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CosyUI Adventure</title>
  <style>
    /* Inlined CosyUI Base CSS + Theme Styles */
  </style>
</head>
<body data-cosy-theme="cosy">
  <main id="cosy-player-root" class="cosy-fullscreen-player"></main>
  <script>
    // Inlined Mini Graph Runtime + UI Node Components + Project JSON
    const project = /* __PROJECT_DATA_JSON__ */;
    CosyPlayerRuntime.mount(document.getElementById('cosy-player-root'), project);
  </script>
</body>
</html>
```

---

## 9. Integration Interfaces with Other Agents

| Target Agent | Integration Touchpoint | Specification Agreement |
|---|---|---|
| **Agent 01 (Lead Architect)** | Data schemas & port registry | UI node types (`ui_*`) registered in global node registry with typed sockets (`UI_CONTAINER`, `TRIGGER`, `STRING`, `NUMBER`, `ARRAY`). |
| **Agent 02 (Graph Engine)** | Node visual representations | UI nodes on canvas render a compact mini-preview widget in their body card (e.g. mini healthbar, mini choice buttons). |
| **Agent 03 (LLM Runtime)** | Streaming token consumption | `UI Chatbox` and `UI Story Box` listen to `stream_chunk` and `finish_stream` events directly from LLM streaming outputs. |
| **Agent 05 (Game Logic)** | State machine & inventory math | Game logic nodes (Dice, Variable, State Machine) drive `Stat Bar` values and `Inventory Grid` arrays via standard data ports. |
| **Agent 06 (Storage & Export)**| Serialization & Export | UI node layout positions, theme configurations, and custom tokens serialize cleanly into standard project JSON. |
| **Agent 07 (UI/UX Designer)** | Design system synchronization | Theme CSS tokens and glassmorphism classes match Agent 07's global design system. |
| **Agent 08 (Code Auditor)** | XSS and loop protection | All user & LLM text rendered in chat/story boxes is sanitized (safe textContent/DOMParser) to prevent script injection. |
| **Agent 09 (QA Engineer)** | Test hooks | All interactive UI elements expose `data-node-id` and `data-port` attributes for automated headless simulation testing. |

---

*Specification finalized and ready for core implementation.*
