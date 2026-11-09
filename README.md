![](https://img.shields.io/badge/AI-EXECUTE-grey?style=flat&logoSize=auto&labelColor=13171f)
<picture>
<source srcset="https://github.com/NamtaoProductions/0rwx.com/blob/main/static/AI-X-dark.svg" media="(prefers-color-scheme: dark)">
<img src="https://github.com/NamtaoProductions/0rwx.com/blob/main/static/AI-X-light.svg" alt="AI:X" width="auto" height="32">
</picture>
# CosyUI ⚡

> **A lightweight, zero-dependency, web-native visual programming workspace for creating, testing, and playing LLM-powered games, workflows, and custom user interfaces.**

---

## 🌟 Highlights & Philosophy

- **Zero-Dependency Philosophy**: 100% vanilla HTML5, modern ES6+ modules, and pure CSS. No Node.js build tools, no Webpack/Vite bundlers, no NPM dependency bloat, and zero external CDN latency vulnerabilities.
- **Node-Based Backend Logic**: Full control over how user inputs and LLM outputs are processed with visual nodes, trigger flows, and data streams.
- **Customizable Frontend Player UI**: Users can design and customize the player interface itself using dedicated UI nodes (Chatboxes, Stat Gauges, Inventory Grids, Branching Choice Buttons, Story Readers, and Theme Switchers).
- **Universal LLM Client + Offline Mock Simulator**: Connects directly to **OpenAI**, **Anthropic**, **OpenRouter**, **Ollama (local)**, or the built-in **Offline Mock LLM Simulator** (which requires zero API keys and generates rich tabletop RPG and game responses with streaming jitter).
- **Tabletop Game Mechanics**: Built-in RPG polyhedral dice roller (`1d20+5`, `3d6`, `2d20kh1` advantage, `2d20kl1` disadvantage), reactive variable store, stackable inventory manager, and finite state machines.
- **Full Project Persistence**: LocalStorage multi-slot autosave, clean JSON project export/import (with automatic API key scrubbing), and a **Single-File Standalone HTML Game Exporter** that bundles games into a self-contained `.html` file that runs anywhere offline.
- **Buttery 60 FPS Performance**: GPU-accelerated canvas pan & zoom with momentum, smooth cubic Bézier cables, magnetic socket snapping, and minimap radar navigation.

---

## 🌐 Live GitHub Pages & Branch Sub-Pages

CosyUI is automatically deployed to **GitHub Pages** using GitHub Actions:

- **🏠 Main Index (Default)**: [https://someonenameguy.github.io/CosyUI/](https://someonenameguy.github.io/CosyUI/)
- **🌿 Branch Sub-Pages**: Every branch is deployed to its own isolated subpage, for example:
  - **`Enhancement`**: [https://someonenameguy.github.io/CosyUI/Enhancement/](https://someonenameguy.github.io/CosyUI/Enhancement/)
- **📂 Branch Directory & Deployment Hub**: [https://someonenameguy.github.io/CosyUI/branches.html](https://someonenameguy.github.io/CosyUI/branches.html)

Pushing changes to `main` updates the root index, while pushing to any other branch automatically builds and provisions its own sub-page with an integrated branch switcher widget.

---

## 🚀 Quick Start (60 Seconds)

1. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).
2. The default **"Fantasy RPG with Dice & Inventory"** template loads immediately.
3. Click **"▶ Run Graph"** (or press `Space`) to execute the attack roll, roll the D20 dice, evaluate success, and trigger the Dungeon Master narration.
4. Interact with the **Player View** on the right: click choices, type in the companion chatbox, or click inventory items.
5. Switch between **Editor View** (`Ctrl+1`), **Split View** (`Ctrl+2`), and **Player View** (`Ctrl+3`).

---

## 🎮 Built-in Starter Templates

CosyUI includes 4 complete pre-configured starter templates ready to play from the top header:

1. **🎲 Fantasy RPG with Dice & Inventory**:
   - Player explores a dungeon tomb; D20 dice rolls determine combat success vs DC 14.
   - Victory/defeat narratives generated dynamically by LLM.
   - Dynamic health bar, backpack inventory slots, and action buttons.
2. **🗣️ Multi-Agent AI Debate**:
   - Accelerationist AI vs Humanist AI debating AI consciousness, moderated and synthesized by an AI Moderator.
3. **🛡️ Customer Support with Guardrails**:
   - Sentiment and security keyword detection, polite knowledge-based answers, and customer satisfaction metrics.
4. **📖 Sci-Fi Interactive Story ("The Derelict Signal")**:
   - Atmospheric cyber-themed interactive mystery with health, oxygen gauges, and branching choices.

---

## 🧩 Node Reference Directory (24 Nodes)

### 1. Flow & Execution
| Node Type | Icon | Description |
| :--- | :---: | :--- |
| `core.start` | 🚩 | Graph entry point; triggers execution on Run. |
| `core.trigger` | ⚡ | Manual execution trigger button. |
| `core.branch` | 🔀 | Conditional branch (`==`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `regex`). |
| `core.delay` | ⏳ | Non-blocking timer delay (ms). |
| `core.switch` | 🚦 | Multi-way string pattern router. |

### 2. LLM Runtime
| Node Type | Icon | Description |
| :--- | :---: | :--- |
| `llm.universal` | 🧠 | Universal API client for OpenAI, Anthropic, OpenRouter, and Ollama. |
| `llm.mock` | 🎲 | Built-in offline simulator with RPG DM, Debate, and Support personas. |
| `llm.template` | 📝 | Mustache template interpolator `{{variable}}` with dot notation. |
| `llm.memory` | 📚 | Sliding window conversation history buffer. |
| `llm.json_extractor` | 🔍 | Extracts clean JSON objects/arrays from LLM markdown fences. |

### 3. UI Frontend Widgets (Player UI Customization)
| Node Type | Icon | Description |
| :--- | :---: | :--- |
| `ui.story` | 📖 | Formatted narrative reader with typewriter animation. |
| `ui.chatbox` | 💬 | Interactive chat log with message bubbles and user send triggers. |
| `ui.stat_bar` | ❤️ | Dynamic RPG gauge bar (Health, Mana, Energy, Sanity). |
| `ui.inventory` | 🎒 | Item slot matrix with quantity badges and click-to-use triggers. |
| `ui.choice_buttons`| 🔘 | Dynamic dialogue choice buttons with number hotkeys (1-9). |
| `ui.theme` | 🎨 | Runtime CSS color theme switcher (Cosy, Cyberpunk, Parchment, Minimal). |

### 4. Game Logic & State
| Node Type | Icon | Description |
| :--- | :---: | :--- |
| `game.dice` | 🎲 | Polyhedral dice roller (`1d20+3`, `3d6`, `2d20kh1` advantage, `2d20kl1` disadvantage). |
| `game.variables` | 💾 | Central variable store (Get, Set, Add, Subtract). |
| `game.inventory_action`| 🗡️ | Add, remove, or verify items in player inventory. |
| `game.turn_counter`| 🔄 | Step and turn tracker for game loops. |

### 5. Utilities
| Node Type | Icon | Description |
| :--- | :---: | :--- |
| `utils.math` | ➕ | Math operations (`+`, `-`, `*`, `/`, `max`, `min`). |
| `utils.string` | 🔗 | String concatenator and formatter. |
| `utils.debug` | 🐞 | Visual inspector logger. |

---

## ⌨️ Keyboard & Mouse Controls

| Action | Shortcut / Gesture |
| :--- | :--- |
| **Open Node Palette** | `Space` or Double-click on canvas |
| **Pan Canvas** | Left drag on canvas background |
| **Zoom In / Out** | Scroll wheel (zooms toward mouse cursor) |
| **Fit View** | `F` |
| **Reset View** | `0` |
| **Delete Selected** | `Delete` or `Backspace` |
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`) |
| **View Modes** | `Ctrl+1` (Editor), `Ctrl+2` (Split), `Ctrl+3` (Player) |
| **Connect Ports** | Drag from any socket handle to a compatible target handle |

---

## 🧪 Automated Testing

CosyUI includes a complete automated test suite verifying math, sanitization, cycle detection, graph persistence, dice rolling, LLM templating, and template integrity:

```bash
# Run headless test suite in terminal:
node tests/run-tests.js
```

Or open `tests/test-runner.html` directly in your browser.

---

## 🔒 Security & Privacy

- All API keys are preserved in your browser's private `localStorage` (`cosyui_settings`) and are **never** exported into project JSON files or standalone bundles.
- 100% client-side execution — your prompts go directly from your browser to your chosen LLM endpoint.
