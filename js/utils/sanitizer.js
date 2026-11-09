/**
 * CosyUI - Sanitizer & Error Prevention
 * Type checking, DAG cycle detection, API key scrubbing, and defensive validation.
 */

export const Sanitizer = {
  /**
   * Port type compatibility matrix
   */
  canConnectPorts(fromPort, toPort) {
    if (!fromPort || !toPort) return false;
    
    // Cannot connect output to output, or input to input
    if (fromPort.direction === toPort.direction) return false;

    const outPort = fromPort.direction === 'output' ? fromPort : toPort;
    const inPort = fromPort.direction === 'input' ? fromPort : toPort;

    const outType = (outPort.type || 'any').toLowerCase();
    const inType = (inPort.type || 'any').toLowerCase();

    // Trigger (Execution Flow) ports must connect strictly to Trigger ports
    if (outType === 'trigger' || inType === 'trigger') {
      return outType === inType;
    }

    // Wildcard 'any' accepts any data type
    if (inType === 'any' || outType === 'any') return true;

    // Identical data types
    if (outType === inType) return true;

    // Permitted data coercions:
    // Any primitive can be read as a string
    if (inType === 'string') return true;

    // Numbers can be coerced to boolean (0 = false, others = true)
    if (inType === 'boolean' && outType === 'number') return true;

    return false;
  },

  /**
   * Coerce data value to target port type
   */
  coerceValue(value, targetType) {
    if (value === undefined || value === null) return value;
    switch ((targetType || '').toLowerCase()) {
      case 'string':
        if (typeof value === 'object') {
          try { return JSON.stringify(value); } catch { return String(value); }
        }
        return String(value);
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      case 'boolean':
        return Boolean(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        if (typeof value === 'object') return value;
        try { return JSON.parse(value); } catch { return { value }; }
      default:
        return value;
    }
  },

  /**
   * Detect circular references in value dataflow using 3-color DFS
   * Returns true if cycle exists
   */
  hasCycle(graph) {
    const adj = new Map();
    for (const node of graph.nodes.values()) {
      adj.set(node.id, []);
    }

    // Populate adjacency list from non-trigger connections
    for (const conn of graph.connections.values()) {
      const fromPort = graph.getPort(conn.fromNode, conn.fromPort);
      if (fromPort && fromPort.type !== 'trigger') {
        if (adj.has(conn.fromNode)) {
          adj.get(conn.fromNode).push(conn.toNode);
        }
      }
    }

    // 0 = unvisited (white), 1 = visiting (gray), 2 = visited (black)
    const state = new Map();
    for (const nodeId of adj.keys()) {
      state.set(nodeId, 0);
    }

    function dfs(u) {
      state.set(u, 1);
      for (const v of (adj.get(u) || [])) {
        if (state.get(v) === 1) return true; // Cycle detected
        if (state.get(v) === 0 && dfs(v)) return true;
      }
      state.set(u, 2);
      return false;
    }

    for (const nodeId of adj.keys()) {
      if (state.get(nodeId) === 0) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  },

  /**
   * Scrub sensitive API keys and secrets before exporting project JSON
   */
  scrubSensitiveKeys(projectData) {
    if (!projectData) return projectData;
    const cloned = JSON.parse(JSON.stringify(projectData));

    // Delete any top-level keys
    delete cloned.apiKey;
    delete cloned.apiKeys;
    delete cloned.secrets;

    // Check node properties for api key fields
    if (Array.isArray(cloned.nodes)) {
      for (const node of cloned.nodes) {
        if (node.properties) {
          delete node.properties.apiKey;
          delete node.properties.openAiKey;
          delete node.properties.anthropicKey;
          delete node.properties.openRouterKey;
        }
      }
    }

    return cloned;
  },

  /**
   * Validate project JSON schema
   */
  validateProjectSchema(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid project file: payload must be a JSON object.');
    }
    if (!Array.isArray(data.nodes)) {
      throw new Error('Invalid project file: missing "nodes" array.');
    }
    if (!Array.isArray(data.connections)) {
      throw new Error('Invalid project file: missing "connections" array.');
    }
    return true;
  }
};
