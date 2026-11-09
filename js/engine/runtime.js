/**
 * CosyUI - Graph Execution Engine
 * Reactive dual-mode execution (Trigger Pulses + Data Streams) with cycle protection.
 */
import { Sanitizer } from '../utils/sanitizer.js';
import { globalEvents } from '../utils/event-bus.js';

export class ExecutionContext {
  constructor(runtime, sourceTriggerNodeId = null) {
    this.runtime = runtime;
    this.sourceTriggerNodeId = sourceTriggerNodeId;
    this.tickCount = 0;
    this.maxTicks = 100; // Loop tripwire guard
    this.cachedValues = new Map(); // Cache values per execution cycle
  }

  tick() {
    this.tickCount++;
    if (this.tickCount > this.maxTicks) {
      throw new Error(`Infinite loop detected! Execution exceeded ${this.maxTicks} steps.`);
    }
  }
}

export class GraphRuntime {
  constructor(model, registry, llmClient, playerBridge) {
    this.model = model;
    this.registry = registry;
    this.llmClient = llmClient;
    this.playerBridge = playerBridge;
    this.isRunning = false;

    // Listen for Player UI events (e.g. Chat message sent, choice button clicked, item clicked)
    globalEvents.on('player:chat_sent', ({ text }) => this.handlePlayerChat(text));
    globalEvents.on('player:choice_selected', ({ choice, nodeId }) => this.handlePlayerChoice(choice, nodeId));
    globalEvents.on('player:item_clicked', ({ item, nodeId }) => this.handlePlayerItemClick(item, nodeId));
  }

  /**
   * Run graph from all 'core.start' or starter trigger nodes
   */
  async runGraph() {
    const startNodes = [];
    for (const node of this.model.nodes.values()) {
      if (node.type === 'core.start') {
        startNodes.push(node);
      }
    }

    if (startNodes.length === 0) {
      // If no start node, look for any input node or UI chatbox node
      for (const node of this.model.nodes.values()) {
        if (node.type === 'ui.chatbox' || node.type === 'core.trigger') {
          startNodes.push(node);
          break;
        }
      }
    }

    if (startNodes.length === 0) {
      globalEvents.emit('toast', { type: 'info', message: 'No Start node found. Add a "Start" node to begin workflow.' });
      return;
    }

    const ctx = new ExecutionContext(this);
    for (const startNode of startNodes) {
      await this.executeNodeTrigger(startNode.id, 'trigger', ctx);
    }
  }

  /**
   * Execute a trigger on a specific node
   */
  async executeNodeTrigger(nodeId, inPortName, ctx) {
    ctx.tick();

    const node = this.model.nodes.get(nodeId);
    if (!node) return;

    const def = this.registry.get(node.type);
    if (!def || !def.execute) return;

    globalEvents.emit('runtime:node_pulse', { nodeId: node.id });

    // Build node execution scope
    const nodeScope = {
      properties: { ...node.properties },
      getInputValue: async (portName) => {
        return await this.resolveInputValue(node, portName, ctx);
      },
      setOutputValue: (portName, val) => {
        const outPort = node.outputs.get(portName);
        if (outPort) {
          outPort.value = val;
        }
      },
      getVariable: (name) => {
        return this.model.variables[name];
      },
      setVariable: (name, val) => {
        this.model.variables[name] = val;
        globalEvents.emit('variable:changed', { name, value: val });
      },
      llmClient: this.llmClient,
      playerBridge: this.playerBridge,
      trigger: async (outPortName, payload = null) => {
        const outConns = this.model.getOutputConnections(node.id, outPortName);
        for (const conn of outConns) {
          globalEvents.emit('runtime:cable_pulse', { connId: conn.id });
          await this.executeNodeTrigger(conn.toNode, conn.toPort, ctx);
        }
      }
    };

    try {
      await def.execute(nodeScope, inPortName, ctx);
    } catch (err) {
      console.error(`[Runtime] Execution error in node "${node.title}" (${node.id}):`, err);
      globalEvents.emit('toast', { type: 'error', message: `Error in ${node.title}: ${err.message}` });
    }
  }

  /**
   * Resolve an input value by pulling from connected output or reading default/property
   */
  async resolveInputValue(node, portName, ctx) {
    const conn = this.model.getInputConnection(node.id, portName);
    const inPort = node.inputs.get(portName);

    if (!conn) {
      // If port is not connected, use property value if available, or port default
      if (node.properties[portName] !== undefined) {
        return node.properties[portName];
      }
      return inPort ? inPort.value : null;
    }

    // Connected to another node's output
    const srcNode = this.model.nodes.get(conn.fromNode);
    if (!srcNode) return inPort?.value ?? null;

    const srcPort = srcNode.outputs.get(conn.fromPort);
    if (!srcPort) return inPort?.value ?? null;

    // Evaluate source node if it has a compute/evaluate function and value is not yet cached
    const srcDef = this.registry.get(srcNode.type);
    if (srcDef && srcDef.evaluate) {
      const cacheKey = `${srcNode.id}_${srcPort.name}`;
      if (ctx.cachedValues.has(cacheKey)) {
        return ctx.cachedValues.get(cacheKey);
      }

      const scope = {
        properties: { ...srcNode.properties },
        getInputValue: (pName) => this.resolveInputValue(srcNode, pName, ctx),
        getVariable: (name) => this.model.variables[name],
        llmClient: this.llmClient
      };

      const computedValues = await srcDef.evaluate(scope, ctx);
      if (computedValues && typeof computedValues === 'object') {
        for (const [outName, val] of Object.entries(computedValues)) {
          const p = srcNode.outputs.get(outName);
          if (p) p.value = val;
          ctx.cachedValues.set(`${srcNode.id}_${outName}`, val);
        }
      }
    }

    return Sanitizer.coerceValue(srcPort.value, inPort.type);
  }

  // --- Handlers for Player View Interaction ---

  async handlePlayerChat(text) {
    // Find UI Chatbox nodes and trigger their onMessage output
    const ctx = new ExecutionContext(this);
    for (const node of this.model.nodes.values()) {
      if (node.type === 'ui.chatbox') {
        const outPort = node.outputs.get('message');
        if (outPort) outPort.value = text;
        const promptPort = node.outputs.get('prompt');
        if (promptPort) promptPort.value = text;

        const outConns = this.model.getOutputConnections(node.id, 'onMessage');
        for (const conn of outConns) {
          globalEvents.emit('runtime:cable_pulse', { connId: conn.id });
          await this.executeNodeTrigger(conn.toNode, conn.toPort, ctx);
        }
      }
    }
  }

  async handlePlayerChoice(choice, nodeId) {
    const ctx = new ExecutionContext(this);
    const node = this.model.nodes.get(nodeId);
    if (node) {
      const outPort = node.outputs.get('selected');
      if (outPort) outPort.value = choice;
      const outConns = this.model.getOutputConnections(node.id, 'onSelect');
      for (const conn of outConns) {
        globalEvents.emit('runtime:cable_pulse', { connId: conn.id });
        await this.executeNodeTrigger(conn.toNode, conn.toPort, ctx);
      }
    }
  }

  async handlePlayerItemClick(item, nodeId) {
    const ctx = new ExecutionContext(this);
    const node = this.model.nodes.get(nodeId);
    if (node) {
      const outPort = node.outputs.get('item');
      if (outPort) outPort.value = item;
      const outConns = this.model.getOutputConnections(node.id, 'onUse');
      for (const conn of outConns) {
        globalEvents.emit('runtime:cable_pulse', { connId: conn.id });
        await this.executeNodeTrigger(conn.toNode, conn.toPort, ctx);
      }
    }
  }
}
