/**
 * CosyUI - Headless Automated Test Suite
 * Executes in Node.js without any npm dependencies.
 */
import { CosyTestRunner } from './test-framework.js';
import { MathUtils } from '../js/utils/math.js';
import { Sanitizer } from '../js/utils/sanitizer.js';
import { GraphModel } from '../js/engine/graph-model.js';
import { GameLogicEngine } from '../js/engine/game-logic.js';
import { UniversalLLMClient } from '../js/engine/llm-client.js';
import { NodeRegistry } from '../js/nodes/node-definitions.js';
import { ProjectTemplates } from '../js/storage/templates.js';

const runner = new CosyTestRunner();

// ----------------------------------------------------
// SUITE 1: Math & Geometry Calculations
// ----------------------------------------------------
runner.describe('Math & Geometry Engine', () => {
  runner.it('transforms screen coordinates to world coordinates correctly', () => {
    const world = MathUtils.screenToWorld(200, 300, 50, 100, 1.5);
    runner.assertApprox(world.x, 100);
    runner.assertApprox(world.y, 133.333, 0.01);
  });

  runner.it('transforms world coordinates to screen coordinates correctly', () => {
    const screen = MathUtils.worldToScreen(100, 133.333, 50, 100, 1.5);
    runner.assertApprox(screen.x, 200);
    runner.assertApprox(screen.y, 300, 0.01);
  });

  runner.it('clamps values within bounds', () => {
    runner.assertEqual(MathUtils.clamp(15, 0, 10), 10);
    runner.assertEqual(MathUtils.clamp(-5, 0, 10), 0);
    runner.assertEqual(MathUtils.clamp(7, 0, 10), 7);
  });

  runner.it('calculates cubic Bézier curves and hit tests them accurately', () => {
    const bezier = MathUtils.calculateCubicBezier(0, 0, 200, 100);
    runner.assertTrue(bezier.path.startsWith('M 0 0 C'));
    // Point directly on curve endpoint
    runner.assertTrue(MathUtils.hitTestBezier(0, 0, 0, 0, 200, 100, 5));
    runner.assertTrue(MathUtils.hitTestBezier(200, 100, 0, 0, 200, 100, 5));
    // Point far away
    runner.assertFalse(MathUtils.hitTestBezier(500, 500, 0, 0, 200, 100, 5));
  });

  runner.it('calculates bounding box (AABB) for nodes', () => {
    const nodes = [
      { x: 100, y: 100, width: 200, height: 150 },
      { x: 400, y: 300, width: 200, height: 150 }
    ];
    const aabb = MathUtils.calculateAABB(nodes, 20);
    runner.assertEqual(aabb.minX, 80);
    runner.assertEqual(aabb.minY, 80);
    runner.assertEqual(aabb.maxX, 620);
    runner.assertEqual(aabb.maxY, 470);
  });
});

// ----------------------------------------------------
// SUITE 2: Sanitizer, Type Checking & Cycle Detection
// ----------------------------------------------------
runner.describe('Sanitizer, Type Compatibility & Security', () => {
  runner.it('validates port connection compatibility', () => {
    const triggerOut = { direction: 'output', type: 'trigger' };
    const triggerIn = { direction: 'input', type: 'trigger' };
    const stringIn = { direction: 'input', type: 'string' };
    const numberOut = { direction: 'output', type: 'number' };
    const anyIn = { direction: 'input', type: 'any' };

    // Trigger connects strictly to trigger
    runner.assertTrue(Sanitizer.canConnectPorts(triggerOut, triggerIn));
    runner.assertFalse(Sanitizer.canConnectPorts(triggerOut, stringIn));

    // Data coercions
    runner.assertTrue(Sanitizer.canConnectPorts(numberOut, stringIn)); // number coerces to string
    runner.assertTrue(Sanitizer.canConnectPorts(numberOut, anyIn)); // number to any
  });

  runner.it('coerces data types safely', () => {
    runner.assertEqual(Sanitizer.coerceValue(123, 'string'), '123');
    runner.assertEqual(Sanitizer.coerceValue('456', 'number'), 456);
    runner.assertEqual(Sanitizer.coerceValue('invalid', 'number'), 0);
    runner.assertEqual(Sanitizer.coerceValue(1, 'boolean'), true);
    runner.assertEqual(Sanitizer.coerceValue(0, 'boolean'), false);
    runner.assertDeepEqual(Sanitizer.coerceValue('foo', 'array'), ['foo']);
  });

  runner.it('scrubs sensitive API keys from project exports', () => {
    const dirty = {
      apiKey: 'sk-global-secret',
      metadata: { title: 'Secret Project' },
      nodes: [
        {
          id: 'n1',
          type: 'llm.universal',
          properties: {
            apiKey: 'sk-node-secret',
            openAiKey: 'sk-proj-secret',
            model: 'gpt-4o'
          }
        }
      ]
    };
    const clean = Sanitizer.scrubSensitiveKeys(dirty);
    runner.assertEqual(clean.apiKey, undefined);
    runner.assertEqual(clean.nodes[0].properties.apiKey, undefined);
    runner.assertEqual(clean.nodes[0].properties.openAiKey, undefined);
    runner.assertEqual(clean.nodes[0].properties.model, 'gpt-4o');
  });

  runner.it('detects circular graph dependencies', () => {
    const graph = {
      nodes: new Map([
        ['n1', { id: 'n1' }],
        ['n2', { id: 'n2' }],
        ['n3', { id: 'n3' }]
      ]),
      connections: new Map([
        ['c1', { fromNode: 'n1', fromPort: 'out', toNode: 'n2', toPort: 'in' }],
        ['c2', { fromNode: 'n2', fromPort: 'out', toNode: 'n3', toPort: 'in' }],
        ['c3', { fromNode: 'n3', fromPort: 'out', toNode: 'n1', toPort: 'in' }]
      ]),
      getPort: (nodeId, port) => ({ type: 'string' })
    };
    runner.assertTrue(Sanitizer.hasCycle(graph));
  });
});

// ----------------------------------------------------
// SUITE 3: Graph Model & Undo/Redo
// ----------------------------------------------------
runner.describe('Graph Data Model & Persistence', () => {
  const registry = new NodeRegistry();

  runner.it('adds nodes and creates ports accurately', () => {
    const model = new GraphModel();
    const diceDef = registry.get('game.dice');
    const node = model.addNode('game.dice', diceDef, 100, 200);

    runner.assertEqual(node.type, 'game.dice');
    runner.assertEqual(node.x, 100);
    runner.assertEqual(node.y, 200);
    runner.assertTrue(node.inputs.has('trigger'));
    runner.assertTrue(node.outputs.has('total'));
  });

  runner.it('creates valid connections and prevents duplicate wires', () => {
    const model = new GraphModel();
    const startNode = model.addNode('core.start', registry.get('core.start'), 0, 0);
    const diceNode = model.addNode('game.dice', registry.get('game.dice'), 200, 0);

    const conn = model.connect(startNode.id, 'trigger', diceNode.id, 'trigger');
    runner.assertTrue(Boolean(conn));
    runner.assertEqual(model.connections.size, 1);

    // Duplicate connect returns existing connection
    const dup = model.connect(startNode.id, 'trigger', diceNode.id, 'trigger');
    runner.assertEqual(dup.id, conn.id);
    runner.assertEqual(model.connections.size, 1);
  });

  runner.it('removes nodes and cascades connection deletions cleanly', () => {
    const model = new GraphModel();
    const start = model.addNode('core.start', registry.get('core.start'));
    const dice = model.addNode('game.dice', registry.get('game.dice'));
    model.connect(start.id, 'trigger', dice.id, 'trigger');

    runner.assertEqual(model.connections.size, 1);
    model.removeNode(start.id);
    runner.assertEqual(model.nodes.size, 1);
    runner.assertEqual(model.connections.size, 0); // Connection pruned!
  });

  runner.it('serializes and deserializes lossless project JSON', () => {
    const model = new GraphModel();
    model.metadata.title = 'Test Dungeon Quest';
    model.variables.hp = 95;
    const n1 = model.addNode('core.start', registry.get('core.start'), 50, 80);
    const n2 = model.addNode('game.dice', registry.get('game.dice'), 250, 80);
    model.connect(n1.id, 'trigger', n2.id, 'trigger');

    const json = model.serialize();
    runner.assertEqual(json.metadata.title, 'Test Dungeon Quest');
    runner.assertEqual(json.variables.hp, 95);
    runner.assertEqual(json.nodes.length, 2);
    runner.assertEqual(json.connections.length, 1);

    const newModel = new GraphModel();
    newModel.deserialize(json, registry);
    runner.assertEqual(newModel.metadata.title, 'Test Dungeon Quest');
    runner.assertEqual(newModel.variables.hp, 95);
    runner.assertEqual(newModel.nodes.size, 2);
    runner.assertEqual(newModel.connections.size, 1);
  });

  runner.it('supports undo and redo operations', () => {
    const model = new GraphModel();
    model.addNode('core.start', registry.get('core.start'), 0, 0);
    runner.assertEqual(model.nodes.size, 1);

    model.addNode('game.dice', registry.get('game.dice'), 200, 0);
    runner.assertEqual(model.nodes.size, 2);

    // Undo second add
    const undoSuccess = model.undo(registry);
    runner.assertTrue(undoSuccess);
    runner.assertEqual(model.nodes.size, 1);

    // Redo second add
    const redoSuccess = model.redo(registry);
    runner.assertTrue(redoSuccess);
    runner.assertEqual(model.nodes.size, 2);
  });
});

// ----------------------------------------------------
// SUITE 4: Game Logic & Tabletop Mechanics
// ----------------------------------------------------
runner.describe('Game Logic Engine & RPG Dice', () => {
  runner.it('parses and rolls standard RPG polyhedral dice (1d20+5, 3d6)', () => {
    const rollD20 = GameLogicEngine.rollDice('1d20+5', 42); // Seeded
    runner.assertTrue(rollD20.total >= 6 && rollD20.total <= 25);
    runner.assertEqual(rollD20.modifier, 5);

    const roll3D6 = GameLogicEngine.rollDice('3d6', 100);
    runner.assertTrue(roll3D6.total >= 3 && roll3D6.total <= 18);
    runner.assertEqual(roll3D6.rolls.length, 3);
  });

  runner.it('handles advantage (2d20kh1) and disadvantage (2d20kl1)', () => {
    const adv = GameLogicEngine.rollDice('2d20kh1', 77);
    runner.assertEqual(adv.rolls.length, 2);
    runner.assertEqual(adv.total, Math.max(...adv.rolls));

    const dis = GameLogicEngine.rollDice('2d20kl1', 88);
    runner.assertEqual(dis.rolls.length, 2);
    runner.assertEqual(dis.total, Math.min(...dis.rolls));
  });

  runner.it('evaluates comparison conditions across all operators', () => {
    runner.assertTrue(GameLogicEngine.evaluateCondition(20, '>=', 15));
    runner.assertFalse(GameLogicEngine.evaluateCondition(10, '>=', 15));
    runner.assertTrue(GameLogicEngine.evaluateCondition('Iron Sword', 'contains', 'sword'));
    runner.assertTrue(GameLogicEngine.evaluateCondition(['Torch', 'Potion'], 'contains', 'Torch'));
    runner.assertTrue(GameLogicEngine.evaluateCondition('user_action_123', 'regex_match', '^user_'));
    runner.assertTrue(GameLogicEngine.evaluateCondition('', 'is_empty'));
    runner.assertTrue(GameLogicEngine.evaluateCondition('filled', 'is_not_empty'));
  });

  runner.it('manages sliding window conversation memory', () => {
    let memory = [];
    memory = GameLogicEngine.updateSlidingMemory(memory, 'user', 'Hello GM', 3, 'System Rule');
    memory = GameLogicEngine.updateSlidingMemory(memory, 'assistant', 'Greetings Hero', 3, 'System Rule');
    memory = GameLogicEngine.updateSlidingMemory(memory, 'user', 'I open the door', 3, 'System Rule');
    memory = GameLogicEngine.updateSlidingMemory(memory, 'assistant', 'The door creaks', 3, 'System Rule');

    runner.assertEqual(memory[0].role, 'system');
    runner.assertEqual(memory[0].content, 'System Rule');
    // System + last 3 non-system messages
    runner.assertEqual(memory.length, 4);
    runner.assertEqual(memory[memory.length - 1].content, 'The door creaks');
  });
});

// ----------------------------------------------------
// SUITE 5: Universal LLM Client, Templating & Parsers
// ----------------------------------------------------
runner.describe('Universal LLM Client & Template Engine', () => {
  const client = new UniversalLLMClient();

  runner.it('interpolates mustache templates with nested dot notation', () => {
    const template = 'Greetings {{player.name}}! You possess {{gold}} gold and {{hp}} HP.';
    const vars = {
      player: { name: 'Valerius the Brave' },
      gold: 150,
      hp: 100
    };
    const rendered = client.renderTemplate(template, vars);
    runner.assertEqual(rendered, 'Greetings Valerius the Brave! You possess 150 gold and 100 HP.');
  });

  runner.it('resiliently extracts JSON from markdown fences and raw text', () => {
    const markdown = 'Here is the loot table:\n```json\n{"item": "Obsidian Blade", "damage": 22}\n```\nEnjoy!';
    const extracted = client.extractJSON(markdown);
    runner.assertTrue(Boolean(extracted));
    runner.assertEqual(extracted.item, 'Obsidian Blade');
    runner.assertEqual(extracted.damage, 22);

    const rawArray = 'Generated options: ["Fight", "Flee", "Negotiate"]';
    const arrayExtracted = client.extractJSON(rawArray);
    runner.assertDeepEqual(arrayExtracted, ['Fight', 'Flee', 'Negotiate']);
  });

  runner.it('executes the offline Mock LLM simulator with streaming tokens', async () => {
    let streamedTokens = '';
    const result = await client.simulateMockLLM({
      prompt: 'Rolled 19 attack roll on the stone golem',
      systemPrompt: 'dungeon_master',
      onToken: (tok) => { streamedTokens += tok; }
    });

    runner.assertTrue(result.length > 20);
    runner.assertTrue(result.includes('Critical Success') || result.includes('Roll'));
    runner.assertEqual(streamedTokens, result);
  });
});

// ----------------------------------------------------
// SUITE 6: Starter Templates Integrity
// ----------------------------------------------------
runner.describe('Starter Templates Integrity', () => {
  const registry = new NodeRegistry();

  runner.it('verifies all 4 starter templates deserialize without errors', () => {
    const templateKeys = ['template_rpg', 'template_debate', 'template_support', 'template_story'];
    for (const key of templateKeys) {
      const template = ProjectTemplates[key];
      runner.assertTrue(Boolean(template), `Template ${key} exists`);
      runner.assertTrue(Array.isArray(template.nodes), `${key} has nodes array`);
      
      const testModel = new GraphModel();
      testModel.deserialize(template, registry);
      runner.assertTrue(testModel.nodes.size > 0, `${key} instantiated nodes`);
    }
  });
});

// Run all test suites
runner.runAll().then((results) => {
  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
});
