/**
 * CosyUI - Node Definitions & Registry
 * Complete taxonomy of 24 nodes across Flow, LLM, UI Widgets, Game Logic, and Utilities.
 */
import { GameLogicEngine } from '../engine/game-logic.js';
import { globalEvents } from '../utils/event-bus.js';

export const NodeDefinitions = {

  // ==========================================
  // CATEGORY 1: FLOW & EXECUTION
  // ==========================================

  'core.start': {
    title: 'Start',
    category: 'flow',
    icon: '🚩',
    width: 200,
    inputs: {},
    outputs: {
      trigger: { label: 'Start', type: 'trigger' }
    },
    properties: {
      label: { type: 'text', label: 'Label', default: 'Workflow Entry' }
    },
    async execute(scope) {
      await scope.trigger('trigger');
    }
  },

  'core.trigger': {
    title: 'Manual Trigger',
    category: 'flow',
    icon: '⚡',
    width: 220,
    inputs: {},
    outputs: {
      trigger: { label: 'Pulse', type: 'trigger' }
    },
    properties: {
      actionName: { type: 'text', label: 'Action Name', default: 'Activate' }
    },
    async execute(scope) {
      await scope.trigger('trigger');
    }
  },

  'core.branch': {
    title: 'Condition (Branch)',
    category: 'flow',
    icon: '🔀',
    width: 260,
    inputs: {
      trigger: { label: 'In', type: 'trigger' },
      left: { label: 'Value A', type: 'any' },
      right: { label: 'Value B', type: 'any' }
    },
    outputs: {
      onTrue: { label: 'True', type: 'trigger' },
      onFalse: { label: 'False', type: 'trigger' }
    },
    properties: {
      operator: {
        type: 'select',
        label: 'Condition',
        default: '>=',
        options: [
          { value: '==', label: 'Equals (==)' },
          { value: '!=', label: 'Not Equals (!=)' },
          { value: '>', label: 'Greater Than (>)' },
          { value: '>=', label: 'Greater or Equal (>=)' },
          { value: '<', label: 'Less Than (<)' },
          { value: '<=', label: 'Less or Equal (<=)' },
          { value: 'contains', label: 'Contains' },
          { value: 'regex_match', label: 'Regex Match' }
        ]
      },
      compareValue: { type: 'text', label: 'Default Value B', default: '15' }
    },
    async execute(scope) {
      const a = await scope.getInputValue('left');
      let b = await scope.getInputValue('right');
      if (b === null || b === undefined || b === '') {
        b = scope.properties.compareValue;
      }
      const result = GameLogicEngine.evaluateCondition(a, scope.properties.operator, b);
      if (result) {
        await scope.trigger('onTrue');
      } else {
        await scope.trigger('onFalse');
      }
    }
  },

  'core.delay': {
    title: 'Delay Timer',
    category: 'flow',
    icon: '⏳',
    width: 220,
    inputs: {
      trigger: { label: 'In', type: 'trigger' },
      ms: { label: 'Milliseconds', type: 'number', default: 500 }
    },
    outputs: {
      trigger: { label: 'Out', type: 'trigger' }
    },
    properties: {
      duration: { type: 'number', label: 'Delay (ms)', default: 500 }
    },
    async execute(scope) {
      const time = (await scope.getInputValue('ms')) || scope.properties.duration || 500;
      await new Promise(r => setTimeout(r, time));
      await scope.trigger('trigger');
    }
  },

  'core.switch': {
    title: 'Switch / Match',
    category: 'flow',
    icon: '🚦',
    width: 250,
    inputs: {
      trigger: { label: 'In', type: 'trigger' },
      input: { label: 'Input Value', type: 'string' }
    },
    outputs: {
      case1: { label: 'Match 1', type: 'trigger' },
      case2: { label: 'Match 2', type: 'trigger' },
      default: { label: 'Default', type: 'trigger' }
    },
    properties: {
      pattern1: { type: 'text', label: 'Pattern 1', default: 'attack' },
      pattern2: { type: 'text', label: 'Pattern 2', default: 'search' }
    },
    async execute(scope) {
      const val = String((await scope.getInputValue('input')) || '').toLowerCase();
      if (val.includes(scope.properties.pattern1.toLowerCase())) {
        await scope.trigger('case1');
      } else if (val.includes(scope.properties.pattern2.toLowerCase())) {
        await scope.trigger('case2');
      } else {
        await scope.trigger('default');
      }
    }
  },

  // ==========================================
  // CATEGORY 2: LLM RUNTIME
  // ==========================================

  'llm.universal': {
    title: 'Universal LLM',
    category: 'llm',
    icon: '🧠',
    width: 320,
    inputs: {
      trigger: { label: 'Run', type: 'trigger' },
      prompt: { label: 'User Prompt', type: 'string' },
      system: { label: 'System Prompt', type: 'string' }
    },
    outputs: {
      onComplete: { label: 'Done', type: 'trigger' },
      text: { label: 'Output Text', type: 'string' },
      json: { label: 'Parsed JSON', type: 'object' }
    },
    properties: {
      provider: {
        type: 'select',
        label: 'Provider',
        default: 'mock',
        options: [
          { value: 'mock', label: 'Offline Mock Simulator' },
          { value: 'openai', label: 'OpenAI (GPT-4o-mini)' },
          { value: 'anthropic', label: 'Anthropic (Claude 3.5)' },
          { value: 'openrouter', label: 'OpenRouter' },
          { value: 'ollama', label: 'Ollama (Local)' }
        ]
      },
      model: { type: 'text', label: 'Model Name', default: 'gpt-4o-mini' },
      temperature: { type: 'number', label: 'Temperature (0.0 - 1.0)', default: 0.7 },
      systemPrompt: {
        type: 'textarea',
        label: 'System Prompt',
        default: 'You are an immersive Dungeon Master guiding a tabletop adventure.'
      }
    },
    async execute(scope) {
      const userPrompt = (await scope.getInputValue('prompt')) || 'Describe what happens next.';
      const sysPrompt = (await scope.getInputValue('system')) || scope.properties.systemPrompt;

      const resultText = await scope.llmClient.complete({
        provider: scope.properties.provider,
        model: scope.properties.model,
        prompt: userPrompt,
        systemPrompt: sysPrompt,
        temperature: Number(scope.properties.temperature),
        onToken: (chunk, full) => {
          scope.setOutputValue('text', full);
        }
      });

      scope.setOutputValue('text', resultText);
      const parsedJson = scope.llmClient.extractJSON(resultText);
      if (parsedJson) {
        scope.setOutputValue('json', parsedJson);
      }

      await scope.trigger('onComplete');
    }
  },

  'llm.mock': {
    title: 'Mock Simulator',
    category: 'llm',
    icon: '🎲',
    width: 280,
    inputs: {
      trigger: { label: 'Generate', type: 'trigger' },
      context: { label: 'Context / Roll', type: 'any' }
    },
    outputs: {
      trigger: { label: 'Done', type: 'trigger' },
      narrative: { label: 'Narrative', type: 'string' }
    },
    properties: {
      persona: {
        type: 'select',
        label: 'Simulator Persona',
        default: 'dungeon_master',
        options: [
          { value: 'dungeon_master', label: 'Fantasy Dungeon Master' },
          { value: 'sci_fi_ai', label: 'Derelict Ship Computer' },
          { value: 'debate_moderator', label: 'Debate Moderator' },
          { value: 'customer_agent', label: 'Support Specialist' }
        ]
      }
    },
    async execute(scope) {
      const ctxVal = await scope.getInputValue('context');
      const text = await scope.llmClient.simulateMockLLM({
        prompt: String(ctxVal || 'Action executed'),
        systemPrompt: scope.properties.persona,
        onToken: (t, full) => {
          scope.setOutputValue('narrative', full);
        }
      });
      scope.setOutputValue('narrative', text);
      await scope.trigger('trigger');
    }
  },

  'llm.template': {
    title: 'Prompt Template',
    category: 'llm',
    icon: '📝',
    width: 300,
    inputs: {
      trigger: { label: 'Format', type: 'trigger' },
      var1: { label: 'Var 1', type: 'any' },
      var2: { label: 'Var 2', type: 'any' }
    },
    outputs: {
      trigger: { label: 'Out', type: 'trigger' },
      prompt: { label: 'Rendered Text', type: 'string' }
    },
    properties: {
      template: {
        type: 'textarea',
        label: 'Template ({{var1}}, {{var2}})',
        default: 'The adventurer takes an action! Result roll: {{var1}}. Current HP: {{hp}}.'
      }
    },
    async execute(scope) {
      const v1 = await scope.getInputValue('var1');
      const v2 = await scope.getInputValue('var2');
      const vars = {
        var1: v1,
        var2: v2,
        hp: scope.getVariable('hp'),
        gold: scope.getVariable('gold')
      };
      const rendered = scope.llmClient.renderTemplate(scope.properties.template, vars);
      scope.setOutputValue('prompt', rendered);
      await scope.trigger('trigger');
    },
    async evaluate(scope) {
      const v1 = await scope.getInputValue('var1');
      const v2 = await scope.getInputValue('var2');
      const vars = { var1: v1, var2: v2, hp: scope.getVariable('hp') };
      return {
        prompt: scope.llmClient.renderTemplate(scope.properties.template, vars)
      };
    }
  },

  'llm.memory': {
    title: 'Conversation Memory',
    category: 'llm',
    icon: '📚',
    width: 270,
    inputs: {
      trigger: { label: 'Append', type: 'trigger' },
      userMessage: { label: 'User Msg', type: 'string' },
      assistantMessage: { label: 'AI Msg', type: 'string' }
    },
    outputs: {
      trigger: { label: 'Updated', type: 'trigger' },
      history: { label: 'History Array', type: 'array' },
      transcript: { label: 'Plain Text', type: 'string' }
    },
    properties: {
      maxTurns: { type: 'number', label: 'Max History Turns', default: 8 }
    },
    async execute(scope) {
      let hist = scope.getVariable('conversation_history') || [];
      const userMsg = await scope.getInputValue('userMessage');
      const aiMsg = await scope.getInputValue('assistantMessage');

      if (userMsg) {
        hist = GameLogicEngine.updateSlidingMemory(hist, 'user', userMsg, scope.properties.maxTurns);
      }
      if (aiMsg) {
        hist = GameLogicEngine.updateSlidingMemory(hist, 'assistant', aiMsg, scope.properties.maxTurns);
      }

      scope.setVariable('conversation_history', hist);
      scope.setOutputValue('history', hist);

      const transcript = hist.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      scope.setOutputValue('transcript', transcript);
      await scope.trigger('trigger');
    }
  },

  'llm.json_extractor': {
    title: 'JSON Extractor',
    category: 'llm',
    icon: '🔍',
    width: 260,
    inputs: {
      trigger: { label: 'Parse', type: 'trigger' },
      rawText: { label: 'Raw LLM Text', type: 'string' }
    },
    outputs: {
      onSuccess: { label: 'Success', type: 'trigger' },
      onFail: { label: 'Fail', type: 'trigger' },
      json: { label: 'Object', type: 'object' }
    },
    properties: {},
    async execute(scope) {
      const raw = await scope.getInputValue('rawText');
      const obj = scope.llmClient.extractJSON(raw);
      if (obj) {
        scope.setOutputValue('json', obj);
        await scope.trigger('onSuccess');
      } else {
        await scope.trigger('onFail');
      }
    }
  },

  // ==========================================
  // CATEGORY 3: UI FRONTEND WIDGETS
  // ==========================================

  'ui.story': {
    title: 'UI Story Box',
    category: 'ui',
    icon: '📖',
    width: 280,
    inputs: {
      trigger: { label: 'Display', type: 'trigger' },
      text: { label: 'Narrative Text', type: 'string' }
    },
    outputs: {
      trigger: { label: 'Rendered', type: 'trigger' }
    },
    properties: {
      title: { type: 'text', label: 'Box Header', default: 'Adventure Chronicle' },
      text: {
        type: 'textarea',
        label: 'Default Text',
        default: 'You stand before the obsidian gates of the Citadel...'
      }
    },
    async execute(scope) {
      const inText = await scope.getInputValue('text');
      const textToDisplay = inText || scope.properties.text;
      scope.playerBridge.updateStoryWidget(scope.nodeId, textToDisplay);
      await scope.trigger('trigger');
    }
  },

  'ui.chatbox': {
    title: 'UI Chatbox',
    category: 'ui',
    icon: '💬',
    width: 290,
    inputs: {
      trigger: { label: 'Post Bot Msg', type: 'trigger' },
      botMessage: { label: 'Bot Message', type: 'string' }
    },
    outputs: {
      onMessage: { label: 'On User Send', type: 'trigger' },
      message: { label: 'User Message', type: 'string' },
      prompt: { label: 'Prompt', type: 'string' }
    },
    properties: {
      title: { type: 'text', label: 'Chat Title', default: 'Companion Dialogue' },
      placeholder: { type: 'text', label: 'Input Placeholder', default: 'Speak or take action...' },
      welcomeMessage: { type: 'text', label: 'Welcome Msg', default: 'Welcome! What shall we do?' }
    },
    async execute(scope) {
      const botMsg = await scope.getInputValue('botMessage');
      if (botMsg) {
        scope.playerBridge.addAssistantMessage(scope.nodeId, botMsg);
      }
    }
  },

  'ui.stat_bar': {
    title: 'UI Stat Bar',
    category: 'ui',
    icon: '❤️',
    width: 260,
    inputs: {
      trigger: { label: 'Update', type: 'trigger' },
      value: { label: 'Current Value', type: 'number' }
    },
    outputs: {
      trigger: { label: 'Updated', type: 'trigger' }
    },
    properties: {
      label: { type: 'text', label: 'Label', default: 'Health' },
      variableName: { type: 'text', label: 'Variable (e.g. hp)', default: 'hp' },
      value: { type: 'number', label: 'Default Value', default: 100 },
      max: { type: 'number', label: 'Max Value', default: 100 },
      style: {
        type: 'select',
        label: 'Gauge Color Theme',
        default: 'hp',
        options: [
          { value: 'hp', label: 'Health (Red)' },
          { value: 'mana', label: 'Mana (Blue)' },
          { value: 'energy', label: 'Energy (Amber)' },
          { value: 'sanity', label: 'Sanity (Purple)' }
        ]
      }
    },
    async execute(scope) {
      const val = await scope.getInputValue('value');
      const current = val !== null && val !== undefined ? Number(val) : Number(scope.properties.value);
      scope.setVariable(scope.properties.variableName, current);
      scope.playerBridge.updateStatBar(scope.nodeId, current, Number(scope.properties.max || 100));
      await scope.trigger('trigger');
    }
  },

  'ui.inventory': {
    title: 'UI Inventory',
    category: 'ui',
    icon: '🎒',
    width: 270,
    inputs: {
      trigger: { label: 'Refresh', type: 'trigger' }
    },
    outputs: {
      onUse: { label: 'On Item Click', type: 'trigger' },
      item: { label: 'Clicked Item', type: 'string' }
    },
    properties: {
      title: { type: 'text', label: 'Panel Title', default: 'Inventory' },
      variableName: { type: 'text', label: 'Variable Name', default: 'inventory' }
    },
    async execute(scope) {
      await scope.trigger('onUse');
    }
  },

  'ui.choice_buttons': {
    title: 'UI Choice Buttons',
    category: 'ui',
    icon: '🔘',
    width: 280,
    inputs: {
      trigger: { label: 'Show Choices', type: 'trigger' },
      choices: { label: 'Choice Array', type: 'array' }
    },
    outputs: {
      onSelect: { label: 'On Selected', type: 'trigger' },
      selected: { label: 'Selected Choice', type: 'string' }
    },
    properties: {
      choice1: { type: 'text', label: 'Choice 1', default: 'Investigate the ruins' },
      choice2: { type: 'text', label: 'Choice 2', default: 'Camp and recover HP' },
      choice3: { type: 'text', label: 'Choice 3', default: 'Cast divination ritual' }
    },
    async execute(scope) {
      const inChoices = await scope.getInputValue('choices');
      const widget = scope.playerBridge.renderedWidgets.get(scope.nodeId);
      if (widget) {
        const choiceList = Array.isArray(inChoices) && inChoices.length > 0 ? inChoices : [
          scope.properties.choice1,
          scope.properties.choice2,
          scope.properties.choice3
        ].filter(Boolean);
        scope.playerBridge.renderChoiceButtons(widget, choiceList, scope.nodeId);
      }
    }
  },

  'ui.theme': {
    title: 'UI Theme Customizer',
    category: 'ui',
    icon: '🎨',
    width: 240,
    inputs: {
      trigger: { label: 'Apply', type: 'trigger' }
    },
    outputs: {},
    properties: {
      theme: {
        type: 'select',
        label: 'Color Theme',
        default: 'default',
        options: [
          { value: 'default', label: 'Cosy Slate Dark' },
          { value: 'cyberpunk', label: 'Cyberpunk Neon' },
          { value: 'parchment', label: 'Fantasy Parchment' },
          { value: 'minimal', label: 'Modern Minimal' }
        ]
      }
    },
    async execute(scope) {
      scope.playerBridge.applyTheme(scope.properties.theme);
    }
  },

  // ==========================================
  // CATEGORY 4: GAME LOGIC & STATE
  // ==========================================

  'game.dice': {
    title: 'Dice Roller',
    category: 'game',
    icon: '🎲',
    width: 260,
    inputs: {
      trigger: { label: 'Roll', type: 'trigger' },
      bonus: { label: 'Modifier Bonus', type: 'number', default: 0 }
    },
    outputs: {
      onRoll: { label: 'Done', type: 'trigger' },
      total: { label: 'Total', type: 'number' },
      rollText: { label: 'Result Text', type: 'string' }
    },
    properties: {
      notation: { type: 'text', label: 'Dice (e.g. 1d20+3, 2d6)', default: '1d20' }
    },
    async execute(scope) {
      const bonus = Number((await scope.getInputValue('bonus')) || 0);
      let not = scope.properties.notation || '1d20';
      if (bonus !== 0) not = `${not}${bonus > 0 ? '+' : ''}${bonus}`;

      const res = GameLogicEngine.rollDice(not);
      scope.setOutputValue('total', res.total);
      const txt = `Rolled ${res.notation}: [${res.rolls.join(', ')}] = ${res.total}${res.isCrit ? ' (CRITICAL!)' : ''}`;
      scope.setOutputValue('rollText', txt);
      await scope.trigger('onRoll');
    },
    async evaluate(scope) {
      const res = GameLogicEngine.rollDice(scope.properties.notation || '1d20');
      return { total: res.total, rollText: `Result: ${res.total}` };
    }
  },

  'game.variables': {
    title: 'Variable Store',
    category: 'game',
    icon: '💾',
    width: 260,
    inputs: {
      trigger: { label: 'Apply', type: 'trigger' },
      value: { label: 'New Value', type: 'any' }
    },
    outputs: {
      trigger: { label: 'Done', type: 'trigger' },
      value: { label: 'Stored Value', type: 'any' }
    },
    properties: {
      name: { type: 'text', label: 'Variable Name', default: 'hp' },
      operation: {
        type: 'select',
        label: 'Operation',
        default: 'set',
        options: [
          { value: 'set', label: 'Set (=)' },
          { value: 'add', label: 'Add (+)' },
          { value: 'subtract', label: 'Subtract (-)' },
          { value: 'get', label: 'Get Only' }
        ]
      },
      amount: { type: 'number', label: 'Value / Delta', default: 10 }
    },
    async execute(scope) {
      const varName = scope.properties.name || 'hp';
      let current = scope.getVariable(varName);
      if (current === undefined) current = 100;

      const inVal = await scope.getInputValue('value');
      const op = scope.properties.operation;
      let next = current;

      if (op === 'set') {
        next = inVal !== null && inVal !== undefined ? inVal : scope.properties.amount;
      } else if (op === 'add') {
        const delta = inVal !== null && inVal !== undefined ? Number(inVal) : Number(scope.properties.amount);
        next = Number(current) + delta;
      } else if (op === 'subtract') {
        const delta = inVal !== null && inVal !== undefined ? Number(inVal) : Number(scope.properties.amount);
        next = Number(current) - delta;
      }

      scope.setVariable(varName, next);
      scope.setOutputValue('value', next);
      await scope.trigger('trigger');
    },
    async evaluate(scope) {
      const varName = scope.properties.name || 'hp';
      return { value: scope.getVariable(varName) };
    }
  },

  'game.inventory_action': {
    title: 'Inventory Action',
    category: 'game',
    icon: '🗡️',
    width: 270,
    inputs: {
      trigger: { label: 'Execute', type: 'trigger' },
      item: { label: 'Item Name', type: 'string' }
    },
    outputs: {
      onDone: { label: 'Done', type: 'trigger' },
      hasItem: { label: 'Has Item', type: 'boolean' }
    },
    properties: {
      action: {
        type: 'select',
        label: 'Action',
        default: 'add',
        options: [
          { value: 'add', label: 'Add Item' },
          { value: 'remove', label: 'Remove Item' },
          { value: 'check', label: 'Check Has Item' }
        ]
      },
      itemDefault: { type: 'text', label: 'Default Item', default: 'Ancient Key' }
    },
    async execute(scope) {
      const invVar = 'inventory';
      let items = scope.getVariable(invVar) || ['Torch', 'Iron Sword'];
      const targetItem = (await scope.getInputValue('item')) || scope.properties.itemDefault;

      if (scope.properties.action === 'add') {
        items = [...items, targetItem];
        scope.setVariable(invVar, items);
        scope.setOutputValue('hasItem', true);
      } else if (scope.properties.action === 'remove') {
        items = items.filter(i => (typeof i === 'object' ? i.name : i) !== targetItem);
        scope.setVariable(invVar, items);
        scope.setOutputValue('hasItem', false);
      } else if (scope.properties.action === 'check') {
        const exists = items.some(i => (typeof i === 'object' ? i.name : i) === targetItem);
        scope.setOutputValue('hasItem', exists);
      }

      await scope.trigger('onDone');
    }
  },

  'game.turn_counter': {
    title: 'Turn Counter',
    category: 'game',
    icon: '🔄',
    width: 230,
    inputs: {
      trigger: { label: 'Next Turn', type: 'trigger' }
    },
    outputs: {
      trigger: { label: 'On Turn', type: 'trigger' },
      turn: { label: 'Turn Number', type: 'number' }
    },
    properties: {
      startTurn: { type: 'number', label: 'Initial Turn', default: 1 }
    },
    async execute(scope) {
      let t = scope.getVariable('game_turn');
      if (t === undefined) t = Number(scope.properties.startTurn || 1);
      else t = Number(t) + 1;
      scope.setVariable('game_turn', t);
      scope.setOutputValue('turn', t);
      await scope.trigger('trigger');
    }
  },

  // ==========================================
  // CATEGORY 5: UTILITIES
  // ==========================================

  'utils.math': {
    title: 'Math Expression',
    category: 'utils',
    icon: '➕',
    width: 250,
    inputs: {
      a: { label: 'A', type: 'number', default: 10 },
      b: { label: 'B', type: 'number', default: 5 }
    },
    outputs: {
      result: { label: 'Result', type: 'number' }
    },
    properties: {
      operation: {
        type: 'select',
        label: 'Operator',
        default: 'add',
        options: [
          { value: 'add', label: 'Add (A + B)' },
          { value: 'subtract', label: 'Subtract (A - B)' },
          { value: 'multiply', label: 'Multiply (A * B)' },
          { value: 'divide', label: 'Divide (A / B)' },
          { value: 'max', label: 'Max(A, B)' },
          { value: 'min', label: 'Min(A, B)' }
        ]
      }
    },
    async evaluate(scope) {
      const a = Number(await scope.getInputValue('a'));
      const b = Number(await scope.getInputValue('b'));
      let res = 0;
      switch (scope.properties.operation) {
        case 'add': res = a + b; break;
        case 'subtract': res = a - b; break;
        case 'multiply': res = a * b; break;
        case 'divide': res = b !== 0 ? a / b : 0; break;
        case 'max': res = Math.max(a, b); break;
        case 'min': res = Math.min(a, b); break;
      }
      return { result: res };
    }
  },

  'utils.string': {
    title: 'String Concat',
    category: 'utils',
    icon: '🔗',
    width: 250,
    inputs: {
      part1: { label: 'Part 1', type: 'string' },
      part2: { label: 'Part 2', type: 'string' }
    },
    outputs: {
      result: { label: 'Combined', type: 'string' }
    },
    properties: {
      separator: { type: 'text', label: 'Separator', default: ' ' }
    },
    async evaluate(scope) {
      const s1 = String((await scope.getInputValue('part1')) || '');
      const s2 = String((await scope.getInputValue('part2')) || '');
      const sep = scope.properties.separator || '';
      return { result: `${s1}${sep}${s2}` };
    }
  },

  'utils.debug': {
    title: 'Debug Inspector',
    category: 'utils',
    icon: '🐞',
    width: 260,
    inputs: {
      trigger: { label: 'Log', type: 'trigger' },
      data: { label: 'Inspect Data', type: 'any' }
    },
    outputs: {
      trigger: { label: 'Out', type: 'trigger' }
    },
    properties: {},
    async execute(scope) {
      const data = await scope.getInputValue('data');
      console.log(`[CosyUI Debug ${scope.nodeId}]:`, data);
      globalEvents.emit('toast', { 
        type: 'info', 
        message: `Debug (${scope.nodeId}): ${typeof data === 'object' ? JSON.stringify(data) : String(data)}` 
      });
      await scope.trigger('trigger');
    }
  }

};

/**
 * Node Registry Provider
 */
export class NodeRegistry {
  constructor() {
    this.definitions = new Map(Object.entries(NodeDefinitions));
  }

  get(type) {
    return this.definitions.get(type);
  }

  getAll() {
    return Array.from(this.definitions.entries()).map(([type, def]) => ({ type, ...def }));
  }

  getByCategory(category) {
    return this.getAll().filter(item => category === 'all' || item.category === category);
  }
}
