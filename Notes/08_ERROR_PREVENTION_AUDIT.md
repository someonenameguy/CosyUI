# CosyUI Error Prevention Audit & Defensive Engineering Specification

**Document:** `Notes/08_ERROR_PREVENTION_AUDIT.md`  
**Author:** Agent 08 — Code Auditor & Error Prevention Specialist  
**Audience:** All Agents (01–10) contributing to CosyUI  
**Version:** 1.0.0  
**Status:** ACTIVE SPECIFICATION

---

## Executive Summary & Objectives

CosyUI is designed as a zero-dependency, lightweight, high-performance HTML/CSS/JS web application for visual LLM graph programming and player-facing customized UIs. Because CosyUI runs entirely client-side in the browser without server validation or external safety harnesses, **every safety invariant, resource guard, and fault boundary must be built directly into the client codebase**.

This document establishes the definitive **Failure Mode Catalog** and **Defensive Coding Standards** for all team modules (Graph Engine, LLM Runtime, Frontend Customizer, Game Logic, Storage, and UI/UX). Every developer agent must adhere strictly to these patterns.

---

## 1. Failure Mode Catalog & Technical Mitigations

### 1.1. Infinite Recursion & Cycle Traps in Node Graphs

#### The Problem
In visual node programming, users can easily create circular topologies (e.g., Node A $\rightarrow$ Node B $\rightarrow$ Node A), or iterative loops (e.g., prompt refinement loops, conversational loops, or state machine transitions). If the execution engine evaluates dependencies or propagates execution signals via unconstrained recursion, it triggers:
1. `RangeError: Maximum call stack size exceeded` (crashing the entire JavaScript thread).
2. Unbounded infinite event dispatch, freezing the browser UI and locking LocalStorage.
3. Rapid runaway LLM API calls depleting user credits or tripping API rate limits within seconds.

#### Prescribed Mitigations

1. **Static & Dynamic Cycle Detection (Three-Color DFS Algorithm)**:
   - Before executing a directed flow graph or during edge creation, the engine must run cycle validation on demand.
   - Nodes are categorized into three states during traversal:
     - `WHITE` (0): Unvisited.
     - `GRAY` (1): Currently in active recursion stack (if an edge points to a `GRAY` node, a back-edge/cycle is detected).
     - `BLACK` (2): Fully evaluated and backtrack safe.
   - If a cycle is intentional (e.g., a looping game turn or retry branch), the loop **must** be mediated by an asynchronous or user-gated node (e.g., `UserInputNode`, `DelayNode`, or `ConditionNode`) and **never** a synchronous immediate loop.

2. **Hard Step Execution Counter**:
   - Every graph execution run must be assigned a unique `ExecutionRun` context object with an atomic execution step counter:
   ```javascript
   class ExecutionContext {
     constructor(maxSteps = 500) {
       this.id = 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
       this.maxSteps = maxSteps;
       this.currentStep = 0;
       this.visitedNodeCounts = new Map(); // nodeId -> count
       this.abortController = new AbortController();
     }

     tick(nodeId) {
       if (this.abortController.signal.aborted) {
         throw new ExecutionAbortedError("Execution was cancelled.");
       }
       this.currentStep++;
       const count = (this.visitedNodeCounts.get(nodeId) || 0) + 1;
       this.visitedNodeCounts.set(nodeId, count);

       if (this.currentStep > this.maxSteps) {
         throw new MaxExecutionStepsExceededError(
           `Execution halted: Max step limit (${this.maxSteps}) reached. Detected potential infinite loop at node "${nodeId}".`
         );
       }
       if (count > 100) {
         throw new InfiniteLoopTrapError(
           `Node "${nodeId}" executed ${count} times in single run. Terminating runaway loop.`
         );
       }
     }
   }
   ```

3. **Asynchronous Scheduling & Trampolining**:
   - The execution engine must **never** call downstream `node.execute()` synchronously inside an existing `node.execute()` stack.
   - Flow propagation must yield to the event loop using `queueMicrotask()` or `await new Promise(r => setTimeout(r, 0))` between node hops. This guarantees that:
     - The call stack depth is always $O(1)$.
     - The browser UI remains responsive and can render node execution highlight glows.
     - The user can click an emergency "Stop / Halt Execution" button at any time.

4. **Visual Edge Warning**:
   - Cycles detected in purely synchronous data-flow graphs must render edges with an amber dashed warning style and a badge on the node: `Loop Warning: Must contain an async break`.

---

### 1.2. Socket Type Mismatch Handling

#### The Problem
CosyUI nodes expose typed input and output sockets (e.g., `STRING`, `NUMBER`, `BOOLEAN`, `OBJECT`/`JSON`, `FLOW`/`TRIGGER`, `ANY`, `ARRAY`). Mismatches lead to:
- Passing an `OBJECT` to a node expecting a primitive `STRING`, rendering `[object Object]` inside prompts.
- Wiring a data socket (`STRING`) into a control-flow trigger socket (`FLOW`), causing unexpected spontaneous firing or silent engine failure.
- Passing `undefined` or `NaN` into downstream mathematical or string manipulation functions.

#### Prescribed Socket Type System & Coercion Matrix

| Target Socket (Input) $\downarrow$ \ Source (Output) $\rightarrow$ | `FLOW` / `TRIGGER` | `STRING` | `NUMBER` | `BOOLEAN` | `OBJECT` / `JSON` | `ARRAY` | `ANY` |
|---|---|---|---|---|---|---|---|
| **`FLOW`** | **ALLOWED (Direct)** | REJECT | REJECT | REJECT | REJECT | REJECT | REJECT |
| **`STRING`** | REJECT | **ALLOWED (Direct)** | COERCE (`String(v)`) | COERCE (`String(v)`) | COERCE (`JSON.stringify(v, null, 2)`) | COERCE (`JSON.stringify(v)`) | PASS-THROUGH (Safe toString) |
| **`NUMBER`** | REJECT | COERCE (Parsed with fallback) | **ALLOWED (Direct)** | COERCE (`v ? 1 : 0`) | REJECT / `NaN` Guard | REJECT | COERCE (Safe Number) |
| **`BOOLEAN`** | REJECT | COERCE (Truthiness / `"false"` check) | COERCE (`v !== 0`) | **ALLOWED (Direct)** | COERCE (`Boolean(v)`) | COERCE (`arr.length > 0`) | PASS-THROUGH (Boolean(v)) |
| **`OBJECT`** | REJECT | COERCE (Safe `JSON.parse`) | REJECT | REJECT | **ALLOWED (Direct)** | **ALLOWED (Direct)** | VALIDATE (Object check) |
| **`ANY`** | REJECT | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** |

#### Technical Rules:
1. **Flow vs Data Isolation**:
   - `FLOW` sockets carry execution pulses, not data payloads. They must **never** be connectable to data sockets. Snapping and cable connection UI must immediately reject cable creation if `source.type === 'FLOW' ^ target.type === 'FLOW'`.
2. **Safe Coercion Helper (`TypeCoercer`)**:
   - Nodes must never manually cast types with unsafe assumptions. Use the centralized `TypeCoercer`:
   ```javascript
   const TypeCoercer = {
     toString(val, defaultVal = "") {
       if (val === undefined || val === null) return defaultVal;
       if (typeof val === 'string') return val;
       if (typeof val === 'object') {
         try { return JSON.stringify(val, null, 2); } catch (_) { return String(val); }
       }
       return String(val);
     },
     toNumber(val, defaultVal = 0) {
       if (typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val)) return val;
       const parsed = parseFloat(val);
       return Number.isNaN(parsed) || !Number.isFinite(parsed) ? defaultVal : parsed;
     },
     toBoolean(val) {
       if (typeof val === 'boolean') return val;
       if (typeof val === 'string') {
         const s = val.trim().toLowerCase();
         if (s === 'false' || s === '0' || s === 'no' || s === '') return false;
         return true;
       }
       return Boolean(val);
     },
     toJson(val, defaultVal = {}) {
       if (val && typeof val === 'object') return val;
       if (typeof val === 'string') {
         try { return JSON.parse(val); } catch (_) { return defaultVal; }
       }
       return defaultVal;
     }
   };
   ```
3. **Interactive Connection Prevention**:
   - During cable drag in the Graph Engine, sockets that cannot accept the dragging socket's type must dim (`opacity: 0.3; pointer-events: none;`) to prevent invalid connections before they occur.

---

### 1.3. Dangling Wire Cleanup on Node Deletion & Socket Removal

#### The Problem
When a user deletes a node, duplicates nodes, or changes a node configuration that removes dynamic sockets (e.g. choice buttons or custom variable outputs), connected wires often remain in the graph data structure. This causes:
- Ghost edges in the SVG layer rendering to `(0, 0)` or throwing `Cannot read properties of null (reading 'x')`.
- Serialization corruption where project JSON contains invalid `edge.fromNode` or `edge.fromSocket` references.
- Execution engine trying to read from a missing node or nonexistent socket.

#### Prescribed Mitigations

1. **Atomic Transactional Deletion**:
   - Removing a node must be implemented as an atomic transaction that cleans both the node and all connected edges across both the data model and the DOM:
   ```javascript
   function removeNode(graph, nodeId) {
     const node = graph.nodes.get(nodeId);
     if (!node) return;

     // 1. Identify all affected edges
     const connectedEdges = graph.edges.filter(
       edge => edge.fromNode === nodeId || edge.toNode === nodeId
     );

     // 2. Remove all connected edges from DOM & Model
     for (const edge of connectedEdges) {
       removeEdge(graph, edge.id);
     }

     // 3. Cleanup node DOM & instances
     if (typeof node.onDestroy === 'function') {
       try { node.onDestroy(); } catch (err) { console.warn(`Error destroying node ${nodeId}:`, err); }
     }
     if (node.element && node.element.parentNode) {
       node.element.parentNode.removeChild(node.element);
     }

     // 4. Remove from model
     graph.nodes.delete(nodeId);
     graph.markDirty();
   }
   ```

2. **Dynamic Socket Mutation Hooks**:
   - If a node dynamically removes an output or input socket (e.g., removing a branch from a Multi-Choice node), it **must** dispatch a `socketRemoved` event or call `graph.disconnectSocket(nodeId, socketId)`:
   ```javascript
   function disconnectSocket(graph, nodeId, socketId) {
     const edgesToRemove = graph.edges.filter(
       e => (e.fromNode === nodeId && e.fromSocket === socketId) ||
            (e.toNode === nodeId && e.toSocket === socketId)
     );
     edgesToRemove.forEach(e => removeEdge(graph, e.id));
   }
   ```

3. **Graph Integrity Sanitizer (`sanitizeGraph`)**:
   - Always run prior to graph execution, project save, and immediately after project load:
   ```javascript
   function sanitizeGraph(graph) {
     const validNodeIds = new Set(graph.nodes.keys());
     const cleanEdges = [];

     for (const edge of graph.edges) {
       const fromNode = graph.nodes.get(edge.fromNode);
       const toNode = graph.nodes.get(edge.toNode);

       if (!fromNode || !toNode) continue; // Orphaned edge

       const hasFromSocket = fromNode.outputs && fromNode.outputs.some(s => s.id === edge.fromSocket);
       const hasToSocket = toNode.inputs && toNode.inputs.some(s => s.id === edge.toSocket);

       if (hasFromSocket && hasToSocket) {
         cleanEdges.push(edge);
       } else {
         console.warn(`Purging dangling edge ${edge.id} connected to missing socket.`);
       }
     }
     graph.edges = cleanEdges;
   }
   ```

---

### 1.4. API Key Security & Exfiltration Prevention

#### The Problem
Users configure API keys for OpenAI, Anthropic, OpenRouter, or custom proxies. Catastrophic security risks include:
- Storing API keys directly in node properties or graph JSON files.
- Exporting workflows to share with other users, inadvertently distributing real API keys.
- Building standalone runnable HTML games and baking private credentials into client-side bundles.
- Accidental leakage in log files or console debugging output.

#### Prescribed Storage & Scrubbing Architecture

1. **Storage Isolation Protocol**:
   - **Never store API keys inside the Node Data Graph or Project Data JSON.**
   - Keys must reside exclusively in a dedicated, isolated browser storage key: `cosyui_secure_vault`:
   ```javascript
   const KeyVault = {
     STORAGE_KEY: 'cosyui_secure_vault',
     
     get(provider) {
       try {
         const raw = localStorage.getItem(this.STORAGE_KEY);
         if (!raw) return "";
         const data = JSON.parse(raw);
         return data[provider] || "";
       } catch (_) {
         return "";
       }
     },
     
     set(provider, key) {
       try {
         const raw = localStorage.getItem(this.STORAGE_KEY) || "{}";
         const data = JSON.parse(raw);
         data[provider] = key.trim();
         localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
       } catch (err) {
         console.error("Failed to save to secure vault:", err);
       }
     },

     clear() {
       localStorage.removeItem(this.STORAGE_KEY);
     }
   };
   ```

2. **Automatic Export Sanitization**:
   - During JSON project export or standalone HTML generation, the serializer **must run a strict redaction pass**:
   ```javascript
   function serializeProjectForExport(projectData) {
     // Deep clone
     const exportData = JSON.parse(JSON.stringify(projectData));

     // 1. Strip top-level keys
     delete exportData.apiKeys;
     delete exportData.secrets;

     // 2. Scan all nodes and sanitize any fields named key, apiKey, secret, token, password
     for (const node of exportData.nodes || []) {
       if (node.state) {
         for (const prop of Object.keys(node.state)) {
           if (/api_?key|secret|token|password|auth/i.test(prop)) {
             node.state[prop] = "";
           }
         }
       }
     }

     return exportData;
   }
   ```

3. **Standalone HTML Export Behavior**:
   - Standalone HTML exports must prompt the player for an API key on first launch, or default strictly to the **Offline Mock LLM Engine**.
   - If a creator explicitly chooses "Bundle My API Key (Self-Host Only)", a prominent **High-Risk Security Warning Modal** must require explicit double-confirmation, warning that anyone with browser DevTools can inspect and extract their key.

4. **Console & Error Masking**:
   - Whenever printing errors or requests to the console or node tooltips, any key matching patterns like `sk-[a-zA-Z0-9]{20,}` must be redacted: `sk-...` + last 4 characters.

---

### 1.5. LLM Rate Limits, Network Failures & Timeout Handling

#### The Problem
Direct browser-to-LLM API calls are inherently volatile:
- **HTTP 429**: Rate limit / token quota exhausted.
- **HTTP 500/502/503**: Model server overload.
- **CORS Errors**: Provider does not permit browser origins without proper proxy configuration or headers.
- **Hanging Connections**: LLM hangs indefinitely without streaming tokens, locking the UI workflow.

#### Prescribed Resilience Patterns

1. **Exponential Backoff with Full Jitter**:
   - For retryable status codes (`429`, `500`, `502`, `503`, `504`), execute exponential backoff:
   $$\text{delay} = \min(\text{maxDelay}, \text{baseDelay} \times 2^{\text{attempt}}) + \text{random}(0, \text{jitter})$$
   ```javascript
   async function fetchWithRetry(url, options, maxRetries = 3, baseDelay = 1000) {
     let attempt = 0;
     while (true) {
       try {
         const response = await fetch(url, options);
         if (response.ok) return response;

         // Check if retryable
         const retryable = [429, 500, 502, 503, 504].includes(response.status);
         if (!retryable || attempt >= maxRetries) {
           const errBody = await response.text();
           throw new Error(`HTTP ${response.status} (${response.statusText}): ${errBody.slice(0, 300)}`);
         }

         attempt++;
         // Check for standard Retry-After header
         const retryAfter = response.headers.get('Retry-After');
         let delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(10000, baseDelay * Math.pow(2, attempt));
         delayMs += Math.random() * 500; // Jitter

         console.warn(`[LLM Client] Retryable error ${response.status}. Retrying in ${Math.round(delayMs)}ms (attempt ${attempt}/${maxRetries})...`);
         await new Promise(r => setTimeout(r, delayMs));
       } catch (err) {
         if (err.name === 'AbortError') throw err; // User canceled or timeout
         if (attempt >= maxRetries) throw err;
         attempt++;
         await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
       }
     }
   }
   ```

2. **Hard Timeout Protection**:
   - Every fetch request must be wrapped with an `AbortController` linked to a timeout (default: 45 seconds). If streaming stalls for more than 15 seconds without a single new chunk, trigger abort.

3. **Node Visual Status & Non-Fatal State**:
   - Nodes must visually communicate status via a uniform CSS state class:
     - `.node-status-idle`
     - `.node-status-running` (pulse animation)
     - `.node-status-streaming` (active wave)
     - `.node-status-success` (green badge)
     - `.node-status-error` (crimson border + icon + clickable popover with full diagnostic trace)
   - When an LLM node fails, it must **not** crash the whole app. It must route to an optional `OnError` trigger socket, enabling game workflows to gracefully notify the player ("The narrator pauses to think... Retry?").

4. **Offline Mock LLM Engine**:
   - CosyUI must provide a built-in offline simulation engine that provides immediate contextual responses (fantasy adventure, sci-fi dungeon, dialogue bot) when no API key or internet access is present.

---

### 1.6. Canvas Coordinate Desync on Window or Split-Pane Resizing

#### The Problem
CosyUI features a dual-interface layout: the visual Graph Canvas on one side and the Player Customized UI on the other, separated by a resizable split-pane divider.
- Resizing the split-pane or the browser window changes canvas client dimensions.
- If pointer coordinates are computed using cached canvas offsets or naive `e.clientX - rect.left` calculations without accounting for pan translation ($T_x, T_y$) and zoom scale ($S$), cable dragging, node selection, and socket snapping will miss by dozens or hundreds of pixels.

#### Prescribed Mathematical Coordinate Space Invariants

1. **Coordinate Systems**:
   - **Screen Space**: Raw mouse/touch pixels (`e.clientX`, `e.clientY`).
   - **Container Space**: Relative to graph wrapper DOM element `rect = container.getBoundingClientRect()`:
     $$x_{\text{container}} = e.\text{clientX} - rect.\text{left}, \quad y_{\text{container}} = e.\text{clientY} - rect.\text{top}$$
   - **World / Canvas Graph Space**: The zoomable, pannable coordinate space where nodes reside:
     $$x_{\text{world}} = \frac{x_{\text{container}} - \text{panX}}{\text{scale}}, \quad y_{\text{world}} = \frac{y_{\text{container}} - \text{panY}}{\text{scale}}$$
     $$x_{\text{container}} = x_{\text{world}} \times \text{scale} + \text{panX}, \quad y_{\text{container}} = y_{\text{world}} \times \text{scale} + \text{panY}$$

2. **Implementation Requirement**:
   - All pointer calculations must pass through the central `CoordinateTransformer`:
   ```javascript
   class ViewportTransform {
     constructor(containerElement) {
       this.container = containerElement;
       this.panX = 0;
       this.panY = 0;
       this.scale = 1.0;
       this.minScale = 0.15;
       this.maxScale = 3.0;
     }

     screenToWorld(clientX, clientY) {
       const rect = this.container.getBoundingClientRect();
       const containerX = clientX - rect.left;
       const containerY = clientY - rect.top;
       return {
         x: (containerX - this.panX) / this.scale,
         y: (containerY - this.panY) / this.scale
       };
     }

     worldToScreen(worldX, worldY) {
       const rect = this.container.getBoundingClientRect();
       return {
         x: rect.left + this.panX + (worldX * this.scale),
         y: rect.top + this.panY + (worldY * this.scale)
       };
     }

     zoomAt(screenX, screenY, deltaZoom) {
       const rect = this.container.getBoundingClientRect();
       const mouseX = screenX - rect.left;
       const mouseY = screenY - rect.top;

       const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * (1 - deltaZoom)));
       const factor = newScale / this.scale;

       // Keep world point under cursor invariant
       this.panX = mouseX - (mouseX - this.panX) * factor;
       this.panY = mouseY - (mouseY - this.panY) * factor;
       this.scale = newScale;
     }
   }
   ```

3. **`ResizeObserver` Mandatory Attachment**:
   - Never rely on `window.addEventListener('resize')` alone. Use a `ResizeObserver` on the graph container element to handle split-pane resizing smoothly without desync.

---

### 1.7. Memory Leak Prevention in Event Listeners & Animation Frames

#### The Problem
Single-page visual canvas applications are prone to memory leaks that degrade performance from 60fps to sluggish unresponsiveness over extended user sessions:
- Attaching `window.addEventListener('mousemove')` or `keydown` without corresponding `removeEventListener`.
- Lingering `requestAnimationFrame` loops running even when the graph canvas is hidden, idle, or when the tab is backgrounded.
- Retaining references to deleted DOM elements in closures, undo/redo stacks, or edge maps.
- Accumulating unrevoked `URL.createObjectURL()` blobs on project export/import.

#### Prescribed Cleanup Protocols

1. **The `AbortController` Pattern for Event Listeners**:
   - For temporary operations (such as dragging a cable or panning), attach listeners using the modern DOM `AbortController` signal pattern so a single `.abort()` cleanly purges all listeners without needing separate callback references:
   ```javascript
   function startCableDrag(e, socket) {
     const dragController = new AbortController();
     const { signal } = dragController;

     window.addEventListener('pointermove', onMove, { signal });
     window.addEventListener('pointerup', onUp, { signal });
     window.addEventListener('keydown', onKeyDown, { signal }); // e.g. ESC to cancel

     function cleanUp() {
       dragController.abort(); // Drops all 3 listeners in one atomic call
       cleanupDragPreview();
     }

     function onMove(moveEvt) { /* update cable */ }
     function onUp(upEvt) { /* connect */ cleanUp(); }
     function onKeyDown(keyEvt) { if (keyEvt.key === 'Escape') cleanUp(); }
   }
   ```

2. **`requestAnimationFrame` Lifecycle & Idle Throttling**:
   - Visual cable rendering or canvas repainting should **only render when dirty** (dirty flag pattern) or when an active transition is occurring.
   - Stop animations immediately when `document.hidden` is true using `visibilitychange`:
   ```javascript
   document.addEventListener('visibilitychange', () => {
     if (document.hidden) {
       animationEngine.pause();
     } else {
       animationEngine.resume();
     }
   });
   ```

3. **Object URL Sanitation**:
   - Whenever `URL.createObjectURL(blob)` is used (for JSON exports or standalone HTML downloads), immediately revoke it using `setTimeout(() => URL.revokeObjectURL(url), 60000)` or immediately after the virtual `<a>` element download click triggers.

4. **DOM-to-Model Decoupling**:
   - Nodes must store plain JSON-serializable state (`node.state`). Never store DOM element references or cyclic closures inside `node.state`.

---

## 2. Defensive Coding Standards for All Team Modules

All 10 Agents must write production code according to the following mandatory defensive standards.

### 2.1. Invariant Rules
1. **Zero External Dependencies**:
   - Do not import external CDNs (no Tailwind CDN, no React, no lodash, no FontAwesome). Everything must be built with standard modern vanilla Web APIs (HTML5, CSS3, ES2022+ JavaScript). This guarantees 100% offline capability, zero supply chain attacks, and instantaneous boot times.
2. **Strict Null & Undefined Safety**:
   - Never access nested properties without optional chaining (`?.`) or fallback nullish coalescing (`??`).
   - Bad: `const text = node.inputs[0].value.text;`
   - Good: `const text = node?.inputs?.[0]?.value?.text ?? "";`
3. **Pure Execution Kernels**:
   - Computational node logic (e.g., math, variable evaluation, prompt string interpolation) must be implemented as pure functions that accept state and input arguments and return output payloads without mutating caller arguments.
4. **Isolated Error Boundaries**:
   - Every node execution step must be encapsulated in a defensive error boundary. A single script error or JSON parse failure inside one node must **never** take down the entire application or corrupt the graph state.
   ```javascript
   async function executeNodeSafely(node, context) {
     try {
       context.tick(node.id);
       node.setStatus('running');
       const outputs = await node.execute(context);
       node.setStatus('success');
       return outputs;
     } catch (err) {
       node.setStatus('error', err.message);
       console.error(`[NodeExecutionError] ${node.title} (${node.id}):`, err);
       // Allow graph engine to handle error without unhandled promise rejection
       throw err;
     }
   }
   ```

---

### 2.2. Module-Specific Defensive Guidelines

#### Agent 02: Graph Engine Dev
- Clamp zoom levels strictly between $0.15\times$ and $3.0\times$.
- Use `transform: translate3d(x, y, 0) scale(s)` to trigger GPU hardware acceleration for pan/zoom.
- Always use `pointer-events: none` on SVG wire paths during cable drawing to prevent the wire itself from obstructing the target socket drop zone.
- Guard against NaN or infinite coordinates in bezier control points (`isNaN(p0x)` checks before SVG path generation).

#### Agent 03: LLM Runtime Dev
- Enforce strict parameter validation before sending API payloads (e.g. `temperature` must be clamped between $0.0$ and $2.0$, `max_tokens` must be a positive integer).
- Safely parse Server-Sent Events (SSE) streaming lines: handle split chunks where `data: {...}` spans across multiple stream chunk boundaries.
- Never crash if an unknown or malformed chunk arrives from Ollama/OpenRouter/Anthropic; log warning and continue parsing.

#### Agent 04: Frontend Customizer Dev
- When rendering user-controlled story boxes or rich text, **sanitize HTML** to prevent XSS (Cross-Site Scripting) if rendering dynamic content, or use `textContent` / safe DOM construction methods.
- Ensure all interactive UI elements (buttons, inputs) remain accessible via keyboard (`tabindex`, `aria-label`).
- Ensure UI components dynamically reflow and respect theme variables without hardcoded hex codes.

#### Agent 05: Game Logic Dev
- Variable evaluation: strictly avoid `eval()` or `Function()` with unsanitized user strings. Implement a safe expression evaluator or use a strictly validated AST / tokenized parser for condition checks (e.g., `hp <= 0`, `gold >= 50`).
- Guard against negative counters, array out-of-bounds in inventory items, and circular state machine transitions without player input.

#### Agent 06: Storage & Presets Dev
- LocalStorage Quota Exceeded guard: wrap `localStorage.setItem` in a `try...catch`. If `QuotaExceededError` occurs, alert the user cleanly and offer to export project to file rather than losing progress.
- Schema Migration & Versioning: every project JSON must carry `"version": 1`. Check version on load and provide safe default fallbacks for missing properties.
- Validate project JSON structure with a schema validator before replacing current in-memory graph.

#### Agent 07: UI/UX & CSS Designer
- Avoid CSS rules with high specificity wars or expensive layout recalculations (`will-change` should be used sparingly on active drag layers only).
- Ensure color contrast ratios conform to WCAG AA standards within the warm dark "Cosy" aesthetic.
- Handle responsive breakpoints (desktop, tablet, mobile split-view toggles) seamlessly.

#### Agent 09: QA & Test Engineer
- Validate edge cases: empty graphs, single-node execution, 1,000-node stress graphs, disconnected graphs, corrupted JSON import strings.
- Verify that every error thrown by the system produces a user-intelligible message on screen instead of a blank page.

---

## 3. Verification Checklist for Code Reviews

Before marking any module complete, verify:
- [ ] No `eval()` or unsafe dynamic code execution.
- [ ] No API keys serialized to export files or project JSON.
- [ ] All event listeners removed or bound via `AbortSignal`.
- [ ] All graph deletions clean up corresponding edges atomically.
- [ ] DFS or step-counter loop guards present in execution propagation.
- [ ] Resizing does not cause pointer coordinate drift.
- [ ] Offline Mock LLM functions seamlessly when disconnected.
- [ ] LocalStorage quota errors caught gracefully.

---
*Signed by Agent 08 (Code Auditor & Error Prevention Specialist)*
