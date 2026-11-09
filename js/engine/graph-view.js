/**
 * CosyUI - Graph View Canvas Engine
 * High-performance 60fps pan/zoom, SVG Bézier cables, magnetic snapping, and DOM node management.
 */
import { MathUtils } from '../utils/math.js';
import { globalEvents } from '../utils/event-bus.js';

export class GraphView {
  constructor(container, world, svgLayer, nodesLayer, minimapCanvas, minimapViewport, model, registry) {
    this.container = container;
    this.world = world;
    this.svgLayer = svgLayer;
    this.connectionsGroup = svgLayer.querySelector('#svgConnectionsGroup');
    this.draftCable = svgLayer.querySelector('#svgDraftCable');
    this.nodesLayer = nodesLayer;
    this.minimapCanvas = minimapCanvas;
    this.minimapViewport = minimapViewport;
    this.minimapCtx = minimapCanvas.getContext('2d');
    this.model = model;
    this.registry = registry;

    // Viewport transform state
    this.panX = 80;
    this.panY = 80;
    this.zoom = 1.0;
    this.minZoom = 0.2;
    this.maxZoom = 2.5;

    // Selection & interaction state
    this.selectedNodeIds = new Set();
    this.selectedConnectionId = null;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Wire dragging state
    this.isDraggingWire = false;
    this.wireSourcePort = null;
    this.wireSourceNode = null;
    this.wireSourcePos = { x: 0, y: 0 };
    this.snappedTargetPort = null;

    // Node dragging state
    this.isDraggingNodes = false;
    this.dragStartMouse = { x: 0, y: 0 };
    this.nodeInitialPositions = new Map();

    // Map DOM elements
    this.nodeElements = new Map();
    this.connectionPaths = new Map();

    // Setup event listeners
    this.initEvents();
    this.initModelListeners();

    // Initial render
    this.updateTransform();
    this.render();
  }

  initModelListeners() {
    globalEvents.on('node:added', (node) => this.createNodeElement(node));
    globalEvents.on('node:removed', (nodeId) => this.removeNodeElement(nodeId));
    globalEvents.on('connection:added', () => this.renderConnections());
    globalEvents.on('connection:removed', () => this.renderConnections());
    globalEvents.on('graph:cleared', () => this.render());
    globalEvents.on('graph:deserialized', () => this.render());
    globalEvents.on('runtime:node_pulse', ({ nodeId }) => this.pulseNode(nodeId));
    globalEvents.on('runtime:cable_pulse', ({ connId }) => this.pulseCable(connId));
  }

  initEvents() {
    // Canvas Pan via Drag
    this.container.addEventListener('pointerdown', (e) => {
      // If clicking directly on container or world (not on a node or control)
      if (e.target === this.container || e.target === this.world || e.target.tagName === 'svg') {
        if (e.button === 0 || e.button === 1) { // Left or middle click
          this.isPanning = true;
          this.panStartX = e.clientX - this.panX;
          this.panStartY = e.clientY - this.panY;
          this.container.setPointerCapture(e.pointerId);
          this.clearSelection();
        }
      }
    });

    this.container.addEventListener('pointermove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        this.updateTransform();
        this.updateMinimap();
        return;
      }

      if (this.isDraggingNodes) {
        const dx = (e.clientX - this.dragStartMouse.x) / this.zoom;
        const dy = (e.clientY - this.dragStartMouse.y) / this.zoom;
        for (const [nodeId, initialPos] of this.nodeInitialPositions.entries()) {
          const node = this.model.nodes.get(nodeId);
          if (node) {
            node.x = MathUtils.snapToGrid(initialPos.x + dx);
            node.y = MathUtils.snapToGrid(initialPos.y + dy);
            this.updateNodePosition(node);
          }
        }
        this.renderConnections();
        this.updateMinimap();
        return;
      }

      if (this.isDraggingWire) {
        const worldPos = MathUtils.screenToWorld(e.clientX, e.clientY, this.panX, this.panY, this.zoom);
        this.updateDraftWire(worldPos.x, worldPos.y);
        this.checkMagneticPortSnap(e.clientX, e.clientY);
        return;
      }
    });

    this.container.addEventListener('pointerup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        try { this.container.releasePointerCapture(e.pointerId); } catch {}
      }

      if (this.isDraggingNodes) {
        this.isDraggingNodes = false;
        this.model.pushHistorySnapshot();
      }

      if (this.isDraggingWire) {
        this.endWireDrag();
      }
    });

    // Zoom at Cursor via Wheel
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = MathUtils.clamp(this.zoom * zoomFactor, this.minZoom, this.maxZoom);

      // Preserve world point under mouse cursor
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.updateTransform();
      this.updateMinimap();
    }, { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedNodeIds.size > 0) {
          for (const id of Array.from(this.selectedNodeIds)) {
            this.model.removeNode(id);
          }
          this.selectedNodeIds.clear();
        } else if (this.selectedConnectionId) {
          this.model.disconnect(this.selectedConnectionId);
          this.selectedConnectionId = null;
        }
      } else if (e.key === 'f' || e.key === 'F') {
        this.fitToView();
      } else if (e.key === '0') {
        this.resetView();
      }
    });

    // Minimap Click / Drag to Pan
    this.minimapCanvas.addEventListener('pointerdown', (e) => {
      this.panToMinimapCoord(e);
      const onMove = (ev) => this.panToMinimapCoord(ev);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  panToMinimapCoord(e) {
    const rect = this.minimapCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const aabb = MathUtils.calculateAABB(Array.from(this.model.nodes.values()), 300);

    const worldTargetX = aabb.minX + mx * aabb.width;
    const worldTargetY = aabb.minY + my * aabb.height;

    const viewportW = this.container.clientWidth;
    const viewportH = this.container.clientHeight;

    this.panX = viewportW / 2 - worldTargetX * this.zoom;
    this.panY = viewportH / 2 - worldTargetY * this.zoom;

    this.updateTransform();
    this.updateMinimap();
  }

  updateTransform() {
    this.world.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  render() {
    this.nodesLayer.innerHTML = '';
    this.nodeElements.clear();
    for (const node of this.model.nodes.values()) {
      this.createNodeElement(node);
    }
    this.renderConnections();
    this.updateMinimap();
  }

  createNodeElement(node) {
    const el = document.createElement('div');
    el.className = 'cosy-node';
    el.id = `dom_${node.id}`;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.width}px`;

    if (node.collapsed) el.classList.add('collapsed');

    // Header
    const header = document.createElement('div');
    header.className = 'node-header';

    const titleGroup = document.createElement('div');
    titleGroup.className = 'node-title-group';
    
    const icon = document.createElement('span');
    icon.className = 'node-category-icon';
    icon.textContent = node.definition.icon || '📦';
    
    const titleText = document.createElement('span');
    titleText.textContent = node.title;

    titleGroup.appendChild(icon);
    titleGroup.appendChild(titleText);

    const actions = document.createElement('div');
    actions.className = 'node-actions';

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'node-btn';
    collapseBtn.textContent = node.collapsed ? '▼' : '▲';
    collapseBtn.title = 'Collapse/Expand Node';
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      node.collapsed = !node.collapsed;
      el.classList.toggle('collapsed', node.collapsed);
      collapseBtn.textContent = node.collapsed ? '▼' : '▲';
      this.renderConnections();
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'node-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = 'Delete Node';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.model.removeNode(node.id);
    });

    actions.appendChild(collapseBtn);
    actions.appendChild(closeBtn);
    header.appendChild(titleGroup);
    header.appendChild(actions);

    // Node Dragging Handlers
    header.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      e.stopPropagation();
      
      if (!this.selectedNodeIds.has(node.id)) {
        if (!e.shiftKey) this.selectedNodeIds.clear();
        this.selectedNodeIds.add(node.id);
        this.updateSelectionUI();
      }

      this.isDraggingNodes = true;
      this.dragStartMouse = { x: e.clientX, y: e.clientY };
      this.nodeInitialPositions.clear();
      for (const selId of this.selectedNodeIds) {
        const selNode = this.model.nodes.get(selId);
        if (selNode) {
          this.nodeInitialPositions.set(selId, { x: selNode.x, y: selNode.y });
        }
      }
    });

    // Body
    const body = document.createElement('div');
    body.className = 'node-body';

    // Sockets Container
    const sockets = document.createElement('div');
    sockets.className = 'node-sockets';

    // Inputs Column
    const inputsCol = document.createElement('div');
    inputsCol.className = 'node-inputs';
    for (const port of node.inputs.values()) {
      inputsCol.appendChild(this.createPortElement(port, node));
    }

    // Outputs Column
    const outputsCol = document.createElement('div');
    outputsCol.className = 'node-outputs';
    for (const port of node.outputs.values()) {
      outputsCol.appendChild(this.createPortElement(port, node));
    }

    sockets.appendChild(inputsCol);
    sockets.appendChild(outputsCol);
    body.appendChild(sockets);

    // Inline Property Controls
    if (node.definition.properties) {
      const controls = document.createElement('div');
      controls.className = 'node-controls';
      for (const [propName, propDef] of Object.entries(node.definition.properties)) {
        controls.appendChild(this.createPropertyControl(propName, propDef, node));
      }
      body.appendChild(controls);
    }

    el.appendChild(header);
    el.appendChild(body);

    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.port-handle') || e.target.tagName === 'BUTTON') return;
      if (!e.shiftKey && !this.selectedNodeIds.has(node.id)) {
        this.selectedNodeIds.clear();
      }
      this.selectedNodeIds.add(node.id);
      this.updateSelectionUI();
    });

    this.nodesLayer.appendChild(el);
    this.nodeElements.set(node.id, el);
    return el;
  }

  createPortElement(port, node) {
    const portEl = document.createElement('div');
    portEl.className = `cosy-port port-${port.type}`;
    portEl.dataset.nodeId = node.id;
    portEl.dataset.portName = port.name;
    portEl.dataset.direction = port.direction;

    const handle = document.createElement('div');
    handle.className = 'port-handle';
    handle.title = `${port.label} (${port.type})`;

    const label = document.createElement('span');
    label.className = 'port-label';
    label.textContent = port.label;

    portEl.appendChild(handle);
    portEl.appendChild(label);

    // Wire dragging from handle
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.startWireDrag(port, node, handle);
    });

    return portEl;
  }

  createPropertyControl(propName, propDef, node) {
    const field = document.createElement('div');
    field.className = 'node-control-field';

    const label = document.createElement('label');
    label.className = 'node-control-label';
    label.textContent = propDef.label || propName;
    field.appendChild(label);

    const val = node.properties[propName] !== undefined ? node.properties[propName] : (propDef.default || '');

    if (propDef.type === 'select') {
      const select = document.createElement('select');
      select.className = 'node-select';
      for (const opt of (propDef.options || [])) {
        const option = document.createElement('option');
        option.value = typeof opt === 'object' ? opt.value : opt;
        option.textContent = typeof opt === 'object' ? opt.label : opt;
        if (option.value === val) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        node.properties[propName] = select.value;
        this.model.pushHistorySnapshot();
        globalEvents.emit('node:property_changed', { nodeId: node.id, propName, value: select.value });
      });
      field.appendChild(select);
    } else if (propDef.type === 'textarea') {
      const textarea = document.createElement('textarea');
      textarea.className = 'node-textarea';
      textarea.value = val;
      textarea.placeholder = propDef.placeholder || '';
      textarea.rows = propDef.rows || 2;
      textarea.addEventListener('input', () => {
        node.properties[propName] = textarea.value;
        globalEvents.emit('node:property_changed', { nodeId: node.id, propName, value: textarea.value });
      });
      textarea.addEventListener('change', () => {
        this.model.pushHistorySnapshot();
      });
      field.appendChild(textarea);
    } else {
      const input = document.createElement('input');
      input.className = 'node-input';
      input.type = propDef.type === 'number' ? 'number' : 'text';
      input.value = val;
      input.placeholder = propDef.placeholder || '';
      input.addEventListener('input', () => {
        node.properties[propName] = propDef.type === 'number' ? Number(input.value) : input.value;
        globalEvents.emit('node:property_changed', { nodeId: node.id, propName, value: node.properties[propName] });
      });
      input.addEventListener('change', () => {
        this.model.pushHistorySnapshot();
      });
      field.appendChild(input);
    }

    return field;
  }

  updateNodePosition(node) {
    const el = this.nodeElements.get(node.id);
    if (el) {
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    }
  }

  removeNodeElement(nodeId) {
    const el = this.nodeElements.get(nodeId);
    if (el) {
      el.remove();
      this.nodeElements.delete(nodeId);
    }
    this.selectedNodeIds.delete(nodeId);
    this.renderConnections();
    this.updateMinimap();
  }

  clearSelection() {
    this.selectedNodeIds.clear();
    this.selectedConnectionId = null;
    this.updateSelectionUI();
  }

  updateSelectionUI() {
    for (const [nodeId, el] of this.nodeElements.entries()) {
      el.classList.toggle('selected', this.selectedNodeIds.has(nodeId));
    }
    for (const [connId, path] of this.connectionPaths.entries()) {
      path.classList.toggle('cable-active', this.selectedConnectionId === connId);
    }
  }

  // --- Wire Dragging & Connecting ---

  startWireDrag(port, node, handle) {
    this.isDraggingWire = true;
    this.wireSourcePort = port;
    this.wireSourceNode = node;
    
    const portRect = handle.getBoundingClientRect();
    const centerScreen = {
      x: portRect.left + portRect.width / 2,
      y: portRect.top + portRect.height / 2
    };
    this.wireSourcePos = MathUtils.screenToWorld(centerScreen.x, centerScreen.y, this.panX, this.panY, this.zoom);
    this.draftCable.style.display = 'block';
  }

  updateDraftWire(targetWorldX, targetWorldY) {
    const p1 = this.wireSourcePos;
    const p2 = { x: targetWorldX, y: targetWorldY };
    
    // Orient correctly depending on if dragging from input or output
    const isOut = this.wireSourcePort.direction === 'output';
    const x1 = isOut ? p1.x : p2.x;
    const y1 = isOut ? p1.y : p2.y;
    const x2 = isOut ? p2.x : p1.x;
    const y2 = isOut ? p2.y : p1.y;

    const bezier = MathUtils.calculateCubicBezier(x1, y1, x2, y2);
    this.draftCable.setAttribute('d', bezier.path);
  }

  checkMagneticPortSnap(screenX, screenY) {
    const snapRadius = 24;
    const portHandles = this.container.querySelectorAll('.port-handle');
    let snapped = null;

    for (const handle of portHandles) {
      const rect = handle.getBoundingClientRect();
      const hx = rect.left + rect.width / 2;
      const hy = rect.top + rect.height / 2;
      if (MathUtils.distance(screenX, screenY, hx, hy) <= snapRadius) {
        const portEl = handle.closest('.cosy-port');
        const targetNodeId = portEl.dataset.nodeId;
        const targetPortName = portEl.dataset.portName;
        const targetPort = this.model.getPort(targetNodeId, targetPortName);

        if (targetPort && targetNodeId !== this.wireSourceNode.id && targetPort.direction !== this.wireSourcePort.direction) {
          snapped = { handle, port: targetPort, nodeId: targetNodeId };
          break;
        }
      }
    }

    if (this.snappedTargetPort && this.snappedTargetPort.handle !== snapped?.handle) {
      this.snappedTargetPort.handle.classList.remove('snapped');
    }

    if (snapped) {
      snapped.handle.classList.add('snapped');
      this.snappedTargetPort = snapped;
    } else {
      this.snappedTargetPort = null;
    }
  }

  endWireDrag() {
    this.isDraggingWire = false;
    this.draftCable.style.display = 'none';

    if (this.snappedTargetPort) {
      this.snappedTargetPort.handle.classList.remove('snapped');
      const srcIsOut = this.wireSourcePort.direction === 'output';
      const fromNodeId = srcIsOut ? this.wireSourceNode.id : this.snappedTargetPort.nodeId;
      const fromPortName = srcIsOut ? this.wireSourcePort.name : this.snappedTargetPort.port.name;
      const toNodeId = srcIsOut ? this.snappedTargetPort.nodeId : this.wireSourceNode.id;
      const toPortName = srcIsOut ? this.snappedTargetPort.port.name : this.wireSourcePort.name;

      this.model.connect(fromNodeId, fromPortName, toNodeId, toPortName);
    }

    this.wireSourcePort = null;
    this.wireSourceNode = null;
    this.snappedTargetPort = null;
  }

  // --- Cables Rendering ---

  renderConnections() {
    this.connectionsGroup.innerHTML = '';
    this.connectionPaths.clear();

    for (const conn of this.model.connections.values()) {
      const fromPos = this.getPortWorldPosition(conn.fromNode, conn.fromPort);
      const toPos = this.getPortWorldPosition(conn.toNode, conn.toPort);

      if (!fromPos || !toPos) continue;

      const bezier = MathUtils.calculateCubicBezier(fromPos.x, fromPos.y, toPos.x, toPos.y);
      const fromPort = this.model.getPort(conn.fromNode, conn.fromPort);
      const portType = fromPort?.type || 'any';

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', bezier.path);
      path.setAttribute('class', `graph-cable-path cable-${portType}`);
      path.dataset.connectionId = conn.id;

      // Click to select connection
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedConnectionId = conn.id;
        this.selectedNodeIds.clear();
        this.updateSelectionUI();
      });

      this.connectionsGroup.appendChild(path);
      this.connectionPaths.set(conn.id, path);
    }
  }

  getPortWorldPosition(nodeId, portName) {
    const el = this.nodeElements.get(nodeId);
    if (!el) return null;

    const portEl = el.querySelector(`.cosy-port[data-port-name="${portName}"]`);
    if (!portEl) return null;

    const handle = portEl.querySelector('.port-handle');
    const rect = handle.getBoundingClientRect();
    const screenCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    return MathUtils.screenToWorld(screenCenter.x, screenCenter.y, this.panX, this.panY, this.zoom);
  }

  // --- Pulses & Visual Feedback ---

  pulseNode(nodeId) {
    const el = this.nodeElements.get(nodeId);
    if (el) {
      el.classList.remove('node-executing');
      void el.offsetWidth; // Trigger reflow
      el.classList.add('node-executing');
    }
  }

  pulseCable(connId) {
    const path = this.connectionPaths.get(connId);
    if (path) {
      const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pulse.setAttribute('d', path.getAttribute('d'));
      pulse.setAttribute('class', 'graph-cable-pulse');
      this.connectionsGroup.appendChild(pulse);
      setTimeout(() => pulse.remove(), 800);
    }
  }

  // --- Minimap & Navigation ---

  updateMinimap() {
    if (!this.minimapCanvas) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width = 160;
    const h = this.minimapCanvas.height = 110;

    ctx.clearRect(0, 0, w, h);

    const nodes = Array.from(this.model.nodes.values());
    if (nodes.length === 0) return;

    const aabb = MathUtils.calculateAABB(nodes, 200);

    // Map world coords to minimap coords
    const mapX = (x) => ((x - aabb.minX) / aabb.width) * w;
    const mapY = (y) => ((y - aabb.minY) / aabb.height) * h;

    // Draw nodes
    ctx.fillStyle = '#3f3f46';
    for (const node of nodes) {
      const nx = mapX(node.x);
      const ny = mapY(node.y);
      const nw = Math.max(4, (node.width / aabb.width) * w);
      const nh = Math.max(3, ((node.height || 140) / aabb.height) * h);
      ctx.fillRect(nx, ny, nw, nh);
    }

    // Draw active viewport rect
    const vpWorldLeft = -this.panX / this.zoom;
    const vpWorldTop = -this.panY / this.zoom;
    const vpWorldRight = (this.container.clientWidth - this.panX) / this.zoom;
    const vpWorldBottom = (this.container.clientHeight - this.panY) / this.zoom;

    const vx = mapX(vpWorldLeft);
    const vy = mapY(vpWorldTop);
    const vw = mapX(vpWorldRight) - vx;
    const vh = mapY(vpWorldBottom) - vy;

    this.minimapViewport.style.left = `${MathUtils.clamp(vx, 0, w)}px`;
    this.minimapViewport.style.top = `${MathUtils.clamp(vy, 0, h)}px`;
    this.minimapViewport.style.width = `${MathUtils.clamp(vw, 4, w)}px`;
    this.minimapViewport.style.height = `${MathUtils.clamp(vh, 4, h)}px`;
  }

  fitToView() {
    const nodes = Array.from(this.model.nodes.values());
    if (nodes.length === 0) return;

    const aabb = MathUtils.calculateAABB(nodes, 80);
    const vpW = this.container.clientWidth;
    const vpH = this.container.clientHeight;

    const zoomX = vpW / aabb.width;
    const zoomY = vpH / aabb.height;
    this.zoom = MathUtils.clamp(Math.min(zoomX, zoomY), 0.35, 1.2);

    this.panX = vpW / 2 - aabb.centerX * this.zoom;
    this.panY = vpH / 2 - aabb.centerY * this.zoom;

    this.updateTransform();
    this.updateMinimap();
  }

  resetView() {
    this.zoom = 1.0;
    this.panX = 80;
    this.panY = 80;
    this.updateTransform();
    this.updateMinimap();
  }
}
