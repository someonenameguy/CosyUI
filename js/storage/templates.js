/**
 * CosyUI - Starter Project Templates
 * Pre-configured interactive games and workflows with LLM integration and dynamic UI.
 */

export const ProjectTemplates = {

  // ==========================================
  // TEMPLATE 1: FANTASY RPG WITH DICE & INVENTORY
  // ==========================================
  template_rpg: {
    metadata: {
      title: 'Fantasy RPG with Dice & Inventory',
      description: 'Interactive dungeon crawl with tabletop D20 checks, dynamic health, inventory loot, and LLM GM narration.',
      created: new Date().toISOString()
    },
    variables: {
      hp: 85,
      gold: 40,
      inventory: ['Torch', 'Iron Shortsword', 'Health Potion']
    },
    nodes: [
      {
        id: 'node_start',
        type: 'core.start',
        title: 'Start Adventure',
        x: 60,
        y: 80,
        properties: { label: 'Game Start' }
      },
      {
        id: 'node_dice',
        type: 'game.dice',
        title: 'Attack Roll (D20)',
        x: 320,
        y: 80,
        properties: { notation: '1d20+3' }
      },
      {
        id: 'node_branch',
        type: 'core.branch',
        title: 'Check Success (DC 14)',
        x: 630,
        y: 80,
        properties: { operator: '>=', compareValue: '14' }
      },
      {
        id: 'node_llm_win',
        type: 'llm.mock',
        title: 'Victory Narration',
        x: 950,
        y: 20,
        properties: { persona: 'dungeon_master' }
      },
      {
        id: 'node_llm_fail',
        type: 'llm.mock',
        title: 'Defeat Narration',
        x: 950,
        y: 280,
        properties: { persona: 'dungeon_master' }
      },
      {
        id: 'node_ui_story',
        type: 'ui.story',
        title: 'UI Story Box',
        x: 1300,
        y: 80,
        properties: {
          title: 'The Catacombs of Azgarth',
          text: 'You kick open the ancient moss-covered tomb doors. A shadowed guardian lunges with glowing runes!'
        }
      },
      {
        id: 'node_ui_hp',
        type: 'ui.stat_bar',
        title: 'UI Health Bar',
        x: 60,
        y: 340,
        properties: {
          label: 'Hero Health (HP)',
          variableName: 'hp',
          value: 85,
          max: 100,
          style: 'hp'
        }
      },
      {
        id: 'node_ui_inv',
        type: 'ui.inventory',
        title: 'UI Inventory',
        x: 360,
        y: 340,
        properties: {
          title: 'Backpack Inventory',
          variableName: 'inventory'
        }
      },
      {
        id: 'node_ui_choices',
        type: 'ui.choice_buttons',
        title: 'UI Action Choices',
        x: 680,
        y: 340,
        properties: {
          choice1: 'Strike with Iron Shortsword (Roll Attack)',
          choice2: 'Drink Health Potion (+20 HP)',
          choice3: 'Cast Illuminating Ward'
        }
      },
      {
        id: 'node_ui_chat',
        type: 'ui.chatbox',
        title: 'UI Companion Chat',
        x: 1020,
        y: 450,
        properties: {
          title: 'Gwyn the Rogue Companion',
          welcomeMessage: 'Watch your step, friend. The stones in this tomb were placed to keep things in... not out.'
        }
      }
    ],
    connections: [
      { id: 'c1', fromNode: 'node_start', fromPort: 'trigger', toNode: 'node_dice', toPort: 'trigger' },
      { id: 'c2', fromNode: 'node_dice', fromPort: 'onRoll', toNode: 'node_branch', toPort: 'trigger' },
      { id: 'c3', fromNode: 'node_dice', fromPort: 'total', toNode: 'node_branch', toPort: 'left' },
      { id: 'c4', fromNode: 'node_branch', fromPort: 'onTrue', toNode: 'node_llm_win', toPort: 'trigger' },
      { id: 'c5', fromNode: 'node_branch', fromPort: 'onFalse', toNode: 'node_llm_fail', toPort: 'trigger' },
      { id: 'c6', fromNode: 'node_dice', fromPort: 'rollText', toNode: 'node_llm_win', toPort: 'context' },
      { id: 'c7', fromNode: 'node_dice', fromPort: 'rollText', toNode: 'node_llm_fail', toPort: 'context' },
      { id: 'c8', fromNode: 'node_llm_win', fromPort: 'trigger', toNode: 'node_ui_story', toPort: 'trigger' },
      { id: 'c9', fromNode: 'node_llm_win', fromPort: 'narrative', toNode: 'node_ui_story', toPort: 'text' },
      { id: 'c10', fromNode: 'node_llm_fail', fromPort: 'trigger', toNode: 'node_ui_story', toPort: 'trigger' },
      { id: 'c11', fromNode: 'node_llm_fail', fromPort: 'narrative', toNode: 'node_ui_story', toPort: 'text' }
    ]
  },

  // ==========================================
  // TEMPLATE 2: MULTI-AGENT AI DEBATE
  // ==========================================
  template_debate: {
    metadata: {
      title: 'Multi-Agent AI Debate Council',
      description: 'Two opposing AI personas argue an ethical thesis, synthesized by an AI Moderator.',
      created: new Date().toISOString()
    },
    variables: {
      topic: 'Should artificial intelligence develop consciousness?',
      round: 1
    },
    nodes: [
      {
        id: 'deb_start',
        type: 'core.start',
        title: 'Commence Debate',
        x: 60,
        y: 100,
        properties: { label: 'Start Round 1' }
      },
      {
        id: 'deb_agent1',
        type: 'llm.mock',
        title: 'Agent Alpha (Accelerationist)',
        x: 340,
        y: 50,
        properties: { persona: 'debate_moderator' }
      },
      {
        id: 'deb_agent2',
        type: 'llm.mock',
        title: 'Agent Beta (Humanist)',
        x: 680,
        y: 50,
        properties: { persona: 'debate_moderator' }
      },
      {
        id: 'deb_story',
        type: 'ui.story',
        title: 'UI Debate Stage',
        x: 1020,
        y: 100,
        properties: {
          title: 'The Great AI Consciousness Debate',
          text: 'The Council gathers. Today\'s Topic: Should artificial intelligence be granted moral status and autonomy?'
        }
      },
      {
        id: 'deb_chat',
        type: 'ui.chatbox',
        title: 'UI Audience Interventions',
        x: 340,
        y: 350,
        properties: {
          title: 'Audience Mic',
          welcomeMessage: 'Pose a rebuttal or challenge to the debaters!'
        }
      }
    ],
    connections: [
      { id: 'dc1', fromNode: 'deb_start', fromPort: 'trigger', toNode: 'deb_agent1', toPort: 'trigger' },
      { id: 'dc2', fromNode: 'deb_agent1', fromPort: 'trigger', toNode: 'deb_agent2', toPort: 'trigger' },
      { id: 'dc3', fromNode: 'deb_agent2', fromPort: 'trigger', toNode: 'deb_story', toPort: 'trigger' },
      { id: 'dc4', fromNode: 'deb_agent2', fromPort: 'narrative', toNode: 'deb_story', toPort: 'text' }
    ]
  },

  // ==========================================
  // TEMPLATE 3: CUSTOMER SUPPORT WITH GUARDRAILS
  // ==========================================
  template_support: {
    metadata: {
      title: 'Customer Support with Guardrails',
      description: 'Intelligent support bot with sentiment detection, knowledge injection, and safe response handling.',
      created: new Date().toISOString()
    },
    variables: {
      satisfaction: 90
    },
    nodes: [
      {
        id: 'sup_chat',
        type: 'ui.chatbox',
        title: 'UI Customer Chat',
        x: 80,
        y: 120,
        properties: {
          title: 'Acme Support Helpdesk',
          welcomeMessage: 'Hello! How can our automated support desk assist you today?'
        }
      },
      {
        id: 'sup_filter',
        type: 'core.switch',
        title: 'Sentiment & Issue Filter',
        x: 420,
        y: 120,
        properties: { pattern1: 'refund', pattern2: 'broken' }
      },
      {
        id: 'sup_llm',
        type: 'llm.mock',
        title: 'Support AI Specialist',
        x: 750,
        y: 120,
        properties: { persona: 'customer_agent' }
      },
      {
        id: 'sup_satisfaction',
        type: 'ui.stat_bar',
        title: 'Customer Satisfaction',
        x: 80,
        y: 400,
        properties: {
          label: 'Customer Satisfaction Score',
          variableName: 'satisfaction',
          value: 90,
          max: 100,
          style: 'energy'
        }
      }
    ],
    connections: [
      { id: 'sc1', fromNode: 'sup_chat', fromPort: 'onMessage', toNode: 'sup_filter', toPort: 'trigger' },
      { id: 'sc2', fromNode: 'sup_chat', fromPort: 'message', toNode: 'sup_filter', toPort: 'input' },
      { id: 'sc3', fromNode: 'sup_filter', fromPort: 'default', toNode: 'sup_llm', toPort: 'trigger' },
      { id: 'sc4', fromNode: 'sup_chat', fromPort: 'message', toNode: 'sup_llm', toPort: 'context' },
      { id: 'sc5', fromNode: 'sup_llm', fromPort: 'trigger', toNode: 'sup_chat', toPort: 'trigger' },
      { id: 'sc6', fromNode: 'sup_llm', fromPort: 'narrative', toNode: 'sup_chat', toPort: 'botMessage' }
    ]
  },

  // ==========================================
  // TEMPLATE 4: SCI-FI INTERACTIVE STORY
  // ==========================================
  template_story: {
    metadata: {
      title: 'The Derelict Signal (Sci-Fi Story)',
      description: 'Atmospheric sci-fi mystery with dynamic story progression, choice buttons, and Cyberpunk theme.',
      created: new Date().toISOString()
    },
    variables: {
      sanity: 100,
      oxygen: 92
    },
    nodes: [
      {
        id: 'st_theme',
        type: 'ui.theme',
        title: 'Cyberpunk Theme',
        x: 60,
        y: 50,
        properties: { theme: 'cyberpunk' }
      },
      {
        id: 'st_story',
        type: 'ui.story',
        title: 'UI Terminal Screen',
        x: 360,
        y: 50,
        properties: {
          title: 'DECK 04 - USS HYPERION',
          text: 'Emergency lights bathe the bulkhead in blood-red pulses. The deep space signal repeats every 14.8 seconds: "THEY ARE AWAKE".'
        }
      },
      {
        id: 'st_choices',
        type: 'ui.choice_buttons',
        title: 'UI Tactical Choices',
        x: 720,
        y: 50,
        properties: {
          choice1: 'Override the airlock seal with manual hydraulics',
          choice2: 'Interface terminal with ship AI mainframe',
          choice3: 'Prime personal sidearm and scan corridors'
        }
      },
      {
        id: 'st_oxy',
        type: 'ui.stat_bar',
        title: 'UI Oxygen Level',
        x: 60,
        y: 300,
        properties: {
          label: 'Suit Oxygen Reserve',
          variableName: 'oxygen',
          value: 92,
          max: 100,
          style: 'mana'
        }
      },
      {
        id: 'st_sanity',
        type: 'ui.stat_bar',
        title: 'UI Crew Sanity',
        x: 360,
        y: 300,
        properties: {
          label: 'Neural Stability',
          variableName: 'sanity',
          value: 100,
          max: 100,
          style: 'sanity'
        }
      }
    ],
    connections: []
  }

};
