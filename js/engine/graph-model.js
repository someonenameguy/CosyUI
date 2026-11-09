/**
 * CosyUI - Graph Data Model
 * Reactive data structures for Nodes, Ports, and Connections with Undo/Redo history.
 */
import { Sanitizer } from '../utils/sanitizer.js';
import { globalEvents } from '../utils/event-bus.js';

export class Port {
  constructor(nodeId, name, def, direction) {
    this.nodeId = nodeId;
    this.name = name;
    this.label = def.label || name;
    this.type = def.type || 'any'; // 'trigger', 'string', 'number', 'boolean', 'array', 'object', 'ui', 'any'
    this.direction = direction; // 'input' or 'output'
    this.value = def.default !== undefined ? def.default : null;
  }
}

export class Node {
  constructor(id, type, definition, x = 100, y = 100, properties = {}) {
    this.id = id;
    this.type = type;
    this.title = definition.title || type;
    this.category = definition.category || 'general';
    this.x = x;
    this.y = y;
    this.width = definition.width || 240;
    this.height = definition.height || 160;
    this.collapsed = false;
    this.definition = definition;
    
    // Merge default properties with provided properties
    this.properties = { ...(definition.defaultProperties || {}), ...properties };

    // Initialize ports from definition
    this.inputs = new Map();
    this.outputs = new Map();

    if (definition.inputs) {
      for (const [name, def] of Object.entries(definition.inputs)) {
        this.inputs.set(name, new Port(this.id, name, def, 'input'));
      }
    }

    if (definition.outputs) {
      for (const [name, def] of Object.entries(definition.outputs)) {
        this.outputs.set(name, new Port(this.id, name, def, 'output'));
      }
    }

    // Dynamic runtime state
    this.state = {};
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      x: Math.round(this.x),
      y: Math.round(this.y),
      collapsed: this.collapsed,
      properties: { ...this.properties }
    };
  }
}

export class Connection {
  constructor(id, fromNode, fromPort, toNode, toPort) {
    this.id = id;
    this.fromNode = fromNode;
    this.fromPort = fromPort;
    this.toNode = toNode;
    this.toPort = toPort;
  }

  toJSON() {
    return {
      id: this.id,
      fromNode: this.fromNode,
      fromPort: this.fromPort,
      toNode: this.toNode,
      toPort: this.toPort
    };
  }
}

export class GraphModel {
  constructor() {
    this.nodes = new Map();
    this.connections = new Map();
    this.variables = {};
    this.metadata = {
      title: 'CosyUI Project',
      version: '1.0.0',
      created: new Date().toISOString()
    };
    
    // History stack for Undo / Redo
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 30;
    this.isApplyingHistory = false;
  }

  /**
   * Save snapshot for undo
   */
  pushHistorySnapshot() {
    if (this.isApplyingHistory) return;
    const snapshot = JSON.stringify(this.serialize());
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = []; // Clear redo stack on new action
    globalEvents.emit('graph:changed');
  }

  undo(nodeRegistry) {
    if (this.undoStack.length === 0) return false;
    const current = JSON.stringify(this.serialize());
    this.redoStack.push(current);
    const prev = JSON.parse(this.undoStack.pop());
    this.isApplyingHistory = true;
    this.deserialize(prev, nodeRegistry);
    this.isApplyingHistory = false;
    globalEvents.emit('graph:history_changed');
    return true;
  }

  redo(nodeRegistry) {
    if (this.redoStack.length === 0) return false;
    const current = JSON.stringify(this.serialize());
    this.undoStack.push(current);
    const next = JSON.parse(this.redoStack.pop());
    this.isApplyingHistory = true;
    this.deserialize(next, nodeRegistry);
    this.isApplyingHistory = false;
    globalEvents.emit('graph:history_changed');
    return true;
  }

  /**
   * Add a node to graph
   */
  addNode(type, definition, x = 100, y = 100, properties = {}, id = null) {
    this.pushHistorySnapshot();
    const nodeId = id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const node = new Node(nodeId, type, definition, x, y, properties);
    this.nodes.set(nodeId, node);
    globalEvents.emit('node:added', node);
    return node;
  }

  /**
   * Remove a node and cleanup all incident connections
   */
  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    this.pushHistorySnapshot();

    // Remove all connections to or from this node
    const connsToRemove = [];
    for (const [id, conn] of this.connections.entries()) {
      if (conn.fromNode === nodeId || conn.toNode === nodeId) {
        connsToRemove.push(id);
      }
    }
    for (const id of connsToRemove) {
      this.disconnect(id);
    }

    this.nodes.delete(nodeId);
    globalEvents.emit('node:removed', nodeId);
    return true;
  }

  /**
   * Connect two ports
   */
  connect(fromNodeId, fromPortName, toNodeId, toPortName) {
    const fromPort = this.getPort(fromNodeId, fromPortName);
    const toPort = this.getPort(toNodeId, toPortName);

    if (!fromPort || !toPort) return null;
    if (fromNodeId === toNodeId) return null; // Prevent self loops

    // Validate type compatibility
    if (!Sanitizer.canConnectPorts(fromPort, toPort)) {
      globalEvents.emit('toast', { type: 'warning', message: `Cannot connect ${fromPort.type} to ${toPort.type}` });
      return null;
    }

    // Check if input port is already connected (unless it's a trigger port which can have multiple inputs)
    if (toPort.type !== 'trigger') {
      const existingInput = this.getInputConnection(toNodeId, toPortName);
      if (existingInput) {
        this.disconnect(existingInput.id);
      }
    }

    // Check for exact duplicate connection
    for (const conn of this.connections.values()) {
      if (conn.fromNode === fromNodeId && conn.fromPort === fromPortName &&
          conn.toNode === toNodeId && conn.toPort === toPortName) {
        return conn;
      }
    }

    this.pushHistorySnapshot();
    const connId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const connection = new Connection(connId, fromNodeId, fromPortName, toNodeId, toPortName);
    this.connections.set(connId, connection);

    globalEvents.emit('connection:added', connection);
    return connection;
  }

  /**
   * Remove a connection by ID
   */
  disconnect(connId) {
    const conn = this.connections.get(connId);
    if (!conn) return false;

    this.connections.delete(connId);
    globalEvents.emit('connection:removed', connId);
    return true;
  }

  /**
   * Get port reference
   */
  getPort(nodeId, portName) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    return node.inputs.get(portName) || node.outputs.get(portName) || null;
  }

  /**
   * Get single input connection for a port
   */
  getInputConnection(nodeId, portName) {
    for (const conn of this.connections.values()) {
      if (conn.toNode === nodeId && conn.toPort === portName) {
        return conn;
      }
    }
    return null;
  }

  /**
   * Get all output connections from a port
   */
  getOutputConnections(nodeId, portName) {
    const list = [];
    for (const conn of this.connections.values()) {
      if (conn.fromNode === nodeId && conn.fromPort === portName) {
        list.push(conn);
      }
    }
    return list;
  }

  /**
   * Serialize entire graph to standard JSON
   */
  serialize() {
    return {
      version: '1.0.0',
      metadata: { ...this.metadata, updated: new Date().toISOString() },
      nodes: Array.from(this.nodes.values()).map(n => n.toJSON()),
      connections: Array.from(this.connections.values()).map(c => c.toJSON()),
      variables: { ...this.variables }
    };
  }

  /**
   * Deserialize graph from JSON
   */
  deserialize(data, nodeRegistry) {
    Sanitizer.validateProjectSchema(data);
    this.clear(false);

    this.metadata = { ...(data.metadata || {}) };
    this.variables = { ...(data.variables || {}) };

    // Reconstruct nodes
    for (const nodeData of (data.nodes || [])) {
      const def = nodeRegistry.get(nodeData.type) || { title: nodeData.title || nodeData.type };
      const node = new Node(
        nodeData.id,
        nodeData.type,
        def,
        nodeData.x,
        nodeData.y,
        nodeData.properties || {}
      );
      node.collapsed = Boolean(nodeData.collapsed);
      this.nodes.set(node.id, node);
    }

    // Reconstruct connections
    for (const connData of (data.connections || [])) {
      const conn = new Connection(
        connData.id,
        connData.fromNode,
        connData.fromPort,
        connData.toNode,
        connData.toPort
      );
      this.connections.set(conn.id, conn);
    }

    globalEvents.emit('graph:deserialized', this);
  }

  /**
   * Clear all nodes and connections
   */
  clear(pushHistory = true) {
    if (pushHistory) this.pushHistorySnapshot();
    this.connections.clear();
    this.nodes.clear();
    globalEvents.emit('graph:cleared');
  }
}
