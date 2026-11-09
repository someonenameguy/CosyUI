# CosyUI — Lead Architectural Blueprint (01_ARCHITECTURAL_BLUEPRINT)

**Document Version**: 1.0.0  
**Author**: Agent 01 — Lead System Architect  
**Status**: APPROVED & CANONICAL  
**Target Scope**: Comprehensive architectural specifications for Agents 02 through 10.

---

## Table of Contents
1. [Executive Summary & Architectural Tenets](#1-executive-summary--architectural-tenets)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Graph Execution Lifecycle & Dual-Socket Mechanics](#3-graph-execution-lifecycle--dual-socket-mechanics)
4. [Canonical Node Schema & Interface Contracts](#4-canonical-node-schema--interface-contracts)
5. [Port Type System & Connection Rules](#5-port-type-system--connection-rules)
6. [UI Customization Architecture (Player UI View Binding)](#6-ui-customization-architecture-player-ui-view-binding)
7. [Universal LLM Runtime & Mock Abstraction](#7-universal-llm-runtime--mock-abstraction)
8. [Persistence, State Management & Export Strategy](#8-persistence-state-management--export-strategy)
9. [Error Prevention, Concurrency & Security Guardrails](#9-error-prevention-concurrency--security-guardrails)
10. [Directory Structure & Module Boundaries for Dev Agents](#10-directory-structure--module-boundaries-for-dev-agents)

---

## 1. Executive Summary & Architectural Tenets

CosyUI is a lightweight, zero-external-dependency, browser-native visual orchestration platform and customizable player interface designed for LLM workflows, conversational games, interactive fiction, and procedural pipelines.

### Core Architectural Tenets
1. **Zero External Dependencies**: Standard vanilla ES6+ JavaScript, native HTML5 Canvas / SVG, and CSS variables. No npm package lock-in, no CDN lag, no bundler compilation requirement to run.
2. **Dual Perspective (Editor View vs. Player View)**: 
   - **Editor View**: Node-based visual graph editor for wireframing logic, AI calls, state machines, and interface layout.
   - **Player View**: Clean, immersion-focused interactive experience where end-users play the story, test the game, or chat without node clutter.
3. **Dual-Socket Paradigm (Pulses + Streams)**: Explicit separation between **Trigger Pulses** (discrete control flow events) and **Data Values** (pull/push typed data streams), preventing execution ambiguity.
4. **Universal LLM Runtime with Instant Offline Playability**: Native support for major providers (OpenAI, Anthropic, OpenRouter, Ollama, Custom REST) alongside a zero-latency, realistic offline **Mock LLM engine** with simulated delays and markdown streaming.
5. **Single-File Runnable Portability**: Any project can be serialized to JSON or packaged into a completely standalone `.html` file embedding the runtime, graph, and UI into one file that runs anywhere.

---

## 2. High-Level System Architecture

```
+---------------------------------------------------------------------------------------+
|                                     COSYUI APPLICATION                                |
|                                                                                       |
|   +------------------------------------+     +------------------------------------+   |
|   |         EDITOR PERSPECTIVE         |     |         PLAYER PERSPECTIVE         |   |
|   |  - Infinite Canvas (Pan/Zoom)      |     |  - Dynamic Story / Chat Container  |   |
|   |  - Node Visuals & Bezier Cables    |     |  - Custom Stat Bars & Vitals       |   |
|   |  - Node Palette & Search           |     |  - Inventory Grid / Choice Buttons |   |
|   |  - Property Inspector & MiniMap    |     |  - Cosy Dark / Warm Theming        |   |
|   +------------------+-----------------+     +------------------+-----------------+   |
|                      |                                          |                     |
|                      |             UI Bridge Events             |                     |
|                      +--------------------<--------------------->                     |
|                                           |                                           |
|   +---------------------------------------v---------------------------------------+   |
|   |                              CENTRAL EVENT BUS                                |   |
|   +-------------------+---------------------------------------+-------------------+   |
|                       |                                       |                       |
|   +-------------------v-------------------+       +-----------v-------------------+   |
|   |         GRAPH EXECUTION ENGINE        |       |      UNIVERSAL LLM RUNTIME    |   |
|   |  - Pulse Dispatcher & Queue           |       |  - Provider Adapters          |   |
|   |  - Topological Value Resolver         |       |    (OpenAI/Anthropic/Ollama)  |   |
|   |  - Execution Context & Stack Guard    |       |  - Offline Mock LLM Simulator |   |
|   |  - Node State & Variable Store        |       |  - Stream Token Broadcaster   |   |
|   +-------------------+-------------------+       +-------------------------------+   |
|                       |                                                               |
|   +-------------------v-----------------------------------------------------------+   |
|   |                          PERSISTENCE & STORAGE SUBSYSTEM                      |   |
|   |  - LocalStorage Slots & Autosave  - JSON Import / Export                      |   |
|   |  - Starter Game Templates         - Standalone Single-HTML Compiler           |   |
|   +-------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------+
```

### Subsystem Roles
1. **Central Event Bus (`CosyBus`)**: Decoupled pub/sub backbone coordinating node state changes, player inputs, execution pulses, and UI synchronization.
2. **Graph Model & Registry (`GraphModel`, `NodeRegistry`)**: Maintains the canonical graph topology (nodes, ports, connections). Node definitions are registered as immutable prototypes.
3. **Execution Engine (`GraphExecutionEngine`)**: Manages step-by-step trigger propagation, resolves input socket values, enforces cycle limits, and executes asynchronous node handlers.
4. **Player UI Bridge (`PlayerUIBridge`)**: Mounts dynamic widgets created by UI nodes (e.g. Chat, Stat Bar, Buttons) into the Player View and routes user clicks/inputs back into graph execution pulses.
5. **Universal LLM Runtime (`LLMRuntime`)**: Standardizes API calls, streaming chunks, retry logic, and fallback to the built-in offline mock model.
6. **Storage Subsystem (`StorageManager`)**: Handles serialization, schema migration, local storage slots, file imports, and standalone bundle synthesis.

---

## 3. Graph Execution Lifecycle & Dual-Socket Mechanics

A critical design choice in CosyUI is the clean separation of **Trigger Sockets (Control Flow)** and **Value Sockets (Data Flow)**.

```
       +-------------------------------+
       |         NODE EVALUATE         |
       |                               |
(PULSE)| > [Trigger In]                |
       |                               |
(DATA) | O [Prompt: String]            |
(DATA) | O [Temp: Number]              |
       |                               |
       |             [ Execute Logic ] |
       |                               |
(PULSE)|                [Trigger Out] > | ===> Triggers downstream node
(PULSE)|                [On Error]    > | ===> Triggers error handler
       |                               |
(DATA) |                [Result: Str] O | ===> Available for downstream reading
       +-------------------------------+
```

### 3.1 Socket Types: Trigger vs. Value

| Dimension | Trigger Socket (`type: 'trigger'`) | Value Socket (`type: 'value'`) |
| :--- | :--- | :--- |
| **Visual Symbol** | Chevron / Arrow (`>`) | Circle (`O`) |
| **Execution Meaning** | "Do something now!" (discrete event pulse) | "Here is a piece of data" (typed stream/value) |
| **Propagation Model** | Push: fires sequentially along connected edges | Pull on Demand: resolved upstream before trigger node runs |
| **Connection Fan-out** | 1 output can trigger multiple inputs (serial/parallel pulses) | 1 output can connect to many inputs; 1 input connects to at most 1 output |
| **Data Payload** | Event signal metadata (`{ pulseId, timestamp, initiator, payload }`) | Typed JavaScript primitive, array, or object |

### 3.2 Dual-Phase Execution Protocol

Execution runs in two deterministic phases when a trigger occurs:

```
[ Trigger Event (e.g. Button Click or Timer) ]
                     |
                     v
   PHASE 1: DEPENDENCY RESOLUTION (PULL)
   For the target node:
   1. Inspect each Value Input Socket.
   2. If connected to upstream node output, resolve that node's value.
   3. If upstream is a pure function (e.g., Template, Variable, Math, Random),
      lazily evaluate upstream nodes in topological order.
   4. If upstream is a stateful node, read its cached last output value.
   5. Fall back to socket default value if disconnected.
                     |
                     v
   PHASE 2: NODE EXECUTION (PUSH)
   1. Mark node state as RUNNING (visual glow in editor).
   2. Invoke node's `evaluate(inputs, context)` (returns Promise).
   3. On resolution, update node's Output Value caches.
   4. Mark node state as COMPLETED.
   5. If `nextPulse` is returned, enqueue next trigger pulses and recurse.
   6. If error thrown, fire `onError` trigger (if wired) or report to debugger.
```

### 3.3 Execution Context (`ExecutionContext`)
Every execution cycle allocates an `ExecutionContext` carrying:
- `executionId`: Unique ID for tracing the chain of execution.
- `initiatorNodeId`: Originating node (e.g. User Chat Input, Start Node).
- `depth`: Monotonically incrementing call depth (preventing infinite loops).
- `maxDepth`: Configurable threshold (default `100`).
- `abortSignal`: `AbortController` signal to halt inflight requests if the user resets or stops execution.
- `variables`: Graph-level global runtime variables.
- `logger`: Structured debug logging utility.

---

## 4. Canonical Node Schema & Interface Contracts

Every node in CosyUI adheres to the strict canonical interface below. Agents 02, 03, 04, and 05 must build all nodes against this contract.

### 4.1 Node Definition Specification (JavaScript Object)

```javascript
/**
 * @typedef {Object} PortDefinition
 * @property {string} id - Unique identifier within this node (e.g. 'exec_in', 'text_out')
 * @property {string} name - Human-readable label displayed beside socket
 * @property {'trigger'|'value'} type - Socket execution class
 * @property {'string'|'number'|'boolean'|'object'|'array'|'any'|'trigger'} dataType - Data type
 * @property {*} [defaultValue] - Fallback value if port is disconnected
 * @property {string} [description] - Tooltip explanation of the port
 */

/**
 * @typedef {Object} NodePropertyDefinition
 * @property {string} key - Property identifier stored in node.properties
 * @property {string} label - Display label in node inspector
 * @property {'string'|'number'|'boolean'|'select'|'textarea'|'color'} type - Editor control type
 * @property {*} defaultValue - Initial value
 * @property {Array<{label: string, value: *}>} [options] - Options for select dropdowns
 * @property {string} [placeholder] - Placeholder text for inputs
 */

/**
 * @typedef {Object} NodeDefinition
 * @property {string} type - Unique type identifier (e.g. 'llm.generate', 'ui.chatbox')
 * @property {string} category - Category: 'trigger'|'llm'|'ui'|'game'|'logic'|'variable'|'utility'
 * @property {string} title - Display title in node header
 * @property {string} icon - SVG icon name or glyph (e.g. 'chat', 'bot', 'dice', 'code')
 * @property {string} color - Accent color for header bar (e.g. '#6366f1')
 * @property {string} description - Brief summary shown in palette search
 * @property {PortDefinition[]} inputs - Array of input sockets
 * @property {PortDefinition[]} outputs - Array of output sockets
 * @property {NodePropertyDefinition[]} properties - Editable node configurations
 * @property {function(): Object} [getInitialState] - Returns fresh internal state for node
 * @property {function(inputs: Object, context: ExecutionContext): Promise<NodeExecutionResult>|NodeExecutionResult} evaluate
 */
```

### 4.2 Node Instance Structure (Saved in Graph Topology)

```json
{
  "id": "node_llm_89a3f2",
  "type": "llm.generate",
  "title": "Story Narrator",
  "position": { "x": 420, "y": 180 },
  "properties": {
    "provider": "mock",
    "model": "gpt-4o",
    "systemPrompt": "You are a cosy dungeon master.",
    "temperature": 0.7,
    "maxTokens": 500
  },
  "state": {
    "lastResponse": "",
    "tokenCount": 0,
    "executionStatus": "idle"
  }
}
```

### 4.3 Connection Edge Structure

```json
{
  "id": "edge_c4b9d0",
  "fromNode": "node_user_input_1",
  "fromPort": "on_submit",
  "toNode": "node_llm_89a3f2",
  "toPort": "exec_in"
}
```

### 4.4 `evaluate(inputs, context)` Method Signature & Contract

```javascript
/**
 * @typedef {Object} NodeExecutionResult
 * @property {Object.<string, *>} outputs - Map of output port IDs to their produced values
 * @property {string|string[]} [nextPulse] - Output trigger port ID(s) to fire next
 */

/**
 * Core node execution contract.
 * @param {Object.<string, *>} inputs - Resolved values from input ports
 * @param {ExecutionContext} context - Runtime environment context
 * @returns {Promise<NodeExecutionResult>|NodeExecutionResult}
 */
async evaluate(inputs, context) {
  // 1. Validate required inputs
  const prompt = inputs['prompt'] || this.properties.defaultPrompt;
  
  // 2. Perform work (can use context.llm, context.state, etc.)
  const response = await context.llm.complete({
    prompt,
    systemPrompt: this.properties.systemPrompt,
    temperature: this.properties.temperature
  });

  // 3. Return outputs and next trigger pulse
  return {
    outputs: {
      'text_out': response.text,
      'tokens_used': response.usage.totalTokens
    },
    nextPulse: 'on_completed'
  };
}
```

---

## 5. Port Type System & Connection Rules

To ensure predictable data flow and eliminate runtime errors, CosyUI enforces a typed port validation matrix.

### 5.1 Port Data Types & Visual Palette

| Type Name | Internal Key | Visual Color | Wire Style | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Trigger** | `trigger` | `#f8fafc` (Pure White / Cyan) | Solid thick cable, glowing pulse animation on fire | Control flow pulse |
| **String** | `string` | `#f59e0b` (Amber) | Solid cable | Text, prompts, dialogue |
| **Number** | `number` | `#10b981` (Emerald) | Solid cable | Integers, floats, counters, stats |
| **Boolean** | `boolean` | `#8b5cf6` (Purple) | Solid cable | True / False flags |
| **Object** | `object` | `#06b6d4` (Sky Blue) | Solid cable | Key-value records, dictionaries |
| **Array** | `array` | `#ec4899` (Pink) | Solid cable | Lists, inventories, message histories |
| **Any** | `any` | `#94a3b8` (Slate Grey) | Dashed cable | Universal wildcard socket |

### 5.2 Compatibility & Validation Matrix

When the user drags a cable from `SourcePort` to `TargetPort`, the editor evaluates:

```
CanConnect(SourcePort, TargetPort):
1. Direction Rule:
   - Exactly one must be an Output Port AND the other must be an Input Port.
   - Output -> Output is FORBIDDEN.
   - Input -> Input is FORBIDDEN.
2. Self-Loop Rule:
   - TargetPort.nodeId != SourcePort.nodeId (A node cannot connect to itself).
3. Type Class Match Rule:
   - If SourcePort.type == 'trigger', TargetPort.type MUST BE 'trigger'.
   - If SourcePort.type == 'value', TargetPort.type MUST BE 'value'.
4. Data Type Compatibility Rule (for Value Sockets):
   - If Source.dataType == Target.dataType -> ALLOW.
   - If Source.dataType == 'any' OR Target.dataType == 'any' -> ALLOW.
   - If Source is 'number' and Target is 'string' -> ALLOW (automatic string coercion).
   - If Source is 'boolean' and Target is 'string' -> ALLOW.
   - All other type mismatches (e.g. object -> number) -> REJECT.
5. Multi-Connection Cardinality Rule:
   - Output Value Socket -> Multiple Input Value Sockets (ALLOW 1-to-N).
   - Input Value Socket -> Already has a connection? REPLACE existing or REJECT (Max 1 incoming connection per input).
   - Output Trigger Socket -> Multiple Input Trigger Sockets (ALLOW 1-to-N, executes sequentially).
   - Input Trigger Socket -> Multiple Output Trigger Sockets (ALLOW N-to-1, any can trigger it).
```

---

## 6. UI Customization Architecture (Player UI View Binding)

CosyUI features a dedicated **Player View** that allows non-technical users to experience the game or tool created in the editor. UI Nodes placed in the graph dynamically project components into this view.

```
       GRAPH EDITOR                           PLAYER VIEW
+--------------------------+          +--------------------------+
| [UI Chatbox Node]        |          | # The Enchanted Tavern   |
|   id: ui_chat_1          |          |                          |
|   title: "Tavern Chat"   | =======> | [ AI Assistant / Story ] |
|   on_submit >            |          | "Greetings, adventurer!" |
+--------------------------+          |                          |
                                      | [ Player Input Box...  ] |
+--------------------------+          +--------------------------+
| [UI Stat Bar Node]       |          | Vitals:                  |
|   id: ui_stat_hp         | =======> | [====== HP 85/100 =====] |
|   label: "HP", max: 100  |          | [==== Mana 40/50 ======] |
+--------------------------+          +--------------------------+
```

### 6.1 The UI Component Registry
The frontend maintains an active mapping of UI Node instances to DOM elements rendered in the Player View:

| Node Type | Player DOM Manifestation | Inbound Events (Graph -> UI) | Outbound Triggers (UI -> Graph) |
| :--- | :--- | :--- | :--- |
| `ui.chatbox` | Scrollable message log + auto-expanding input field + submit button | `append_message`, `stream_chunk`, `clear` | `on_submit` (payload: `{ text }`) |
| `ui.storybox` | Rich Markdown narrative viewer with typing animation effect | `set_content`, `append_text` | `on_click_continue` |
| `ui.statbar` | Animated progress bar with label, current value, max value | `update_value`, `set_color` | None (Display only) |
| `ui.choices` | Button group representing dynamic player options | `set_options` (Array of labels) | `on_choice_selected` (payload: `{ index, label }`) |
| `ui.inventory`| Visual grid of item slots with tooltips and counts | `add_item`, `remove_item`, `set_items` | `on_item_used`, `on_item_inspected` |
| `ui.theme` | Controls global CSS variables (warm dark, cyber neon, parchment) | `apply_theme` | None |

### 6.2 Bi-Directional Binding Workflow

1. **Mounting**: When the Graph loads or a UI Node is created, the `PlayerUIBridge` instantiates a corresponding widget container in the Player View DOM.
2. **Graph-to-UI Updates**:
   - When a node connected to `ui.chatbox` outputs a string, the chat node's `evaluate()` updates its internal history and emits `PlayerUIBridge.dispatch('ui:chat:append', { text, sender: 'assistant' })`.
   - Streaming LLM tokens bypass full node evaluations, pushing direct chunks into the active player bubble for 60fps streaming fluidity.
3. **UI-to-Graph User Events**:
   - The player types "Drink potion" into the input box and hits Enter.
   - The Player DOM element captures the submit event and fires `PlayerUIBridge.triggerNode(nodeId, 'on_submit', { text: 'Drink potion' })`.
   - The Execution Engine initiates a new execution pulse from `nodeId.outputs['on_submit']` with `inputs.text = 'Drink potion'`.

### 6.3 Player Layout Engine
The Player View supports flexible layout modes configurable in Project Settings:
- **Story Focus (Default)**: Single-column clean reader with top stat bars, central story/chat stream, and bottom action bar.
- **Classic RPG Split**: Left sidebar (Character sheet, stats, inventory), right pane (narrative story + interactive choices).
- **Minimalist Chat**: Direct full-height conversational messenger.

---

## 7. Universal LLM Runtime & Mock Abstraction

CosyUI communicates with AI models through a unified, provider-agnostic runtime (`LLMRuntime`).

### 7.1 Unified Request / Response Protocol

```javascript
/**
 * Unified Completion Request
 * @typedef {Object} CompletionRequest
 * @property {'openai'|'anthropic'|'openrouter'|'ollama'|'mock'} provider
 * @property {string} model - e.g. 'gpt-4o', 'claude-3-5-sonnet', 'llama3'
 * @property {string} [apiKey] - Provider API key (stored in memory/sessionStorage only)
 * @property {string} [baseUrl] - Custom endpoint (e.g. http://localhost:11434 for Ollama)
 * @property {string} [systemPrompt] - System instructions
 * @property {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @property {number} [temperature=0.7]
 * @property {number} [maxTokens=1000]
 * @property {boolean} [stream=true]
 * @property {AbortSignal} [signal]
 */
```

### 7.2 Built-In Offline Mock LLM Engine (`MockLLM`)
To enable immediate out-of-the-box exploration without requiring API keys or internet access:
- **Context-Aware Heuristics**: Analyzes the last user message for keywords (e.g., "attack", "look", "inventory", "open", "help", "hello") and generates thematic fantasy/sci-fi responses.
- **Procedural Dice Resolution**: Detects game mechanics (e.g., "Roll d20 for dexterity") and injects simulated narrative outcomes based on roll variables.
- **Realistic Token Streaming**: Emits words at 30ms-50ms intervals using standard `ReadableStream` or generator callbacks, matching real AI streaming feel.

### 7.3 Streaming Architecture
```
[LLM Provider API / Mock] 
          | (Chunks via fetch ReadableStream)
          v
[LLMRuntime Adapter] 
          | (Normalized Event: { textChunk, done, totalTokens })
          v
[Graph Engine / UI Bridge] 
          | 
          +----> [Update UI Storybox / Chat bubble DOM in real-time]
          +----> [Accumulate complete string for Node Output socket]
```

---

## 8. Persistence, State Management & Export Strategy

CosyUI ensures zero data loss through an integrated multi-tiered storage model.

### 8.1 Project JSON Schema

```json
{
  "$schema": "https://cosyui.dev/schema/v1.json",
  "version": "1.0.0",
  "metadata": {
    "title": "Tavern of Whispers RPG",
    "author": "CosyCreator",
    "description": "An interactive fantasy adventure powered by local LLM logic.",
    "createdAt": "2026-11-09T08:00:00Z",
    "modifiedAt": "2026-11-09T08:45:00Z",
    "theme": "cosy-dark"
  },
  "viewport": {
    "pan": { "x": 120, "y": 80 },
    "zoom": 1.0
  },
  "nodes": [
    {
      "id": "node_1",
      "type": "ui.chatbox",
      "position": { "x": 100, "y": 200 },
      "properties": {},
      "state": {}
    }
  ],
  "edges": [
    {
      "id": "edge_1",
      "fromNode": "node_1",
      "fromPort": "on_submit",
      "toNode": "node_2",
      "toPort": "exec_in"
    }
  ],
  "globals": {
    "playerHP": 100,
    "gold": 25,
    "inventory": ["Torch", "Rusty Dagger"]
  }
}
```

### 8.2 Storage Targets
1. **LocalStorage Project Slots**: 5 quick-save slots + 1 autosave slot running every 10 seconds on graph dirty flag.
2. **JSON Export / Import**: Simple file download and drag-and-drop JSON file upload into the editor.
3. **Standalone Runnable HTML Export (`CosyHTMLPacker`)**:
   - Bundles the entire CosyUI Player CSS, runtime JS, and project JSON into a single self-contained `<script>` tag.
   - Generates a standalone `.html` file that users can email or double-click to play locally in any browser offline.

### 8.3 Starter Presets
The app ships with 4 built-in starter templates:
1. **Interactive Fantasy RPG**: Stat bars, inventory, dice rolls, dynamic story box, branching dialogue.
2. **Dual-Agent LLM Debate**: Two LLM nodes conversing and challenging each other on a topic with turn limits.
3. **Prompt Engineer Lab**: Side-by-side prompt variations comparing model outputs with latency and token metrics.
4. **Choose Your Own Adventure**: Pure logic/state machine workflow with choice buttons and branching paths (no API key required).

---

## 9. Error Prevention, Concurrency & Security Guardrails

Agent 08 (Code Auditor) and Agent 09 (QA) must rigorously verify against the following edge cases:

### 9.1 Infinite Cycle & Recursion Prevention
- **Value Graph DAG Rule**: Value socket connections MUST form a Directed Acyclic Graph (DAG). Before creating any value cable, the editor runs a depth-first search (DFS). If adding edge `A -> B` creates a cycle in value flow, the connection is rejected immediately with a visual warning.
- **Trigger Execution Depth Limit**: While trigger loops are allowed for iterative games, every execution context increments `context.depth`. If `depth > 100`, execution halts with `MaxExecutionDepthExceededError`, and the offending node lights up red in the editor.

### 9.2 Concurrency & Button Spam Guard
- When an asynchronous node (e.g. LLM call) is running:
  - Input UI triggers (like Chat submit or Action buttons) enter a disabled or loading state.
  - Sockets can be configured to **Queue** (run sequentially) or **Drop** (ignore new pulses while busy). Default behavior is **Drop with visual throttle**.

### 9.3 Port Type Validation & Self-Healing
- If an imported graph contains unknown node types or deprecated ports (e.g. from an older version), the graph engine wraps them in a `fallback.unknown` node instead of crashing the application, preserving edge topology.

### 9.4 Security & API Key Isolation
- API keys are NEVER saved to exported project JSON files or shared HTML bundles.
- Keys reside in `sessionStorage` or local memory, entered via a secure Settings modal.

---

## 10. Directory Structure & Module Boundaries for Dev Agents

To eliminate code collisions between Agents 02 through 10, the project follows this modular structure:

```
CosyUI/
├── index.html                  # Single page application entry point
├── css/
│   ├── cosy-theme.css          # Core design tokens, dark/warm palette, typography (Agent 07)
│   ├── graph-editor.css        # Canvas, nodes, ports, cables, minimap styles (Agent 02, 07)
│   └── player-ui.css           # Player view widgets: chat, stats, inventory (Agent 04, 07)
├── js/
│   ├── core/
│   │   ├── event-bus.js        # CosyBus pub/sub event coordinator
│   │   ├── port-types.js       # Port types, colors, and connection validator (Agent 01/02)
│   │   ├── graph-model.js      # Graph topology, nodes, edges, validation (Agent 02)
│   │   └── execution-engine.js # Trigger/pulse dispatch and value resolver (Agent 02/08)
│   ├── nodes/
│   │   ├── base-node.js        # BaseNode prototype contract (Agent 01/02)
│   │   ├── node-registry.js    # Node definition catalog & instantiator (Agent 02)
│   │   └── catalog/
│   │       ├── trigger-nodes.js# Start, Timer, Button Trigger (Agent 05)
│   │       ├── logic-nodes.js  # Condition, Switch, Branch, Math (Agent 05)
│   │       ├── llm-nodes.js    # LLM Generate, Prompt Template, Memory (Agent 03)
│   │       ├── ui-nodes.js     # Chatbox, StatBar, Storybox, Choices, Inventory (Agent 04)
│   │       └── game-nodes.js   # Dice Roller, State Machine, Variables (Agent 05)
│   ├── editor/
│   │   ├── canvas-renderer.js  # HTML5 Canvas / SVG rendering loop (Agent 02)
│   │   ├── cable-renderer.js   # Bezier curves and connection interactions (Agent 02)
│   │   ├── pan-zoom.js         # Infinite viewport transform math (Agent 02)
│   │   ├── node-view.js        # DOM / Canvas node rendering and dragging (Agent 02)
│   │   ├── minimap.js          # Interactive graph radar minimap (Agent 07)
│   │   └── palette.js          # Node creation search palette (Agent 02/07)
│   ├── runtime/
│   │   ├── llm-client.js       # Universal API client (OpenAI, Anthropic, Ollama) (Agent 03)
│   │   ├── mock-llm.js         # Realistic offline mock LLM engine (Agent 03)
│   │   └── prompt-engine.js    # Mustache-style template interpolation (Agent 03)
│   ├── ui/
│   │   ├── player-view.js      # Player container mount & view manager (Agent 04)
│   │   ├── ui-bridge.js        # Node <-> Player View event bridge (Agent 04)
│   │   └── components/         # Chat, StatBar, Inventory DOM renderers (Agent 04)
│   ├── storage/
│   │   ├── project-serializer.js # JSON schema export/import (Agent 06)
│   │   ├── local-storage.js    # Slot persistence & autosave (Agent 06)
│   │   ├── html-packer.js      # Standalone single-file HTML exporter (Agent 06)
│   │   └── presets/            # 4 Starter template JSON definitions (Agent 06)
│   └── app.js                  # Main coordinator mounting views & initializing
├── tests/
│   ├── test-runner.html        # In-browser zero-dependency test runner (Agent 09)
│   ├── test-graph-engine.js    # Unit tests for execution & cycle checks (Agent 09)
│   ├── test-nodes.js           # Unit tests for all catalog node evaluations (Agent 09)
│   └── test-llm-runtime.js     # Unit tests for Mock LLM and adapters (Agent 09)
└── Notes/                      # Agent design specs, audits, and protocols
```

---

## 11. Concrete Assignment Matrix for Successive Agents

| Agent | Core Focus | Primary Deliverables | Reference Blueprint Section |
| :--- | :--- | :--- | :--- |
| **Agent 02** | Graph Engine & Canvas | `js/core/graph-model.js`, `js/core/execution-engine.js`, `js/editor/*` | Section 3, 4, 5 |
| **Agent 03** | Universal LLM Runtime | `js/runtime/llm-client.js`, `mock-llm.js`, `prompt-engine.js`, `llm-nodes.js` | Section 7 |
| **Agent 04** | Dynamic Player Frontend | `js/ui/*`, `js/nodes/catalog/ui-nodes.js`, `css/player-ui.css` | Section 6 |
| **Agent 05** | Game & Workflow Logic | `js/nodes/catalog/game-nodes.js`, `logic-nodes.js`, `trigger-nodes.js` | Section 3, 4 |
| **Agent 06** | Storage & Portability | `js/storage/*`, 4 starter templates, standalone HTML exporter | Section 8 |
| **Agent 07** | UI/UX & Aesthetics | `css/cosy-theme.css`, `css/graph-editor.css`, minimap, responsive layout | Section 1, 2, 5 |
| **Agent 08** | Code Auditor | Edge cases, cycle guards, null-safety, memory leaks, security | Section 9 |
| **Agent 09** | QA & Test Engineer | Automated test suite in `tests/test-runner.html`, test suites | All Sections |
| **Agent 10** | Lead Documentation | User guide, interactive tutorial, final handoff package | All Sections |

---
*End of Architectural Blueprint. All subsequent agents must adhere strictly to the contracts and schemas established herein.*
