# CosyUI Multi-Agent Collaboration Protocol & Architecture Overview

## 1. Operating Rules for All Agents
1. **Notes Folder (`Notes/`)**:
   - Write all architectural designs, specifications, code review feedback, and status reports here.
   - Read other agents' notes before beginning work to maintain architectural consistency.
2. **Progress Folder (`Progress/`)**:
   - ALWAYS create a lock file before editing or writing code files (e.g., `Progress/agent_0X_target.txt`).
   - Before writing, check `Progress/` to ensure no collisions on the same files.
   - ALWAYS remove your lock file from `Progress/` immediately upon finishing your batch of edits.
3. **Handoffs Folder (`Handoffs/`)**:
   - When completing milestones or your primary phase, write detailed handoff documentation in `Handoffs/`.
   - The final lead handoff summarizes the completed system, test results, and user usage guidelines.

---

## 2. Project Goal: CosyUI
CosyUI is a lightweight, zero-dependency HTML/CSS/JS web application for LLM interaction:
- **Backend / Logic**: Node-based UI where users control how user inputs and LLM outputs are processed.
- **Frontend / Player UI**: User can customize the UI itself with dedicated UI nodes (chatboxes, stat bars, inventory grids, choice buttons, themes, layout containers).
- **LLM APIs**: Universal LLM client (OpenAI, Anthropic, OpenRouter, Ollama, Custom API) + Built-in offline Mock LLM for instant play/testing.
- **Workflows & Games**: State machines, variables, dice rollers, inventory, turn tracking, conditional branches.
- **Persistence**: Project save/load (LocalStorage slots), JSON project export/import, standalone runnable HTML export, and starter game/workflow templates.
- **Performance & Aesthetics**: Zero JavaScript dependency bloat, no external CDN dependencies that could fail or lag, warm dark "Cosy" aesthetic, crisp 60fps graph canvas with bezier curves, minimap, zoom/pan.

---

## 3. The 10 Specialized Agents
1. **Agent 01 - Lead Architect**: System architecture, data schemas, port types, execution semantics.
2. **Agent 02 - Graph Engine Dev**: Canvas/SVG node editor, pan/zoom, bezier cables, drag/drop, socket snapping.
3. **Agent 03 - LLM Runtime Dev**: API integration (OpenAI, Anthropic, OpenRouter, Ollama, Mock), streaming, prompt templates.
4. **Agent 04 - Frontend Customizer Dev**: Dynamic UI nodes (Chat, Stat bar, Inventory, Buttons, Themes, Story box).
5. **Agent 05 - Game Logic Dev**: Game & workflow nodes (State machine, Variables, Dice, Conditionals, Memory).
6. **Agent 06 - Storage & Presets Dev**: LocalStorage save/load, JSON import/export, standalone bundle export, 4 starter templates.
7. **Agent 07 - UI/UX & CSS Designer**: Cosy design system, sleek theme, responsiveness, minimap, search palette, zero lag.
8. **Agent 08 - Code Auditor**: Error prevention, circular execution guards, null checks, edge cases, security.
9. **Agent 09 - QA & Test Engineer**: Automated test suite, runner, verification of all node types, save/load checks.
10. **Agent 10 - Documentation & Handoff Lead**: Complete documentation, user guide, node directory, final handoff package.
