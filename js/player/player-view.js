/**
 * CosyUI - Dynamic Frontend Player UI Engine
 * Renders and updates custom player interfaces dynamically configured by UI Graph Nodes.
 */
import { globalEvents } from '../utils/event-bus.js';

export class PlayerView {
  constructor(mountContainer, model) {
    this.container = mountContainer;
    this.model = model;
    this.renderedWidgets = new Map(); // nodeId -> DOM element
    this.chatMessages = [];
    this.activeChoices = [];
    this.inventoryItems = [];

    this.initEvents();
  }

  initEvents() {
    globalEvents.on('graph:deserialized', () => this.rebuildPlayerUI());
    globalEvents.on('node:added', (node) => {
      if (node.type.startsWith('ui.')) this.rebuildPlayerUI();
    });
    globalEvents.on('node:removed', () => this.rebuildPlayerUI());
    globalEvents.on('node:property_changed', ({ nodeId }) => {
      const node = this.model.nodes.get(nodeId);
      if (node && node.type.startsWith('ui.')) {
        this.updateWidget(node);
      }
    });

    // Variable updates from game logic (e.g. hp, gold, inventory)
    globalEvents.on('variable:changed', ({ name, value }) => {
      this.handleVariableChange(name, value);
    });
  }

  /**
   * Rebuild the entire Player UI from graph UI nodes
   */
  rebuildPlayerUI() {
    this.container.innerHTML = '';
    this.renderedWidgets.clear();

    const uiNodes = [];
    for (const node of this.model.nodes.values()) {
      if (node.type.startsWith('ui.')) {
        uiNodes.push(node);
      }
    }

    if (uiNodes.length === 0) {
      this.container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--cosy-text-subtle);">
          <div style="font-size: 32px; margin-bottom: 12px;">🎨</div>
          <h4 style="color: var(--cosy-text-main); margin-bottom: 6px;">No UI Nodes in Graph</h4>
          <p style="font-size: 12px; line-height: 1.5;">
            Add UI nodes to the graph (such as <strong>UI Chatbox</strong>, <strong>UI Story Box</strong>, <strong>UI Stat Bar</strong>, or <strong>UI Choices</strong>) to customize your Frontend Player interface!
          </p>
        </div>
      `;
      return;
    }

    // Sort UI nodes by Y position on canvas to create a natural top-to-bottom layout
    uiNodes.sort((a, b) => a.y - b.y);

    for (const node of uiNodes) {
      const widget = this.createWidget(node);
      if (widget) {
        this.container.appendChild(widget);
        this.renderedWidgets.set(node.id, widget);
      }
    }
  }

  /**
   * Create specific DOM widget based on UI node type
   */
  createWidget(node) {
    switch (node.type) {
      case 'ui.story':
        return this.createStoryWidget(node);
      case 'ui.stat_bar':
        return this.createStatBarWidget(node);
      case 'ui.inventory':
        return this.createInventoryWidget(node);
      case 'ui.choice_buttons':
        return this.createChoiceButtonsWidget(node);
      case 'ui.chatbox':
        return this.createChatboxWidget(node);
      case 'ui.theme':
        this.applyTheme(node.properties.theme || 'default');
        return null;
      default:
        return null;
    }
  }

  // --- UI Story Widget ---
  createStoryWidget(node) {
    const card = document.createElement('div');
    card.className = 'ui-story-card';
    card.id = `widget_${node.id}`;

    const title = document.createElement('div');
    title.className = 'ui-story-title';
    title.textContent = node.properties.title || 'Adventure Log';

    const prose = document.createElement('div');
    prose.className = 'ui-story-prose';
    prose.textContent = node.properties.text || 'The journey begins...';

    card.appendChild(title);
    card.appendChild(prose);
    return card;
  }

  updateStoryWidget(nodeId, text, append = false) {
    const card = this.renderedWidgets.get(nodeId);
    if (!card) return;
    const prose = card.querySelector('.ui-story-prose');
    if (!prose) return;

    if (append) {
      prose.textContent += text;
    } else {
      prose.textContent = text;
    }
    // Auto scroll down
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // --- UI Stat Bar Widget ---
  createStatBarWidget(node) {
    const group = document.createElement('div');
    group.className = 'ui-stat-bar-group';
    group.id = `widget_${node.id}`;

    const labelText = node.properties.label || 'Health Points';
    const varName = node.properties.variableName || 'hp';
    const maxVal = Number(node.properties.max || 100);
    const currentVal = this.model.variables[varName] !== undefined ? Number(this.model.variables[varName]) : Number(node.properties.value || 100);
    const styleClass = node.properties.style || 'hp';

    const row = document.createElement('div');
    row.className = 'ui-stat-row';

    const header = document.createElement('div');
    header.className = 'ui-stat-header';
    header.innerHTML = `<span>${labelText}</span><span class="stat-value-text">${currentVal} / ${maxVal}</span>`;

    const track = document.createElement('div');
    track.className = 'ui-stat-track';

    const fill = document.createElement('div');
    fill.className = `ui-stat-fill ${styleClass}`;
    const pct = Math.max(0, Math.min(100, (currentVal / maxVal) * 100));
    fill.style.width = `${pct}%`;

    track.appendChild(fill);
    row.appendChild(header);
    row.appendChild(track);
    group.appendChild(row);

    return group;
  }

  updateStatBar(nodeId, currentVal, maxVal) {
    const group = this.renderedWidgets.get(nodeId);
    if (!group) return;

    const valText = group.querySelector('.stat-value-text');
    const fill = group.querySelector('.ui-stat-fill');
    if (valText) valText.textContent = `${currentVal} / ${maxVal}`;
    if (fill) {
      const pct = Math.max(0, Math.min(100, (currentVal / maxVal) * 100));
      fill.style.width = `${pct}%`;
    }
  }

  // --- UI Inventory Widget ---
  createInventoryWidget(node) {
    const panel = document.createElement('div');
    panel.className = 'ui-inventory-panel';
    panel.id = `widget_${node.id}`;

    const title = document.createElement('div');
    title.className = 'ui-inventory-title';
    title.innerHTML = `<span>🎒 ${node.properties.title || 'Inventory'}</span><span class="inventory-count"></span>`;

    const grid = document.createElement('div');
    grid.className = 'ui-inventory-grid';

    // Populate initial items from variable or property
    const varName = node.properties.variableName || 'inventory';
    const items = Array.isArray(this.model.variables[varName]) ? this.model.variables[varName] : (node.properties.items || ['Torch', 'Iron Sword', 'Health Potion']);
    this.renderInventorySlots(grid, items, node.id);

    panel.appendChild(title);
    panel.appendChild(grid);
    return panel;
  }

  renderInventorySlots(gridEl, items, nodeId) {
    gridEl.innerHTML = '';
    const icons = {
      sword: '⚔️', blade: '🗡️', potion: '🧪', torch: '🔥', shield: '🛡️',
      key: '🗝️', gold: '🪙', scroll: '📜', book: '📖', ring: '💍'
    };

    for (const item of items) {
      const itemName = typeof item === 'object' ? (item.name || 'Item') : String(item);
      const qty = typeof item === 'object' ? (item.qty || 1) : 1;

      const slot = document.createElement('div');
      slot.className = 'ui-inventory-slot';
      slot.title = `Click to use ${itemName}`;

      // Find matching emoji icon
      let icon = '📦';
      const lower = itemName.toLowerCase();
      for (const [key, em] of Object.entries(icons)) {
        if (lower.includes(key)) { icon = em; break; }
      }

      slot.innerHTML = `
        <span class="slot-item-icon">${icon}</span>
        <span class="slot-item-name">${itemName}</span>
        ${qty > 1 ? `<span class="slot-item-qty">x${qty}</span>` : ''}
      `;

      slot.addEventListener('click', () => {
        globalEvents.emit('player:item_clicked', { item: itemName, nodeId });
        globalEvents.emit('toast', { type: 'info', message: `Used: ${itemName}` });
      });

      gridEl.appendChild(slot);
    }
  }

  // --- UI Choice Buttons Widget ---
  createChoiceButtonsWidget(node) {
    const group = document.createElement('div');
    group.className = 'ui-choice-group';
    group.id = `widget_${node.id}`;

    const defaultChoices = node.properties.choices || [
      'Search the ancient altar',
      'Draw weapon and advance',
      'Cast protective ward'
    ];
    this.renderChoiceButtons(group, defaultChoices, node.id);

    return group;
  }

  renderChoiceButtons(groupEl, choices, nodeId) {
    groupEl.innerHTML = '';
    const list = Array.isArray(choices) ? choices : [];

    list.forEach((choiceText, index) => {
      const btn = document.createElement('button');
      btn.className = 'ui-choice-btn';
      btn.innerHTML = `
        <span class="choice-hotkey">${index + 1}</span>
        <span>${choiceText}</span>
      `;

      btn.addEventListener('click', () => {
        globalEvents.emit('player:choice_selected', { choice: choiceText, nodeId });
      });

      groupEl.appendChild(btn);
    });
  }

  // --- UI Chatbox Widget ---
  createChatboxWidget(node) {
    const box = document.createElement('div');
    box.className = 'ui-chatbox';
    box.id = `widget_${node.id}`;

    const header = document.createElement('div');
    header.className = 'chatbox-header';
    header.innerHTML = `<span>💬 ${node.properties.title || 'Companion Dialogue'}</span><span style="font-size: 11px; color: var(--cosy-text-muted);">Online</span>`;

    const messages = document.createElement('div');
    messages.className = 'chatbox-messages';

    // Welcome message
    const welcome = document.createElement('div');
    welcome.className = 'chat-bubble assistant';
    welcome.textContent = node.properties.welcomeMessage || 'Greetings! How may I assist you today?';
    messages.appendChild(welcome);

    const inputRow = document.createElement('div');
    inputRow.className = 'chatbox-input-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'chatbox-input';
    input.placeholder = node.properties.placeholder || 'Type your action or response...';

    const sendBtn = document.createElement('button');
    sendBtn.className = 'chatbox-send-btn';
    sendBtn.textContent = 'Send';

    const doSend = () => {
      const text = input.value.trim();
      if (!text) return;

      // Add user bubble
      this.appendChatMessage(messages, 'user', text);
      input.value = '';

      // Emit event to trigger graph runtime
      globalEvents.emit('player:chat_sent', { text, nodeId: node.id });
    };

    sendBtn.addEventListener('click', doSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSend();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);

    box.appendChild(header);
    box.appendChild(messages);
    box.appendChild(inputRow);

    return box;
  }

  appendChatMessage(messagesEl, role, content) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.textContent = content;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  addAssistantMessage(nodeId, text) {
    const box = this.renderedWidgets.get(nodeId);
    if (!box) return;
    const messagesEl = box.querySelector('.chatbox-messages');
    if (messagesEl) {
      this.appendChatMessage(messagesEl, 'assistant', text);
    }
  }

  // --- Dynamic Theme Switching ---
  applyTheme(themeName) {
    document.body.className = '';
    if (themeName && themeName !== 'default') {
      document.body.classList.add(`theme-${themeName}`);
    }
  }

  handleVariableChange(name, value) {
    // Find any stat bars or inventory widgets tied to this variable
    for (const [nodeId, widget] of this.renderedWidgets.entries()) {
      const node = this.model.nodes.get(nodeId);
      if (!node) continue;

      if (node.type === 'ui.stat_bar' && node.properties.variableName === name) {
        this.updateStatBar(nodeId, Number(value), Number(node.properties.max || 100));
      } else if (node.type === 'ui.inventory' && node.properties.variableName === name) {
        const grid = widget.querySelector('.ui-inventory-grid');
        if (grid && Array.isArray(value)) {
          this.renderInventorySlots(grid, value, nodeId);
        }
      }
    }
  }

  updateWidget(node) {
    // If widget properties change in the editor, refresh widget
    const existing = this.renderedWidgets.get(node.id);
    if (existing) {
      const newWidget = this.createWidget(node);
      if (newWidget) {
        existing.replaceWith(newWidget);
        this.renderedWidgets.set(node.id, newWidget);
      }
    }
  }
}
