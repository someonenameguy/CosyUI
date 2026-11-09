/**
 * CosyUI - Game Logic & Workflow Mechanics Engine
 * Tabletop dice roller, reactive variable store, inventory manager, and state machine.
 */
import { globalEvents } from '../utils/event-bus.js';

export class GameLogicEngine {
  /**
   * Seedable Mulberry32 Pseudo-Random Number Generator
   */
  static mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Polyhedral RPG Dice Notation Parser & Roller
   * Supports: "1d20+5", "3d6-2", "2d20kh1" (advantage), "2d20kl1" (disadvantage), "1d100"
   */
  static rollDice(notation = '1d20', seed = null) {
    const rng = seed !== null ? this.mulberry32(seed) : Math.random;
    const clean = notation.replace(/\s+/g, '').toLowerCase();

    // Regex for: count d sides (kh1|kl1)? (+|- mod)?
    const regex = /^(\d+)?d(\d+)(?:(kh|kl)(\d+)?)?([+-]\d+)?$/;
    const match = clean.match(regex);

    if (!match) {
      // Fallback: parse single integer
      const simple = parseInt(clean, 10);
      return { total: isNaN(simple) ? 0 : simple, rolls: [], modifier: 0, notation };
    }

    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const keepType = match[3]; // 'kh' or 'kl'
    const keepCount = match[4] ? parseInt(match[4], 10) : 1;
    const modifier = match[5] ? parseInt(match[5], 10) : 0;

    const rolls = [];
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(rng() * sides) + 1;
      rolls.push(roll);
    }

    let keptRolls = [...rolls];
    if (keepType === 'kh') {
      keptRolls.sort((a, b) => b - a);
      keptRolls = keptRolls.slice(0, keepCount);
    } else if (keepType === 'kl') {
      keptRolls.sort((a, b) => a - b);
      keptRolls = keptRolls.slice(0, keepCount);
    }

    const sum = keptRolls.reduce((acc, r) => acc + r, 0);
    const total = sum + modifier;

    const isNat20 = sides === 20 && count === 1 && rolls[0] === 20;
    const isNat1 = sides === 20 && count === 1 && rolls[0] === 1;

    return {
      notation,
      total,
      rolls,
      keptRolls,
      modifier,
      isCrit: isNat20,
      isFumble: isNat1
    };
  }

  /**
   * Evaluate Conditional Branching
   */
  static evaluateCondition(left, operator, right) {
    const l = left;
    const r = right;

    switch (operator) {
      case '==':
      case 'equals':
        return String(l) === String(r);
      case '!=':
      case 'not_equals':
        return String(l) !== String(r);
      case '>':
        return Number(l) > Number(r);
      case '>=':
        return Number(l) >= Number(r);
      case '<':
        return Number(l) < Number(r);
      case '<=':
        return Number(l) <= Number(r);
      case 'contains':
        if (Array.isArray(l)) return l.includes(r);
        return String(l).toLowerCase().includes(String(r).toLowerCase());
      case 'not_contains':
        if (Array.isArray(l)) return !l.includes(r);
        return !String(l).toLowerCase().includes(String(r).toLowerCase());
      case 'starts_with':
        return String(l).toLowerCase().startsWith(String(r).toLowerCase());
      case 'ends_with':
        return String(l).toLowerCase().endsWith(String(r).toLowerCase());
      case 'is_empty':
        return l === null || l === undefined || l === '' || (Array.isArray(l) && l.length === 0);
      case 'is_not_empty':
        return l !== null && l !== undefined && l !== '' && (!Array.isArray(l) || l.length > 0);
      case 'regex_match':
        try {
          return new RegExp(String(r), 'i').test(String(l));
        } catch {
          return false;
        }
      default:
        return Boolean(l);
    }
  }

  /**
   * Sliding Window Conversation Memory Manager
   */
  static updateSlidingMemory(history, newRole, newContent, maxTurns = 10, systemPrompt = '') {
    const list = Array.isArray(history) ? [...history] : [];
    list.push({ role: newRole, content: newContent, timestamp: Date.now() });

    // Keep system prompt if present, plus last maxTurns entries
    const nonSystem = list.filter(m => m.role !== 'system');
    const trimmed = nonSystem.slice(-maxTurns);

    if (systemPrompt) {
      return [{ role: 'system', content: systemPrompt }, ...trimmed];
    }
    return trimmed;
  }
}
