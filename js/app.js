/**
 * CosyUI - Main Application Bootstrap
 * Orchestrates Model, Views, Runtimes, UI Customizer, Storage, and Interactions.
 */
import { GraphModel } from './engine/graph-model.js';
import { GraphView } from './engine/graph-view.js';
import { GraphRuntime } from './engine/runtime.js';
import { UniversalLLMClient } from './engine/llm-client.js';
import { PlayerView } from './player/player-view.js';
import { NodeRegistry } from './nodes/node-definitions.js';
import { ProjectStorage } from './storage/project-storage.js';
import { ProjectTemplates } from './storage/templates.js';
import { globalEvents } from './utils/event-bus.js';

class CosyApp {
  constructor() {
    this.model = new GraphModel();
    this.registry = new NodeRegistry();
    this.llmClient = new UniversalLLMClient();
    this.storage = new ProjectStorage(this.model, this.registry);
    
    this.initDOM();
    this.initViews();
    this.initUI();
    this.initPalette();
    this.initModals();
    this.initToasts();

    // Load initial starter template
    this.loadTemplate('template_rpg');
  }

  initDOM() {
    this.appEl = document.getElementById('app');
    this.canvasContainer = document.getElementById('canvasContainer');
    this.graphWorld = document.getElementById('graphWorld');
    this.svgLayer = document.getElementById('svgLayer');
    this.nodesLayer = document.getElementById('nodesLayer');
    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.minimapViewport = document.getElementById('minimapViewport');
    this.playerContent = document.getElementById('playerContent');
    this.paneResizer = document.getElementById('paneResizer');
    this.playerPane = document.getElementById('playerPane');
    this.projectTitle = document.getElementById('projectTitle');
  }

  initViews() {
    this.playerView = new PlayerView(this.playerContent, this.model);
    this.graphView = new GraphView(
      this.canvasContainer,
      this.graphWorld,
      this.svgLayer,
      this.nodesLayer,
      this.minimapCanvas,
      this.minimapViewport,
      this.model,
      this.registry
    );
    this.runtime = new GraphRuntime(this.model, this.registry, this.llmClient, this.playerView);
  }

  initUI() {
    // Project title change
    this.projectTitle.addEventListener('change', () => {
      this.model.metadata.title = this.projectTitle.value;
      this.model.pushHistorySnapshot();
    });

    // View Mode Switcher
    const setMode = (mode) => {
      this.appEl.className = `mode-${mode}`;
      document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
      if (mode === 'editor') document.getElementById('viewBtnEditor').classList.add('active');
      else if (mode === 'player') document.getElementById('viewBtnPlayer').classList.add('active');
      else document.getElementById('viewBtnSplit').classList.add('active');

      setTimeout(() => {
        this.graphView.updateTransform();
        this.graphView.updateMinimap();
      }, 50);
    };

    document.getElementById('viewBtnEditor').addEventListener('click', () => setMode('editor'));
    document.getElementById('viewBtnSplit').addEventListener('click', () => setMode('split'));
    document.getElementById('viewBtnPlayer').addEventListener('click', () => setMode('player'));

    // Keyboard view mode shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '1') { e.preventDefault(); setMode('editor'); }
        else if (e.key === '2') { e.preventDefault(); setMode('split'); }
        else if (e.key === '3') { e.preventDefault(); setMode('player'); }
        else if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) this.model.redo(this.registry);
          else this.model.undo(this.registry);
        } else if (e.key === 'y') {
          e.preventDefault();
          this.model.redo(this.registry);
        }
      }
    });

    // Resizable Split Pane Divider
    let isResizing = false;
    this.paneResizer.addEventListener('pointerdown', (e) => {
      isResizing = true;
      this.paneResizer.classList.add('dragging');
      this.paneResizer.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      const appRect = this.appEl.getBoundingClientRect();
      const newWidth = appRect.right - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        this.playerPane.style.width = `${newWidth}px`;
      }
    });

    window.addEventListener('pointerup', () => {
      if (isResizing) {
        isResizing = false;
        this.paneResizer.classList.remove('dragging');
      }
    });

    // Run Graph Button
    document.getElementById('btnRunTrigger').addEventListener('click', () => {
      this.runtime.runGraph();
    });

    // Restart Player
    document.getElementById('btnRestartPlayer').addEventListener('click', () => {
      this.playerView.rebuildPlayerUI();
      globalEvents.emit('toast', { type: 'info', message: 'Player state reloaded.' });
    });

    // Canvas Toolbar
    document.getElementById('toolBtnZoomIn').addEventListener('click', () => {
      this.graphView.zoom = Math.min(2.5, this.graphView.zoom * 1.2);
      this.graphView.updateTransform();
      this.graphView.updateMinimap();
    });
    document.getElementById('toolBtnZoomOut').addEventListener('click', () => {
      this.graphView.zoom = Math.max(0.2, this.graphView.zoom * 0.8);
      this.graphView.updateTransform();
      this.graphView.updateMinimap();
    });
    document.getElementById('toolBtnFit').addEventListener('click', () => {
      this.graphView.fitToView();
    });
    document.getElementById('toolBtnCenter').addEventListener('click', () => {
      this.graphView.resetView();
    });
    document.getElementById('toolBtnClear').addEventListener('click', () => {
      if (confirm('Clear all nodes and connections from canvas?')) {
        this.model.clear();
      }
    });

    // Template Selector
    const templateSelector = document.getElementById('templateSelector');
    templateSelector.addEventListener('change', () => {
      const templateKey = templateSelector.value;
      if (templateKey) {
        this.loadTemplate(templateKey);
        templateSelector.value = '';
      }
    });
  }

  loadTemplate(templateKey) {
    const template = ProjectTemplates[templateKey];
    if (template) {
      this.model.deserialize(template, this.registry);
      this.projectTitle.value = template.metadata.title;
      this.graphView.fitToView();
      globalEvents.emit('toast', { type: 'success', message: `Loaded "${template.metadata.title}"` });
    }
  }

  // --- Node Quick-Add Search Palette ---
  initPalette() {
    const palette = document.getElementById('nodeSearchPalette');
    const searchInput = document.getElementById('paletteSearchInput');
    const resultsList = document.getElementById('paletteResultsList');
    const categoryTabs = document.getElementById('paletteCategoryTabs');
    const openBtn = document.getElementById('btnOpenAddPalette');

    let currentCategory = 'all';
    let spawnPosition = { x: 300, y: 200 };

    const showPalette = (clientX, clientY) => {
      if (clientX !== undefined && clientY !== undefined) {
        const rect = this.canvasContainer.getBoundingClientRect();
        const px = Math.min(clientX - rect.left, rect.width - 340);
        const py = Math.min(clientY - rect.top, rect.height - 420);
        palette.style.left = `${Math.max(20, px)}px`;
        palette.style.top = `${Math.max(20, py)}px`;
        const worldPos = this.graphView ? {
          x: (clientX - this.graphView.panX) / this.graphView.zoom,
          y: (clientY - this.graphView.panY) / this.graphView.zoom
        } : { x: 300, y: 200 };
        spawnPosition = worldPos;
      } else {
        palette.style.left = '40px';
        palette.style.top = '70px';
        spawnPosition = { x: 200, y: 150 };
      }

      palette.style.display = 'flex';
      searchInput.value = '';
      searchInput.focus();
      renderResults();
    };

    const hidePalette = () => {
      palette.style.display = 'none';
    };

    openBtn.addEventListener('click', () => showPalette());

    // Space on canvas or double-click to open palette
    this.canvasContainer.addEventListener('dblclick', (e) => {
      if (e.target === this.canvasContainer || e.target === this.graphWorld || e.target.tagName === 'svg') {
        showPalette(e.clientX, e.clientY);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        showPalette();
      } else if (e.key === 'Escape') {
        hidePalette();
        this.closeAllModals();
      }
    });

    // Close palette when clicking outside
    document.addEventListener('pointerdown', (e) => {
      if (!palette.contains(e.target) && e.target !== openBtn) {
        hidePalette();
      }
    });

    // Category Tabs
    categoryTabs.addEventListener('click', (e) => {
      if (e.target.classList.contains('palette-tab')) {
        categoryTabs.querySelectorAll('.palette-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentCategory = e.target.dataset.category;
        renderResults();
      }
    });

    // Search Filtering
    searchInput.addEventListener('input', () => renderResults());

    const renderResults = () => {
      resultsList.innerHTML = '';
      const query = searchInput.value.toLowerCase().trim();
      let nodes = this.registry.getByCategory(currentCategory);

      if (query) {
        nodes = nodes.filter(n => 
          n.title.toLowerCase().includes(query) ||
          n.type.toLowerCase().includes(query) ||
          (n.category && n.category.toLowerCase().includes(query))
        );
      }

      if (nodes.length === 0) {
        resultsList.innerHTML = '<div style="padding: 12px; font-size: 11px; color: var(--cosy-text-subtle); text-align: center;">No matching nodes found</div>';
        return;
      }

      for (const nodeDef of nodes) {
        const item = document.createElement('div');
        item.className = 'palette-item';
        item.innerHTML = `
          <div class="palette-item-left">
            <span style="font-size: 16px;">${nodeDef.icon || '📦'}</span>
            <div>
              <div class="palette-item-title">${nodeDef.title}</div>
              <div class="palette-item-desc">${nodeDef.type}</div>
            </div>
          </div>
          <span class="palette-item-category">${nodeDef.category}</span>
        `;

        item.addEventListener('click', () => {
          this.model.addNode(
            nodeDef.type,
            nodeDef,
            Math.round(spawnPosition.x),
            Math.round(spawnPosition.y)
          );
          hidePalette();
        });

        resultsList.appendChild(item);
      }
    };
  }

  // --- Modals Management ---
  initModals() {
    // Open Settings Modal
    document.getElementById('btnSettingsModal').addEventListener('click', () => {
      this.populateSettingsForm();
      this.openModal('modalSettings');
    });

    // Open Storage Modal
    document.getElementById('btnStorageModal').addEventListener('click', () => {
      this.openModal('modalStorage');
    });

    // Open Help Modal
    document.getElementById('btnHelpModal').addEventListener('click', () => {
      this.openModal('modalHelp');
    });

    // Close buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        if (modalId) this.closeModal(modalId);
      });
    });

    // Click backdrop to close
    document.querySelectorAll('.cosy-modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.closeModal(backdrop.id);
      });
    });

    // Save Settings
    document.getElementById('btnSaveSettings').addEventListener('click', () => {
      this.llmClient.settings.defaultProvider = document.getElementById('settingDefaultProvider').value;
      this.llmClient.settings.openAiKey = document.getElementById('settingOpenAiKey').value;
      this.llmClient.settings.anthropicKey = document.getElementById('settingAnthropicKey').value;
      this.llmClient.settings.openRouterKey = document.getElementById('settingOpenRouterKey').value;
      this.llmClient.settings.ollamaUrl = document.getElementById('settingOllamaUrl').value;
      this.llmClient.settings.mockFallback = document.getElementById('settingMockFallback').checked;
      this.llmClient.saveSettings();
      this.closeModal('modalSettings');
    });

    // Storage Actions
    document.getElementById('btnSaveSlot').addEventListener('click', () => {
      const slot = document.getElementById('storageSlotSelect').value;
      this.storage.saveToSlot(slot);
    });

    document.getElementById('btnLoadSlot').addEventListener('click', () => {
      const slot = document.getElementById('storageSlotSelect').value;
      if (this.storage.loadFromSlot(slot)) {
        this.closeModal('modalStorage');
      }
    });

    document.getElementById('btnExportJson').addEventListener('click', () => {
      this.storage.exportJSON();
    });

    document.getElementById('importJsonFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.storage.importJSON(file);
        this.closeModal('modalStorage');
      }
    });

    document.getElementById('btnExportBundle').addEventListener('click', () => {
      this.storage.exportStandaloneHTML();
    });
  }

  populateSettingsForm() {
    const s = this.llmClient.settings;
    document.getElementById('settingDefaultProvider').value = s.defaultProvider || 'mock';
    document.getElementById('settingOpenAiKey').value = s.openAiKey || '';
    document.getElementById('settingAnthropicKey').value = s.anthropicKey || '';
    document.getElementById('settingOpenRouterKey').value = s.openRouterKey || '';
    document.getElementById('settingOllamaUrl').value = s.ollamaUrl || 'http://localhost:11434';
    document.getElementById('settingMockFallback').checked = s.mockFallback !== false;
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('open');
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('open');
  }

  closeAllModals() {
    document.querySelectorAll('.cosy-modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  // --- Toasts ---
  initToasts() {
    const container = document.getElementById('toastContainer');
    globalEvents.on('toast', ({ type = 'info', message = '' }) => {
      const toast = document.createElement('div');
      toast.className = `cosy-toast toast-${type}`;
      
      const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
      toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 250);
      }, 3500);
    });
  }
}

// Bootstrap on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.cosyApp = new CosyApp();
});
