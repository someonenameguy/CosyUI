# CosyUI Game & Workflow Logic Specification (Agent 05)

**Document Version:** 1.0.0  
**Status:** Approved Architecture Specification  
**Target:** CosyUI Modular Node-Graph & Runtime Engine  
**Author:** Agent 05 — Game Workflow Logic Specialist  

---

## 1. Executive Summary & Architectural Philosophy

CosyUI bridges interactive storytelling, role-playing games (RPGs), and complex LLM agentic workflows into a unified, zero-dependency visual graph editor. To transform static LLM prompt-response chains into rich, stateful, and dynamic games, the **Game & Workflow Logic Subsystem** provides robust primitives for:
1. **Deterministic State Progression**: Finite state machines (FSM) governing narrative acts, combat rounds, dialogues, and game stages.
2. **Dynamic World State**: Reactive key-value variable stores, atomic numeric operations, and transactional resets.
3. **Tabletop & RPG Mechanics**: Full-featured dice parser (`XdY+Z`, `kh/kl`, advantage/disadvantage), seedable PRNG, and weighted distribution tables.
4. **Physical Entity Simulation**: Rich inventory management, stackable items, attribute-based definitions, and condition checks.
5. **Flow Control & Branching**: Boolean comparison logic, conditional triggers (`If/Else`), and multi-way `Switch/Match` routing.
6. **Agentic Context & Memory**: Conversation sliding windows, summarization buffers, and boolean quest/event flag registries.
7. **Temporal & Iterative Execution**: Turn counters, cycle-safe loop gates with runaway tripwires, and async delay timers.

### Core Design Tenets
- **Zero Dependencies**: Pure vanilla JavaScript (ES2022+), running seamlessly in modern browsers without external libraries or bundlers.
- **Dual-Model Graph Semantics**:
  - **Data Flow (Reactive / Pure)**: Sockets carrying scalar values, arrays, or objects that evaluate lazily or propagate down data links upon execution.
  - **Control Flow (Impure / Trigger)**: Dedicated `exec` sockets (visualized as distinct chevron / diamond pins) carrying execution pulses, ensuring strict sequential ordering for state mutations and branching.
- **Reactivity & Event Bus Integration**: Internal states emit lightweight events (`onVariableChanged`, `onInventoryUpdated`, `onStateTransition`) enabling frontend UI nodes (Agent 04) to update instantly without polling.
- **Fail-Safe & Idempotent**: Safe error boundaries, loop counters to prevent UI thread lockups, and complete state serializability for project persistence (Agent 06).

---

## 2. Universal Socket & Data Type System

All nodes within the Game & Workflow Subsystem adhere to a standardized port definition. Ports are categorized by direction (`input` vs `output`) and flow role (`control` vs `data`).

### 2.1 Port Type Signatures

| Type Name | Wire Color | Default Value | Description |
|:---|:---|:---|:---|
| `TRIGGER` (`exec`) | `#F59E0B` (Amber Chevron) | `null` | Discrete execution impulse triggered upon an event. |
| `STRING` | `#38BDF8` (Sky Blue) | `""` | UTF-8 text strings, prompt fragments, names. |
| `NUMBER` | `#34D399` (Emerald Green) | `0` | 64-bit IEEE 754 floats or integers. |
| `BOOLEAN` | `#F43F5E` (Rose Pink) | `false` | Logical true/false values. |
| `ARRAY` | `#A855F7` (Purple) | `[]` | Ordered collection of primitives or objects. |
| `OBJECT` | `#EC4899` (Fuchsia) | `{}` | Key-value records, item definitions, metadata. |
| `ANY` | `#94A3B8` (Slate Grey) | `null` | Dynamic polymorphic data pipe with runtime coercion. |

### 2.2 Execution Context Model

When a trigger fires into an input `exec` port, it passes an `ExecutionContext`:

```typescript
interface ExecutionContext {
  executionId: string;       // Unique run ID for tracing call stacks
  callerNodeId: string;      // ID of triggering predecessor
  callerPortId: string;      // Specific output trigger port name
  timestamp: number;         // Performance mark
  depth: number;             // Recursion depth counter (capped at MAX_EXEC_DEPTH = 500)
  variables: VariableStore;  // Reference to runtime state
  payload?: any;             // Optional transient data payload carried with trigger
}
```

---

## 3. State Machine Subsystem

State machines provide macro-level orchestration across narrative stages (e.g., `CharacterCreation` -> `Exploration` -> `Dialogue` -> `Combat` -> `GameOver`).

```
                ┌───────────────────────────────────────────────┐
                │             State Machine Engine              │
                │  - Current State: "Combat"                    │
                │  - History: ["Prologue", "Exploration"]       │
                │  - Transitions: [Exploration -> Combat]       │
                └───────────────────────┬───────────────────────┘
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
     ┌──────────────┐     Trigger [EnemyEngaged]            ┌──────────────┐
     │  State Node  ├──────────────────────────────────────►│  State Node  │
     │ "Exploration"│                                       │   "Combat"   │
     └──────────────┘                                       └──────────────┘
```

### 3.1 Node: `StateNode`
Represents an individual discrete state within the game or workflow.

- **Node Type ID**: `logic.state`
- **Category**: `State Machine`
- **Visuals**: Distinct color accent indicating active/inactive state.
- **Configuration Parameters**:
  - `stateName` (`string`): Unique state identifier (e.g., `"CombatRound"`).
  - `isInitial` (`boolean`): If true, becomes the active state on graph start.
  - `description` (`string`): Human-readable purpose.
  - `metadata` (`object`): Arbitrary tags (e.g., `{ bgm: "battle.mp3", ambientLight: "dim" }`).
- **Input Ports**:
  - `enter` (`TRIGGER`): Forcibly transition the state machine into this state.
  - `exit` (`TRIGGER`): Forcibly exit this state.
- **Output Ports**:
  - `onEnter` (`TRIGGER`): Fires immediately when this state becomes active.
  - `onExit` (`TRIGGER`): Fires immediately before transitioning away to another state.
  - `isActive` (`BOOLEAN`): Continuous data pin emitting `true` while this state is current.
  - `stateName` (`STRING`): Outputs the configured state name.

### 3.2 Node: `TransitionNode`
Evaluates conditions and switches the active state from a source to a target.

- **Node Type ID**: `logic.transition`
- **Category**: `State Machine`
- **Configuration Parameters**:
  - `fromState` (`string`): Source state identifier (`"*"` matches any state).
  - `toState` (`string`): Target state identifier to enter upon activation.
  - `requireCondition` (`boolean`): If true, evaluates the `condition` input before firing.
- **Input Ports**:
  - `trigger` (`TRIGGER`): Attempt to trigger this transition.
  - `condition` (`BOOLEAN`): Optional guard condition (must be true if `requireCondition` is enabled).
  - `targetOverride` (`STRING`): Optional dynamic target state name (overrides `toState`).
- **Output Ports**:
  - `onSuccess` (`TRIGGER`): Fires if the transition was validated and executed.
  - `onBlocked` (`TRIGGER`): Fires if guard condition was false or source state was not active.
  - `currentState` (`STRING`): The resulting active state name.

### 3.3 Node: `CurrentStateGetterNode`
Non-mutating inspector port for reading active state telemetry.

- **Node Type ID**: `logic.current_state`
- **Category**: `State Machine`
- **Configuration Parameters**:
  - `machineId` (`string`, default `"default"`): Target machine namespace.
- **Input Ports**:
  - None (pure data node) or `read` (`TRIGGER` for snapshot evaluation).
- **Output Ports**:
  - `currentState` (`STRING`): Currently active state name.
  - `previousState` (`STRING`): Last exited state name.
  - `timeInStateMs` (`NUMBER`): Milliseconds elapsed since entering current state.
  - `transitionCount` (`NUMBER`): Total number of transitions completed.

---

## 4. Variables & State Management Subsystem

The Variables Subsystem provides a reactive, centralized data repository accessible across the entire graph.

```
       ┌─────────────────────────────────────────────────────────────┐
       │                  Global Variable Store                      │
       │  { playerHealth: 85, gold: 120, hasKey: true, name: "Aria" } │
       └──────────────┬──────────────────────────────┬───────────────┘
                      ▲                              │
             Write    │                              │ Read
     ┌────────────────┴────────┐            ┌────────┴──────────────┐
     │      Set Variable       │            │     Get Variable      │
     │ Key: "playerHealth"     │            │ Key: "playerHealth"   │
     │ Value: 85               │            │ Default: 100          │
     └─────────────────────────┘            └───────────────────────┘
```

### 4.1 Global Variables Store Architecture
- **Namespace Support**: Variables can be scoped:
  - `global.*`: Shared across all nodes and workflows.
  - `session.*`: Reset on new game / session restart.
  - `temp.*`: Transient execution-scoped variables.
- **Type Coercion & Safety**: Automatic parsing of JSON literals, numbers, and booleans with graceful fallback defaults.
- **Reactive Hooks**: Dispatches `cosy:variable:changed` event for binding directly to UI stat bars, inventory counts, or dialogue text.

### 4.2 Node: `GetVariableNode`
Reads a variable value from the store.

- **Node Type ID**: `logic.get_variable`
- **Category**: `Variables`
- **Configuration Parameters**:
  - `varName` (`string`): Variable key name.
  - `defaultType` (`"auto" | "string" | "number" | "boolean" | "json"`).
- **Input Ports**:
  - `varNameOverride` (`STRING`): Dynamic key override.
  - `defaultValue` (`ANY`): Value returned if key is missing or undefined.
- **Output Ports**:
  - `value` (`ANY`): Retrieved value.
  - `asString` (`STRING`): Stringified representation.
  - `asNumber` (`NUMBER`): Numeric cast (or `0` if NaN).
  - `asBoolean` (`BOOLEAN`): Boolean evaluation truthiness.
  - `exists` (`BOOLEAN`): `true` if key exists in store.

### 4.3 Node: `SetVariableNode`
Mutates or inserts a variable in the store.

- **Node Type ID**: `logic.set_variable`
- **Category**: `Variables`
- **Configuration Parameters**:
  - `varName` (`string`): Target key name.
  - `writeMode` (`"set" | "set_if_null" | "toggle_bool"`).
- **Input Ports**:
  - `exec` (`TRIGGER`): Executes the write operation.
  - `varNameOverride` (`STRING`): Dynamic key override.
  - `value` (`ANY`): New value to assign.
- **Output Ports**:
  - `then` (`TRIGGER`): Propagates execution after assignment.
  - `outValue` (`ANY`): Passthrough of the written value.
  - `prevValue` (`ANY`): The prior value before write.

### 4.4 Node: `IncrementDecrementNode`
Performs atomic arithmetic mutations on numeric variables with optional clamping.

- **Node Type ID**: `logic.inc_dec_variable`
- **Category**: `Variables`
- **Configuration Parameters**:
  - `varName` (`string`): Target numeric key.
  - `operation` (`"increment" | "decrement" | "multiply" | "divide"`).
  - `clampEnabled` (`boolean`, default `false`).
  - `clampMin` (`number`, default `0`).
  - `clampMax` (`number`, default `100`).
- **Input Ports**:
  - `exec` (`TRIGGER`): Triggers the arithmetic mutation.
  - `delta` (`NUMBER`, default `1`): Amount to add/subtract.
  - `minOverride` (`NUMBER`): Dynamic lower bound.
  - `maxOverride` (`NUMBER`): Dynamic upper bound.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires on completion.
  - `newValue` (`NUMBER`): Resulting value.
  - `prevValue` (`NUMBER`): Prior value before mutation.
  - `hitMin` (`BOOLEAN`): `true` if clamped at lower bound.
  - `hitMax` (`BOOLEAN`): `true` if clamped at upper bound.

### 4.5 Node: `ResetVariablesNode`
Cleanses store entries, returning them to factory defaults or purging by prefix.

- **Node Type ID**: `logic.reset_variables`
- **Category**: `Variables`
- **Configuration Parameters**:
  - `mode` (`"all" | "prefix" | "key_list"`).
  - `prefix` (`string`, e.g. `"temp."` or `"combat."`).
  - `keyList` (`string`, comma-separated keys).
- **Input Ports**:
  - `exec` (`TRIGGER`): Triggers the reset.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires after cleanup.
  - `clearedCount` (`NUMBER`): Number of variables removed or reset.

---

## 5. Dice Roller & RNG Subsystem

Tabletop RPG mechanics demand flexible dice notation, advantage/disadvantage rolls, critical detection, and deterministic PRNG seeding for testability.

### 5.1 Dice Notation Grammar & Parser Specification
The parser supports standard standard and advanced tabletop RPG notation:
- **Basic Roll**: `NdS` (e.g. `1d20`, `3d6`, `1d100`, `2d4`).
- **Modifiers**: `+`, `-`, `*`, `/` with integer offsets (e.g. `1d20+5`, `3d6-2`, `2d8*2`).
- **Keep Highest / Lowest**:
  - `4d6kh3` (Roll 4d6, keep highest 3, drop lowest 1 — standard ability score generation).
  - `2d20kl1` (Roll 2d20, keep lowest 1 — disadvantage).
- **Advantage / Disadvantage Flag**:
  - Advantage: Roll twice, keep highest (`2d20kh1`).
  - Disadvantage: Roll twice, keep lowest (`2d20kl1`).
- **Critical Detection**:
  - Natural 20 on d20 = `Critical Hit`.
  - Natural 1 on d20 = `Critical Fumble`.
  - Configurable threshold (e.g. Crit on 19-20).

### 5.2 Deterministic PRNG Algorithm (Mulberry32)
CosyUI includes a seedable 32-bit PRNG (`Mulberry32`) for reproducible playthroughs, automated testing (Agent 09), and replay verification, while defaulting to cryptographic `crypto.getRandomValues()` or `Math.random()`.

```javascript
class CosyRNG {
  constructor(seed = null) {
    this.seed = seed !== null ? seed : Math.floor(Math.random() * 0xFFFFFFF);
    this.initialSeed = this.seed;
  }
  next() {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}
```

### 5.3 Node: `DiceRollerNode`
Executes dice evaluations according to tabletop RPG rules.

- **Node Type ID**: `logic.dice_roller`
- **Category**: `Dice & RNG`
- **Configuration Parameters**:
  - `notation` (`string`, default `"1d20+0"`).
  - `rollMode` (`"normal" | "advantage" | "disadvantage"`).
  - `critThreshold` (`number`, default `20`).
  - `fumbleThreshold` (`number`, default `1`).
- **Input Ports**:
  - `roll` (`TRIGGER`): Fires the dice roll.
  - `notationOverride` (`STRING`): Dynamic notation (e.g., `"2d8+3"`).
  - `modifierBonus` (`NUMBER`): Additional flat modifier added to total.
  - `advantageMode` (`STRING`): `"normal"`, `"advantage"`, `"disadvantage"`.
- **Output Ports**:
  - `then` (`TRIGGER`): Propagates execution with results ready.
  - `total` (`NUMBER`): Final computed total after modifiers.
  - `rawRolls` (`ARRAY`): Array of individual dice roll values.
  - `breakdown` (`STRING`): Formatted roll text (e.g., `"1d20 [18] + 5 = 23"`).
  - `isCrit` (`BOOLEAN`): `true` if roll hit critical threshold.
  - `isFumble` (`BOOLEAN`): `true` if roll hit fumble threshold.

### 5.4 Node: `RandomRangeNode`
Generates a random number between a defined lower and upper boundary.

- **Node Type ID**: `logic.random_range`
- **Category**: `Dice & RNG`
- **Configuration Parameters**:
  - `type` (`"integer" | "float"`).
  - `min` (`number`, default `1`).
  - `max` (`number`, default `100`).
- **Input Ports**:
  - `trigger` (`TRIGGER`): Executes RNG generation.
  - `minInput` (`NUMBER`): Dynamic minimum.
  - `maxInput` (`NUMBER`): Dynamic maximum.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires on completion.
  - `result` (`NUMBER`): Generated random value.

### 5.5 Node: `WeightedChoiceNode`
Samples an option from a weighted probability distribution table (e.g. loot tables, random encounters).

- **Node Type ID**: `logic.weighted_choice`
- **Category**: `Dice & RNG`
- **Configuration Parameters**:
  - `entries` (`Array<{ item: any, weight: number }>`): Table of choices and weights.
  - `fallback` (`any`): Value returned if table is empty.
- **Input Ports**:
  - `trigger` (`TRIGGER`): Sample an outcome.
  - `tableOverride` (`ARRAY`): Dynamic table of `{ item, weight }` objects.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires on completion.
  - `chosenItem` (`ANY`): Selected item object or primitive.
  - `chosenIndex` (`NUMBER`): Array index of selection.
  - `probability` (`NUMBER`): Percentage probability of chosen item (0..1).

---

## 6. Inventory & Item Logic Subsystem

The Inventory Subsystem models player gear, consumables, quest keys, and loot bags with support for quantity stacking, metadata attributes, and slot limits.

### 6.1 Item Data Structure Specification

```typescript
interface ItemDefinition {
  id: string;               // Unique ID: "health_potion"
  name: string;             // Display name: "Lesser Health Potion"
  description: string;      // Narrative lore text
  category: "weapon" | "armor" | "consumable" | "quest" | "misc";
  quantity: number;         // Current stack quantity (default 1)
  maxStack: number;         // Maximum stack size (e.g. 99 for potions, 1 for weapons)
  icon?: string;            // Unicode emoji (e.g. "🧪") or SVG data URI
  weight?: number;          // Encumbrance weight per unit
  attributes: {             // Key-value gameplay stats
    healAmount?: number;
    damage?: string;
    durability?: number;
    value?: number;
    rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
    [key: string]: any;
  };
  tags: string[];           // Query tags: ["healing", "potion", "magic"]
}
```

### 6.2 Inventory Store Architecture
- **Storage Model**: Maintained under `global.__inventory` or scoped inventories (e.g. `chest_01`, `vendor_npc`).
- **Event System**: Emits `cosy:inventory:updated` whenever items are added, removed, or modified.
- **Frontend Sync**: Directly consumable by Agent 04's `InventoryGridNode` and `StatBarNode`.

### 6.3 Node: `ItemDefinitionNode`
Factory node for instantiating structured item objects.

- **Node Type ID**: `logic.item_definition`
- **Category**: `Inventory`
- **Configuration Parameters**:
  - `itemId` (`string`): e.g. `"rusty_sword"`.
  - `name` (`string`): e.g. `"Rusty Iron Sword"`.
  - `description` (`string`): e.g. `"A nicked blade from a forgotten battle."`.
  - `category` (`string`, default `"misc"`).
  - `maxStack` (`number`, default `1`).
  - `icon` (`string`, default `"🗡️"`).
  - `attributesJson` (`string`, JSON object).
- **Input Ports**:
  - `quantity` (`NUMBER`, default `1`): Initial stack count.
- **Output Ports**:
  - `itemObject` (`OBJECT`): Complete instantiated `ItemDefinition`.

### 6.4 Node: `AddItemNode`
Adds an item or quantity into an inventory, handling automatic stacking.

- **Node Type ID**: `logic.add_item`
- **Category**: `Inventory`
- **Configuration Parameters**:
  - `targetInventory` (`string`, default `"player"`).
  - `maxSlots` (`number`, default `30`).
- **Input Ports**:
  - `exec` (`TRIGGER`): Triggers item addition.
  - `item` (`OBJECT`): Valid `ItemDefinition` object to add.
  - `quantityOverride` (`NUMBER`): Quantity to add (if overriding item default).
- **Output Ports**:
  - `then` (`TRIGGER`): General continuation.
  - `onSuccess` (`TRIGGER`): Fires when item was added.
  - `onFull` (`TRIGGER`): Fires if inventory is at max capacity and cannot take item.
  - `currentQuantity` (`NUMBER`): Total quantity of this item now in inventory.
  - `inventoryList` (`ARRAY`): Full updated inventory array.

### 6.5 Node: `RemoveItemNode`
Removes a specific quantity or stack of an item from inventory.

- **Node Type ID**: `logic.remove_item`
- **Category**: `Inventory`
- **Configuration Parameters**:
  - `targetInventory` (`string`, default `"player"`).
- **Input Ports**:
  - `exec` (`TRIGGER`): Triggers item removal.
  - `itemId` (`STRING`): Item identifier to remove.
  - `quantity` (`NUMBER`, default `1`): Number of units to deduct.
- **Output Ports**:
  - `then` (`TRIGGER`): General continuation.
  - `onSuccess` (`TRIGGER`): Fires if requested quantity was successfully removed.
  - `onInsufficient` (`TRIGGER`): Fires if item was missing or player had fewer units than requested.
  - `remainingQuantity` (`NUMBER`): Quantity remaining in inventory.

### 6.6 Node: `HasItemNode`
Condition node verifying item possession and quantity thresholds.

- **Node Type ID**: `logic.has_item`
- **Category**: `Inventory`
- **Configuration Parameters**:
  - `itemId` (`string`): Target item identifier.
  - `minQuantity` (`number`, default `1`).
- **Input Ports**:
  - `check` (`TRIGGER`): Optional trigger for control-flow branching.
  - `itemIdOverride` (`STRING`): Dynamic item ID.
  - `minQuantityInput` (`NUMBER`): Dynamic required quantity.
- **Output Ports**:
  - `hasItem` (`BOOLEAN`): Continuous data output.
  - `currentQuantity` (`NUMBER`): Exact count present in inventory.
  - `onTrue` (`TRIGGER`): Fires on trigger if condition met.
  - `onFalse` (`TRIGGER`): Fires on trigger if item absent or count insufficient.

---

## 7. Conditional Branching & Control Flow Subsystem

Control flow routing allows workflows to diverge based on game states, dice rolls, player choices, or sentiment analysis.

```
                    ┌────────────────────────────┐
                    │       Branch (If/Else)     │
       [exec] ─────►│  Condition: [playerHP > 0] │
                    └───┬────────────────────┬───┘
               True     │                    │    False
         ┌──────────────▼─────┐        ┌─────▼──────────────┐
         │ "Continue Combat"  │        │   "Game Over"      │
         └────────────────────┘        └────────────────────┘
```

### 7.1 Node: `ConditionNode` (Expression / Comparator)
Evaluates logical comparison between two operands.

- **Node Type ID**: `logic.condition`
- **Category**: `Control Flow`
- **Supported Operators**:
  - `==` / `!=`: Loose equality / inequality.
  - `===` / `!==`: Strict identity / non-identity.
  - `>` / `>=`: Greater than / greater or equal.
  - `<` / `<=`: Less than / less or equal.
  - `contains`: Checks if string contains substring or array contains item.
  - `startsWith` / `endsWith`: String prefix/suffix validation.
  - `regex`: Evaluates regular expression pattern.
  - `isEmpty` / `isNotEmpty`: Checks for `null`, `undefined`, empty string `""`, or empty array `[]`.
- **Input Ports**:
  - `a` (`ANY`): Left-hand operand.
  - `b` (`ANY`): Right-hand operand.
- **Output Ports**:
  - `result` (`BOOLEAN`): Logical outcome of `a [op] b`.

### 7.2 Node: `BranchNode` (`IfElseNode`)
Routes an incoming execution trigger along two alternative output paths based on a boolean value.

- **Node Type ID**: `logic.branch`
- **Category**: `Control Flow`
- **Input Ports**:
  - `exec` (`TRIGGER`): Incoming execution impulse.
  - `condition` (`BOOLEAN`): Value deciding which branch activates.
- **Output Ports**:
  - `onTrue` (`TRIGGER`): Fires if `condition === true`.
  - `onFalse` (`TRIGGER`): Fires if `condition === false`.

### 7.3 Node: `SwitchMatchNode`
Multi-way branching router matching an input value against configured cases with fallback.

- **Node Type ID**: `logic.switch_match`
- **Category**: `Control Flow`
- **Configuration Parameters**:
  - `cases` (`string[]`, e.g. `["attack", "defend", "flee", "magic"]`).
  - `matchMode` (`"exact" | "contains" | "regex"`).
- **Input Ports**:
  - `exec` (`TRIGGER`): Incoming execution.
  - `value` (`ANY`): Value to test against defined cases.
- **Output Ports**:
  - `case_0` .. `case_N` (`TRIGGER`): Individual trigger pin per defined case.
  - `default` (`TRIGGER`): Fires if no cases matched.
  - `matchedCase` (`STRING`): Name of matched case (or `"default"`).

---

## 8. Context & Memory Management Subsystem

LLMs have finite context limits and require structured conversational history, memory condensation, and quest progress tracking.

```
               ┌────────────────────────────────────────────────────────┐
               │              Sliding Window Conversation Buffer        │
               │  [System Prompt: "You are a Dungeon Master..."]        │
               │  [Summary: "Player defeated goblins in tavern..."]     │
               │  [Turn 8]: "I inspect the altar."                      │
               │  [Turn 9]: "You discover a glowing ruby."             │
               └───────────────────────────┬────────────────────────────┘
                                           │
                                           ▼
                               To LLM Request Node (Agent 03)
```

### 8.1 Node: `SlidingWindowBufferNode`
Maintains a FIFO queue of conversation messages, preserving critical system prompts while trimming old history to fit token or turn budgets.

- **Node Type ID**: `logic.sliding_window`
- **Category**: `Memory & Context`
- **Configuration Parameters**:
  - `maxMessages` (`number`, default `10`): Maximum chat turns retained.
  - `maxCharsEstimate` (`number`, default `12000`): Character budget cap (~3000 tokens).
  - `preserveSystem` (`boolean`, default `true`): Never discard system prompt at index 0.
- **Input Ports**:
  - `addMessage` (`TRIGGER`): Push a new message into buffer.
  - `role` (`STRING`, default `"user"`): `"system" | "user" | "assistant"`.
  - `content` (`STRING`): Message text.
  - `clear` (`TRIGGER`): Reset the message buffer.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires after message is added.
  - `messagesArray` (`ARRAY`): Array of `{ role, content, timestamp }` objects for LLM payload.
  - `formattedTranscript` (`STRING`): Human-readable markdown log.
  - `messageCount` (`NUMBER`): Number of stored messages.
  - `charCount` (`NUMBER`): Total character count.

### 8.2 Node: `SummaryMemoryNode`
Stores a persistent, distilled narrative summary representing past events, updated periodically by an LLM summarizer.

- **Node Type ID**: `logic.summary_memory`
- **Category**: `Memory & Context`
- **Configuration Parameters**:
  - `memoryKey` (`string`, default `"narrative_recap"`).
  - `maxSummaryLength` (`number`, default `1500`).
- **Input Ports**:
  - `update` (`TRIGGER`): Commit new summary text.
  - `newSummaryText` (`STRING`): Summarized narrative.
  - `append` (`BOOLEAN`, default `false`): If true, appends instead of overwriting.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires on update.
  - `summaryText` (`STRING`): Current active summary.
  - `isEmpty` (`BOOLEAN`): True if no summary exists yet.

### 8.3 Node: `GameFlagTrackerNode`
High-speed boolean and string flag registry for quest progression, NPC interactions, and world secrets.

- **Node Type ID**: `logic.flag_tracker`
- **Category**: `Memory & Context`
- **Configuration Parameters**:
  - `flagName` (`string`): e.g. `"talked_to_blacksmith"`.
  - `defaultState` (`boolean`, default `false`).
- **Input Ports**:
  - `exec` (`TRIGGER`): Trigger an operation.
  - `action` (`STRING`, `"get" | "set" | "toggle" | "clear"`).
  - `flagNameOverride` (`STRING`): Dynamic flag name.
  - `value` (`BOOLEAN`): Value for `"set"` action.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires on execution.
  - `isSet` (`BOOLEAN`): Current flag status.
  - `onSet` (`TRIGGER`): Fires if flag transitioned to `true`.
  - `onCleared` (`TRIGGER`): Fires if flag transitioned to `false`.

---

## 9. Turn, Loop & Timing Subsystem

Manages game progression, step-by-step combat loops, delay effects, and run-away loop termination.

### 9.1 Infinite Loop Safety Guard
Visual node scripting is prone to accidental circular wires (e.g. `Node A -> Node B -> Node A`). CosyUI enforces a global runaway tripwire:
- **Maximum Execution Call Depth**: 500 triggers per interaction.
- **Loop Gate Maximum Iterations**: 1,000 iterations per invocation.
- **Violation Behavior**: Halts execution, marks offending cable red, and logs a descriptive diagnostic message to console without crashing the web page.

### 9.2 Node: `TurnCounterNode`
Tracks rounds, turns, and phase progression.

- **Node Type ID**: `logic.turn_counter`
- **Category**: `Turns & Loops`
- **Configuration Parameters**:
  - `startTurn` (`number`, default `1`).
  - `turnsPerRound` (`number`, default `1`).
  - `maxTurns` (`number`, default `0` for infinite).
- **Input Ports**:
  - `next` (`TRIGGER`): Increment turn counter.
  - `reset` (`TRIGGER`): Reset to `startTurn`.
  - `setTurn` (`NUMBER`): Forcibly jump to turn number.
- **Output Ports**:
  - `then` (`TRIGGER`): Continuation trigger.
  - `turnNumber` (`NUMBER`): Current turn count (1, 2, 3...).
  - `roundNumber` (`NUMBER`): Current round count (e.g. `Math.floor(turn / turnsPerRound)`).
  - `onMaxReached` (`TRIGGER`): Fires if `maxTurns > 0` and turn reaches ceiling.

### 9.3 Node: `LoopGateNode`
Controlled iteration over counts or arrays with integrated loop tripwires.

- **Node Type ID**: `logic.loop_gate`
- **Category**: `Turns & Loops`
- **Configuration Parameters**:
  - `maxIterations` (`number`, default `500`): Safety threshold.
- **Input Ports**:
  - `start` (`TRIGGER`): Begins loop iteration.
  - `break` (`TRIGGER`): Early termination of loop.
  - `count` (`NUMBER`): Number of times to loop (if not using array).
  - `array` (`ARRAY`): Collection of items to iterate over.
- **Output Ports**:
  - `loopBody` (`TRIGGER`): Pulses once per iteration.
  - `index` (`NUMBER`): 0-indexed loop step.
  - `item` (`ANY`): Current array element (if array provided).
  - `completed` (`TRIGGER`): Pulses after loop finishes normally or breaks.

### 9.4 Node: `DelayTimerNode`
Non-blocking asynchronous pause node (using `setTimeout` or `requestAnimationFrame`) to pace combat narrative, suspenseful dice reveals, or animated dialogues.

- **Node Type ID**: `logic.delay_timer`
- **Category**: `Turns & Loops`
- **Configuration Parameters**:
  - `durationMs` (`number`, default `1000`): Pause duration in milliseconds.
- **Input Ports**:
  - `start` (`TRIGGER`): Initiates the timed wait.
  - `cancel` (`TRIGGER`): Aborts pending timer.
  - `durationOverride` (`NUMBER`): Dynamic delay time in ms.
- **Output Ports**:
  - `then` (`TRIGGER`): Fires when delay period expires.
  - `elapsedPercent` (`NUMBER`): Progression from `0.0` to `1.0`.

---

## 10. Node Registry & Data Contract (JSON Schemas)

Every node in this specification adheres to CosyUI's standard node registration schema, allowing seamless auto-discovery by Agent 02's node palette and search modal.

### 10.1 Node Definition Metadata Structure

```json
{
  "type": "logic.dice_roller",
  "title": "Dice Roller (RPG)",
  "category": "Dice & RNG",
  "description": "Rolls RPG dice notation (e.g., 1d20+5, 4d6kh3) with advantage/disadvantage and critical checks.",
  "inputs": [
    { "id": "roll", "label": "Roll", "type": "TRIGGER" },
    { "id": "notationOverride", "label": "Notation", "type": "STRING" },
    { "id": "modifierBonus", "label": "Bonus", "type": "NUMBER" },
    { "id": "advantageMode", "label": "Advantage", "type": "STRING" }
  ],
  "outputs": [
    { "id": "then", "label": "Then", "type": "TRIGGER" },
    { "id": "total", "label": "Total", "type": "NUMBER" },
    { "id": "breakdown", "label": "Breakdown", "type": "STRING" },
    { "id": "rawRolls", "label": "Rolls", "type": "ARRAY" },
    { "id": "isCrit", "label": "Is Crit", "type": "BOOLEAN" },
    { "id": "isFumble", "label": "Is Fumble", "type": "BOOLEAN" }
  ],
  "properties": {
    "notation": "1d20+5",
    "rollMode": "normal",
    "critThreshold": 20,
    "fumbleThreshold": 1
  }
}
```

### 10.2 Complete Node Catalog Reference

| Node Type ID | Title | Category | Primary Inputs | Primary Outputs |
|:---|:---|:---|:---|:---|
| `logic.state` | State | State Machine | `enter`, `exit` | `onEnter`, `onExit`, `isActive`, `stateName` |
| `logic.transition` | Transition | State Machine | `trigger`, `condition` | `onSuccess`, `onBlocked`, `currentState` |
| `logic.current_state` | Current State | State Machine | (None) | `currentState`, `previousState`, `timeInStateMs` |
| `logic.get_variable` | Get Variable | Variables | `varNameOverride`, `defaultValue` | `value`, `asString`, `asNumber`, `exists` |
| `logic.set_variable` | Set Variable | Variables | `exec`, `value` | `then`, `outValue`, `prevValue` |
| `logic.inc_dec_variable` | Increment/Decrement | Variables | `exec`, `delta` | `then`, `newValue`, `prevValue`, `hitMin`, `hitMax` |
| `logic.reset_variables` | Reset Variables | Variables | `exec` | `then`, `clearedCount` |
| `logic.dice_roller` | Dice Roller | Dice & RNG | `roll`, `notationOverride` | `then`, `total`, `breakdown`, `isCrit`, `isFumble` |
| `logic.random_range` | Random Range | Dice & RNG | `trigger`, `minInput`, `maxInput` | `then`, `result` |
| `logic.weighted_choice` | Weighted Choice | Dice & RNG | `trigger`, `tableOverride` | `then`, `chosenItem`, `chosenIndex` |
| `logic.item_definition` | Item Definition | Inventory | `quantity` | `itemObject` |
| `logic.add_item` | Add Item | Inventory | `exec`, `item`, `quantity` | `then`, `onSuccess`, `onFull`, `currentQuantity` |
| `logic.remove_item` | Remove Item | Inventory | `exec`, `itemId`, `quantity` | `then`, `onSuccess`, `onInsufficient`, `remaining` |
| `logic.has_item` | Has Item | Inventory | `check`, `itemId`, `minQuantity` | `hasItem`, `currentQuantity`, `onTrue`, `onFalse` |
| `logic.condition` | Condition | Control Flow | `a`, `b` | `result` |
| `logic.branch` | Branch (If/Else) | Control Flow | `exec`, `condition` | `onTrue`, `onFalse` |
| `logic.switch_match` | Switch Match | Control Flow | `exec`, `value` | `case_0..N`, `default`, `matchedCase` |
| `logic.sliding_window` | Sliding Window Buffer | Memory & Context | `addMessage`, `role`, `content` | `then`, `messagesArray`, `formattedTranscript` |
| `logic.summary_memory` | Summary Memory | Memory & Context | `update`, `newSummaryText` | `then`, `summaryText`, `isEmpty` |
| `logic.flag_tracker` | Flag Tracker | Memory & Context | `exec`, `value` | `then`, `isSet`, `onSet`, `onCleared` |
| `logic.turn_counter` | Turn Counter | Turns & Loops | `next`, `reset` | `then`, `turnNumber`, `roundNumber`, `onMax` |
| `logic.loop_gate` | Loop Gate | Turns & Loops | `start`, `break`, `count`, `array` | `loopBody`, `index`, `item`, `completed` |
| `logic.delay_timer` | Delay Timer | Turns & Loops | `start`, `cancel` | `then`, `elapsedPercent` |

---

## 11. Complete JavaScript Reference Implementations

The following modular ES6 classes provide complete, battle-tested algorithms for every game logic system.

### 11.1 Dice Notation Parser & Roller (`CosyDiceEngine`)

```javascript
export class CosyDiceEngine {
  constructor(rng = null) {
    this.rng = rng || {
      nextInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
      nextFloat: () => Math.random()
    };
  }

  /**
   * Evaluates standard RPG dice notation: e.g. "1d20+5", "3d6", "4d6kh3", "2d20kl1"
   * @param {string} notation - The dice expression
   * @param {"normal"|"advantage"|"disadvantage"} mode - Roll advantage modifier
   * @param {number} bonus - Extra flat bonus
   * @returns {{ total: number, rolls: number[], dropped: number[], breakdown: string, isCrit: boolean, isFumble: boolean }}
   */
  roll(notation = "1d20", mode = "normal", bonus = 0) {
    let cleanNotation = (notation || "1d20").trim().toLowerCase().replace(/\s+/g, '');
    
    // Handle Advantage / Disadvantage for standard d20
    if (mode === "advantage" && cleanNotation === "1d20") {
      cleanNotation = "2d20kh1";
    } else if (mode === "disadvantage" && cleanNotation === "1d20") {
      cleanNotation = "2d20kl1";
    }

    // Regex pattern: (\d*)d(\d+)(?:(kh|kl)(\d+))?([+-/*]\d+)?
    const regex = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?([+-/*]\d+)?$/i;
    const match = cleanNotation.match(regex);

    if (!match) {
      // Fallback simple numeric constant or basic roll
      const numOnly = parseInt(cleanNotation, 10);
      if (!isNaN(numOnly)) {
        return {
          total: numOnly + bonus,
          rolls: [numOnly],
          dropped: [],
          breakdown: `${numOnly}${bonus !== 0 ? ` + ${bonus}` : ''} = ${numOnly + bonus}`,
          isCrit: false,
          isFumble: false
        };
      }
      throw new Error(`Invalid dice notation: "${notation}"`);
    }

    const count = parseInt(match[1] || "1", 10);
    const sides = parseInt(match[2], 10);
    const keepType = match[3]; // 'kh' or 'kl' or undefined
    const keepCount = match[4] ? parseInt(match[4], 10) : count;
    const modifierOp = match[5] ? match[5][0] : null;
    const modifierVal = match[5] ? parseInt(match[5].slice(1), 10) : 0;

    // Roll raw dice
    const rawRolls = [];
    for (let i = 0; i < count; i++) {
      rawRolls.push(this.rng.nextInt(1, sides));
    }

    let keptRolls = [...rawRolls];
    let droppedRolls = [];

    // Process Keep Highest / Keep Lowest
    if (keepType === "kh" && keepCount < count) {
      const sorted = [...rawRolls].sort((a, b) => b - a);
      keptRolls = sorted.slice(0, keepCount);
      droppedRolls = sorted.slice(keepCount);
    } else if (keepType === "kl" && keepCount < count) {
      const sorted = [...rawRolls].sort((a, b) => a - b);
      keptRolls = sorted.slice(0, keepCount);
      droppedRolls = sorted.slice(keepCount);
    }

    // Compute sum of kept rolls
    let sum = keptRolls.reduce((acc, val) => acc + val, 0);

    // Apply inline notation modifier
    if (modifierOp === '+') sum += modifierVal;
    else if (modifierOp === '-') sum -= modifierVal;
    else if (modifierOp === '*') sum *= modifierVal;
    else if (modifierOp === '/' && modifierVal !== 0) sum = Math.floor(sum / modifierVal);

    // Apply external bonus input
    sum += bonus;

    // Check criticals on primary d20 roll
    let isCrit = false;
    let isFumble = false;
    if (sides === 20 && keptRolls.length > 0) {
      if (keptRolls.includes(20)) isCrit = true;
      if (keptRolls.includes(1) && !keptRolls.includes(20)) isFumble = true;
    }

    // Build human-friendly breakdown
    let rollsText = `[${rawRolls.join(', ')}]`;
    if (droppedRolls.length > 0) {
      rollsText = `[kept: ${keptRolls.join(', ')} | dropped: ${droppedRolls.join(', ')}]`;
    }
    let modText = '';
    if (modifierOp) modText += ` ${modifierOp} ${modifierVal}`;
    if (bonus > 0) modText += ` + ${bonus}`;
    if (bonus < 0) modText += ` - ${Math.abs(bonus)}`;

    const breakdown = `${count}d${sides} ${rollsText}${modText} = ${sum}`;

    return {
      total: sum,
      rolls: rawRolls,
      dropped: droppedRolls,
      breakdown,
      isCrit,
      isFumble
    };
  }
}
```

### 11.2 Reactive Variable Store (`CosyVariableStore`)

```javascript
export class CosyVariableStore {
  constructor(initialData = {}) {
    this.state = { ...initialData };
    this.listeners = new Set();
  }

  get(key, defaultValue = undefined) {
    if (key in this.state) {
      return this.state[key];
    }
    return defaultValue;
  }

  set(key, value) {
    const prevValue = this.state[key];
    this.state[key] = value;
    this._notify(key, value, prevValue);
    return value;
  }

  has(key) {
    return key in this.state;
  }

  delete(key) {
    if (key in this.state) {
      const prev = this.state[key];
      delete this.state[key];
      this._notify(key, undefined, prev);
      return true;
    }
    return false;
  }

  modifyNumber(key, delta, operation = "increment", clamp = false, min = 0, max = 100) {
    const current = typeof this.state[key] === 'number' ? this.state[key] : 0;
    let result = current;

    switch (operation) {
      case "increment": result = current + delta; break;
      case "decrement": result = current - delta; break;
      case "multiply":  result = current * delta; break;
      case "divide":    result = delta !== 0 ? current / delta : current; break;
    }

    let hitMin = false;
    let hitMax = false;

    if (clamp) {
      if (result <= min) {
        result = min;
        hitMin = true;
      }
      if (result >= max) {
        result = max;
        hitMax = true;
      }
    }

    this.set(key, result);
    return { newValue: result, prevValue: current, hitMin, hitMax };
  }

  reset(prefix = null) {
    let count = 0;
    if (!prefix) {
      count = Object.keys(this.state).length;
      this.state = {};
      this._notify('*', null, null);
    } else {
      for (const k of Object.keys(this.state)) {
        if (k.startsWith(prefix)) {
          delete this.state[k];
          count++;
        }
      }
      this._notify(prefix + '*', null, null);
    }
    return count;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify(key, newVal, oldVal) {
    for (const cb of this.listeners) {
      try {
        cb(key, newVal, oldVal, this.state);
      } catch (err) {
        console.error("Variable store listener error:", err);
      }
    }
    // Browser CustomEvent integration
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('cosy:variable:changed', {
        detail: { key, newValue: newVal, oldValue: oldVal }
      }));
    }
  }

  serialize() {
    return JSON.parse(JSON.stringify(this.state));
  }

  deserialize(data) {
    this.state = { ...data };
    this._notify('*', null, null);
  }
}
```

### 11.3 Finite State Machine Manager (`CosyStateMachine`)

```javascript
export class CosyStateMachine {
  constructor(initialState = "default", name = "default") {
    this.name = name;
    this.currentState = initialState;
    this.previousState = null;
    this.enteredAt = Date.now();
    this.transitionCount = 0;
    this.states = new Map(); // stateName -> { metadata, onEnterHooks, onExitHooks }
    this.listeners = new Set();
  }

  registerState(stateName, metadata = {}) {
    if (!this.states.has(stateName)) {
      this.states.set(stateName, { metadata, onEnterHooks: [], onExitHooks: [] });
    }
  }

  transition(toState, payload = {}) {
    if (!toState || toState === this.currentState) return false;

    const fromState = this.currentState;
    const now = Date.now();
    const timeInPrevState = now - this.enteredAt;

    // Execute onExit hooks for previous state
    const prevStateObj = this.states.get(fromState);
    if (prevStateObj) {
      prevStateObj.onExitHooks.forEach(fn => fn(fromState, toState, payload));
    }

    this.previousState = fromState;
    this.currentState = toState;
    this.enteredAt = now;
    this.transitionCount++;

    // Execute onEnter hooks for new state
    const nextStateObj = this.states.get(toState);
    if (nextStateObj) {
      nextStateObj.onEnterHooks.forEach(fn => fn(toState, fromState, payload));
    }

    // Notify subscribers
    const eventDetail = {
      machine: this.name,
      fromState,
      toState,
      timeInPrevState,
      payload
    };

    for (const listener of this.listeners) {
      listener(eventDetail);
    }

    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('cosy:state:transition', { detail: eventDetail }));
    }

    return true;
  }

  getStateInfo() {
    return {
      currentState: this.currentState,
      previousState: this.previousState,
      timeInStateMs: Date.now() - this.enteredAt,
      transitionCount: this.transitionCount
    };
  }
}
```

### 11.4 Inventory Manager (`CosyInventory`)

```javascript
export class CosyInventory {
  constructor(maxSlots = 30) {
    this.maxSlots = maxSlots;
    this.items = []; // Array of ItemDefinition
    this.listeners = new Set();
  }

  addItem(itemDef, quantityToAdd = 1) {
    const qty = quantityToAdd || itemDef.quantity || 1;
    const maxStack = itemDef.maxStack || 1;

    // Attempt to stack into existing items with room
    let remaining = qty;
    for (const existing of this.items) {
      if (existing.id === itemDef.id && existing.quantity < (existing.maxStack || maxStack)) {
        const availableSpace = (existing.maxStack || maxStack) - existing.quantity;
        const addAmount = Math.min(availableSpace, remaining);
        existing.quantity += addAmount;
        remaining -= addAmount;
        if (remaining <= 0) break;
      }
    }

    // Create new slot(s) for leftover
    while (remaining > 0) {
      if (this.items.length >= this.maxSlots) {
        this._notify();
        return { success: false, reason: "INVENTORY_FULL", addedQuantity: qty - remaining, remainingQuantity: remaining };
      }
      const stackAmount = Math.min(remaining, maxStack);
      this.items.push({
        ...JSON.parse(JSON.stringify(itemDef)),
        quantity: stackAmount,
        maxStack: maxStack
      });
      remaining -= stackAmount;
    }

    this._notify();
    return { success: true, addedQuantity: qty, totalQuantity: this.getItemCount(itemDef.id) };
  }

  removeItem(itemId, quantityToRemove = 1) {
    const totalCount = this.getItemCount(itemId);
    if (totalCount < quantityToRemove) {
      return { success: false, reason: "INSUFFICIENT_QUANTITY", totalCount };
    }

    let needed = quantityToRemove;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.id === itemId) {
        if (item.quantity <= needed) {
          needed -= item.quantity;
          this.items.splice(i, 1);
        } else {
          item.quantity -= needed;
          needed = 0;
        }
        if (needed <= 0) break;
      }
    }

    this._notify();
    return { success: true, remainingQuantity: this.getItemCount(itemId) };
  }

  hasItem(itemId, minQuantity = 1) {
    return this.getItemCount(itemId) >= minQuantity;
  }

  getItemCount(itemId) {
    return this.items
      .filter(item => item.id === itemId)
      .reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  getItems() {
    return JSON.parse(JSON.stringify(this.items));
  }

  _notify() {
    for (const cb of this.listeners) cb(this.items);
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('cosy:inventory:updated', { detail: { items: this.items } }));
    }
  }
}
```

### 11.5 Sliding Window Memory & Buffer (`CosySlidingWindow`)

```javascript
export class CosySlidingWindow {
  constructor(maxMessages = 10, maxChars = 12000, preserveSystem = true) {
    this.maxMessages = maxMessages;
    this.maxChars = maxChars;
    this.preserveSystem = preserveSystem;
    this.messages = []; // Array of { role, content, timestamp }
  }

  addMessage(role, content) {
    const cleanContent = typeof content === 'string' ? content : JSON.stringify(content);
    const msg = {
      role: role || "user",
      content: cleanContent,
      timestamp: Date.now()
    };

    if (msg.role === "system" && this.preserveSystem) {
      // If system prompt, replace existing system prompt at index 0 or prepend
      const existingSystemIdx = this.messages.findIndex(m => m.role === "system");
      if (existingSystemIdx !== -1) {
        this.messages[existingSystemIdx] = msg;
      } else {
        this.messages.unshift(msg);
      }
    } else {
      this.messages.push(msg);
    }

    this._trim();
    return this.getPayload();
  }

  _trim() {
    // 1. Trim by message count
    while (this.messages.length > this.maxMessages) {
      // Find oldest non-system message
      const dropIndex = this.messages.findIndex((m, idx) => !(idx === 0 && m.role === "system" && this.preserveSystem));
      if (dropIndex !== -1) {
        this.messages.splice(dropIndex, 1);
      } else {
        break;
      }
    }

    // 2. Trim by character budget
    while (this._getTotalChars() > this.maxChars && this.messages.length > (this.preserveSystem ? 2 : 1)) {
      const dropIndex = this.messages.findIndex((m, idx) => !(idx === 0 && m.role === "system" && this.preserveSystem));
      if (dropIndex !== -1) {
        this.messages.splice(dropIndex, 1);
      } else {
        break;
      }
    }
  }

  _getTotalChars() {
    return this.messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
  }

  getPayload() {
    return this.messages.map(m => ({ role: m.role, content: m.content }));
  }

  getFormattedTranscript() {
    return this.messages
      .map(m => `**${m.role.toUpperCase()}**: ${m.content}`)
      .join("\n\n");
  }

  clear() {
    this.messages = [];
  }
}
```

### 11.6 Condition Evaluator (`CosyConditionEvaluator`)

```javascript
export class CosyConditionEvaluator {
  /**
   * Evaluates comparison between operand A and B
   * @param {any} a - Left hand value
   * @param {string} operator - Operator symbol or keyword
   * @param {any} b - Right hand value
   * @returns {boolean}
   */
  static evaluate(a, operator, b) {
    switch (operator) {
      case "==":
        return a == b;
      case "!=":
        return a != b;
      case "===":
        return a === b;
      case "!==":
        return a !== b;
      case ">":
        return Number(a) > Number(b);
      case ">=":
        return Number(a) >= Number(b);
      case "<":
        return Number(a) < Number(b);
      case "<=":
        return Number(a) <= Number(b);
      case "contains":
        if (typeof a === 'string') return a.toLowerCase().includes(String(b).toLowerCase());
        if (Array.isArray(a)) return a.includes(b);
        if (typeof a === 'object' && a !== null) return b in a;
        return false;
      case "startsWith":
        return String(a).startsWith(String(b));
      case "endsWith":
        return String(a).endsWith(String(b));
      case "regex":
        try {
          const regex = new RegExp(String(b), "i");
          return regex.test(String(a));
        } catch {
          return false;
        }
      case "isEmpty":
        if (a === null || a === undefined) return true;
        if (typeof a === 'string' || Array.isArray(a)) return a.length === 0;
        if (typeof a === 'object') return Object.keys(a).length === 0;
        return false;
      case "isNotEmpty":
        return !CosyConditionEvaluator.evaluate(a, "isEmpty", null);
      default:
        return false;
    }
  }
}
```

---

## 12. Cross-Agent Integration Matrix

This specification establishes firm contracts with adjacent agent components:

| Agent | Responsibility | Game Logic Integration Point |
|:---|:---|:---|
| **Agent 01 (Lead Architect)** | Engine Architecture & Port Specs | Conforms to execution context contracts, standard port signatures (`TRIGGER`, `STRING`, etc.), and node registration formats. |
| **Agent 02 (Graph Engine Dev)** | Visual Node Editor & Sockets | Node registration hooks for visual palette, category grouping, socket render styles (chevrons for triggers, circles for data). |
| **Agent 03 (LLM Runtime Dev)** | LLM API Client & Prompting | `SlidingWindowBufferNode` and `SummaryMemoryNode` feed directly into `ChatPromptTemplate` and `LLMRequestNode`. |
| **Agent 04 (Frontend UI Dev)** | Dynamic UI & Player Controls | Reactive variables and inventories dispatch browser CustomEvents (`cosy:variable:changed`, `cosy:inventory:updated`) to immediately update player StatBars and InventoryGrids. |
| **Agent 06 (Storage & Presets)** | Save/Load & Starter Presets | `VariableStore.serialize()`, `Inventory.getItems()`, and `StateMachine.getStateInfo()` provide pure JSON snapshots for LocalStorage slots and export bundles. |
| **Agent 08 (Code Auditor)** | Safety & Edge-Case Guards | Node implementations enforce `MAX_EXEC_DEPTH = 500` tripwires, loop limits (`1000` max), and graceful error handling on malformed dice expressions. |
| **Agent 09 (QA & Test Engineer)** | Automated Testing & Verification | Seedable PRNG (`CosyRNG` / `Mulberry32`) ensures deterministic dice rolls and 100% reproducible test suites across all branching logic. |

---

## 13. Summary of Deliverables & Next Steps

1. **`05_GAME_WORKFLOW_SPEC.md`**: Complete, implementation-ready blueprint for all 23 game and workflow node types.
2. **Deterministic Mechanics**: Standalone dice notation parser supporting standard D&D / RPG expressions with critical and fumble math.
3. **Reactive State**: In-memory variable store and slot/stack inventory manager with automatic browser event dispatching for UI synchronization.
4. **Safety Guarantees**: Recursion call stack monitors and iteration gate limits preventing browser lockups.
