/**
 * CosyUI - Storage Manager & Standalone HTML Bundler
 * LocalStorage slots, debounced autosave, JSON export/import, and single-file HTML game bundler.
 */
import { Sanitizer } from '../utils/sanitizer.js';
import { globalEvents } from '../utils/event-bus.js';

export class ProjectStorage {
  constructor(model, registry) {
    this.model = model;
    this.registry = registry;
    this.currentSlot = 'slot_1';
    this.autosaveTimer = null;
    this.autosaveDelay = 1200; // ms

    this.initAutosave();
  }

  initAutosave() {
    globalEvents.on('graph:changed', () => {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => {
        this.saveToSlot(this.currentSlot, false);
      }, this.autosaveDelay);
    });
  }

  /**
   * Save graph to specific LocalStorage slot
   */
  saveToSlot(slotId = 'slot_1', showToast = true) {
    this.currentSlot = slotId;
    try {
      const data = this.model.serialize();
      localStorage.setItem(`cosyui_project_${slotId}`, JSON.stringify(data));
      if (showToast) {
        globalEvents.emit('toast', { type: 'success', message: `Saved project to ${slotId.toUpperCase()}` });
      }
    } catch (err) {
      console.error('Failed to save to localStorage:', err);
      globalEvents.emit('toast', { type: 'error', message: 'Failed to save project: storage quota exceeded.' });
    }
  }

  /**
   * Load graph from LocalStorage slot
   */
  loadFromSlot(slotId = 'slot_1') {
    this.currentSlot = slotId;
    try {
      const raw = localStorage.getItem(`cosyui_project_${slotId}`);
      if (!raw) {
        globalEvents.emit('toast', { type: 'warning', message: `Slot ${slotId} is empty.` });
        return false;
      }
      const data = JSON.parse(raw);
      this.model.deserialize(data, this.registry);
      globalEvents.emit('toast', { type: 'success', message: `Loaded project from ${slotId.toUpperCase()}` });
      return true;
    } catch (err) {
      console.error('Failed to load from slot:', err);
      globalEvents.emit('toast', { type: 'error', message: `Failed to load: ${err.message}` });
      return false;
    }
  }

  /**
   * Export project as JSON file download with sensitive API keys scrubbed
   */
  exportJSON() {
    const data = this.model.serialize();
    const cleanData = Sanitizer.scrubSensitiveKeys(data);
    const jsonStr = JSON.stringify(cleanData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (this.model.metadata.title || 'cosyui-project').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    a.download = `${safeTitle}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    globalEvents.emit('toast', { type: 'success', message: 'Project JSON exported successfully.' });
  }

  /**
   * Import project from JSON file
   */
  async importJSON(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      this.model.deserialize(parsed, this.registry);
      globalEvents.emit('toast', { type: 'success', message: `Successfully imported "${parsed.metadata?.title || file.name}"` });
      return true;
    } catch (err) {
      console.error('Failed to import JSON file:', err);
      globalEvents.emit('toast', { type: 'error', message: `Import error: ${err.message}` });
      return false;
    }
  }

  /**
   * Export Single-File Standalone Runnable HTML Bundle ("Cosy Bundle")
   * Embeds project JSON, styles, and micro-runtime so anyone can run the game/app offline!
   */
  exportStandaloneHTML() {
    const data = Sanitizer.scrubSensitiveKeys(this.model.serialize());
    const projectJSON = JSON.stringify(data).replace(/<\/script>/g, '<\\/script>');
    const projectTitle = this.model.metadata.title || 'CosyUI Game';

    const standaloneHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectTitle}</title>
  <style>
    :root {
      --cosy-bg-base: #121215;
      --cosy-bg-surface: #18191f;
      --cosy-bg-surface-elevated: #21232d;
      --cosy-bg-card: #282a36;
      --cosy-bg-card-hover: #333647;
      --cosy-border: #353849;
      --cosy-text-main: #f4f5f9;
      --cosy-text-muted: #a3a7be;
      --cosy-accent: #f59e0b;
      --cosy-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--cosy-bg-base);
      color: var(--cosy-text-main);
      font-family: var(--cosy-font-sans);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    .player-window {
      width: 100%;
      max-width: 640px;
      min-height: 580px;
      background: var(--cosy-bg-surface);
      border: 1px solid var(--cosy-border);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(0,0,0,0.5);
    }
    .topbar {
      padding: 12px 16px;
      background: var(--cosy-bg-surface-elevated);
      border-bottom: 1px solid var(--cosy-border);
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      font-size: 14px;
    }
    .content {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      overflow-y: auto;
    }
    .ui-story-card {
      background: var(--cosy-bg-card);
      border: 1px solid var(--cosy-border);
      border-radius: 8px;
      padding: 14px;
      line-height: 1.6;
    }
    .ui-story-title { font-size: 15px; font-weight: 700; color: var(--cosy-accent); margin-bottom: 6px; }
    .ui-stat-bar-group { background: var(--cosy-bg-card); border: 1px solid var(--cosy-border); border-radius: 8px; padding: 10px; }
    .ui-stat-track { height: 10px; background: #000; border-radius: 9999px; overflow: hidden; margin-top: 4px; }
    .ui-stat-fill { height: 100%; background: linear-gradient(90deg, #ef4444, #f43f5e); transition: width 0.3s; }
    .ui-choice-group { display: flex; flex-direction: column; gap: 8px; }
    .ui-choice-btn {
      background: var(--cosy-bg-card);
      border: 1px solid var(--cosy-border);
      color: #fff;
      padding: 10px 14px;
      border-radius: 6px;
      cursor: pointer;
      text-align: left;
      font-size: 13px;
    }
    .ui-choice-btn:hover { background: var(--cosy-bg-card-hover); border-color: var(--cosy-accent); }
    .ui-inventory-panel { background: var(--cosy-bg-card); border: 1px solid var(--cosy-border); border-radius: 8px; padding: 10px; }
    .ui-inventory-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .ui-inventory-slot { padding: 6px 10px; background: var(--cosy-bg-surface-elevated); border: 1px solid var(--cosy-border); border-radius: 4px; font-size: 11px; }
    .chatbox { background: var(--cosy-bg-card); border: 1px solid var(--cosy-border); border-radius: 8px; display: flex; flex-direction: column; min-height: 200px; }
    .chatbox-messages { flex: 1; padding: 10px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
    .bubble { padding: 8px 12px; border-radius: 8px; font-size: 13px; max-width: 80%; }
    .bubble.user { align-self: flex-end; background: var(--cosy-accent); color: #000; font-weight: 500; }
    .bubble.assistant { align-self: flex-start; background: var(--cosy-bg-surface-elevated); }
    .chatbox-input-row { display: flex; padding: 8px; border-top: 1px solid var(--cosy-border); gap: 6px; }
    .chatbox-input { flex: 1; background: var(--cosy-bg-base); border: 1px solid var(--cosy-border); border-radius: 4px; color: #fff; padding: 6px 10px; outline: none; }
    .chatbox-send-btn { background: var(--cosy-accent); color: #000; border: none; border-radius: 4px; padding: 0 12px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="player-window">
    <div class="topbar">
      <span>⚡ ${projectTitle}</span>
      <span style="font-size: 11px; color: var(--cosy-accent);">Powered by CosyUI</span>
    </div>
    <div id="content" class="content"></div>
  </div>

  <script>
    const project = ${projectJSON};
    const contentEl = document.getElementById('content');

    // Mount UI widgets from project
    const uiNodes = (project.nodes || []).filter(n => n.type.startsWith('ui.')).sort((a,b) => a.y - b.y);
    for (const node of uiNodes) {
      if (node.type === 'ui.story') {
        const card = document.createElement('div');
        card.className = 'ui-story-card';
        card.innerHTML = '<div class="ui-story-title">' + (node.properties?.title || 'Story') + '</div><div>' + (node.properties?.text || '') + '</div>';
        contentEl.appendChild(card);
      } else if (node.type === 'ui.stat_bar') {
        const group = document.createElement('div');
        group.className = 'ui-stat-bar-group';
        const val = node.properties?.value || 100;
        const max = node.properties?.max || 100;
        group.innerHTML = '<div>' + (node.properties?.label || 'Health') + ': ' + val + ' / ' + max + '</div><div class="ui-stat-track"><div class="ui-stat-fill" style="width: ' + ((val/max)*100) + '%;"></div></div>';
        contentEl.appendChild(group);
      } else if (node.type === 'ui.choice_buttons') {
        const group = document.createElement('div');
        group.className = 'ui-choice-group';
        const choices = [node.properties?.choice1, node.properties?.choice2, node.properties?.choice3].filter(Boolean);
        choices.forEach((c, i) => {
          const btn = document.createElement('button');
          btn.className = 'ui-choice-btn';
          btn.textContent = (i + 1) + '. ' + c;
          btn.onclick = () => alert('Selected choice: ' + c);
          group.appendChild(btn);
        });
        contentEl.appendChild(group);
      } else if (node.type === 'ui.inventory') {
        const panel = document.createElement('div');
        panel.className = 'ui-inventory-panel';
        panel.innerHTML = '<strong>' + (node.properties?.title || 'Inventory') + '</strong>';
        const grid = document.createElement('div');
        grid.className = 'ui-inventory-grid';
        const items = project.variables?.inventory || ['Torch', 'Iron Sword', 'Health Potion'];
        items.forEach(it => {
          const slot = document.createElement('div');
          slot.className = 'ui-inventory-slot';
          slot.textContent = it;
          grid.appendChild(slot);
        });
        panel.appendChild(grid);
        contentEl.appendChild(panel);
      } else if (node.type === 'ui.chatbox') {
        const box = document.createElement('div');
        box.className = 'chatbox';
        box.innerHTML = '<div class="chatbox-messages"><div class="bubble assistant">' + (node.properties?.welcomeMessage || 'Greetings!') + '</div></div><div class="chatbox-input-row"><input class="chatbox-input" placeholder="Type here..."><button class="chatbox-send-btn">Send</button></div>';
        const input = box.querySelector('.chatbox-input');
        const send = box.querySelector('.chatbox-send-btn');
        const msgs = box.querySelector('.chatbox-messages');
        const sendMsg = () => {
          if (!input.value.trim()) return;
          const u = document.createElement('div');
          u.className = 'bubble user';
          u.textContent = input.value;
          msgs.appendChild(u);
          input.value = '';
          setTimeout(() => {
            const a = document.createElement('div');
            a.className = 'bubble assistant';
            a.textContent = 'Received your command. Exploring the dungeon ahead...';
            msgs.appendChild(a);
            msgs.scrollTop = msgs.scrollHeight;
          }, 400);
        };
        send.onclick = sendMsg;
        input.onkeydown = (e) => { if (e.key === 'Enter') sendMsg(); };
        contentEl.appendChild(box);
      }
    }
  <\/script>
</body>
</html>`;

    const blob = new Blob([standaloneHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (projectTitle || 'cosy_bundle').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    a.download = `${safeTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    globalEvents.emit('toast', { type: 'success', message: 'Standalone playable HTML bundle exported!' });
  }
}
