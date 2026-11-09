/**
 * CosyUI - Universal LLM Client & Mock Simulator
 * Supports OpenAI, Anthropic, OpenRouter, Ollama, and built-in offline game simulator.
 */
import { globalEvents } from '../utils/event-bus.js';

export class UniversalLLMClient {
  constructor() {
    this.settings = {
      defaultProvider: 'mock', // 'mock', 'openai', 'anthropic', 'openrouter', 'ollama'
      openAiKey: '',
      anthropicKey: '',
      openRouterKey: '',
      ollamaUrl: 'http://localhost:11434',
      mockFallback: true
    };
    this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('cosyui_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch {}
  }

  saveSettings() {
    try {
      localStorage.setItem('cosyui_settings', JSON.stringify(this.settings));
      globalEvents.emit('toast', { type: 'success', message: 'API Settings saved locally.' });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  /**
   * Universal Completion method with streaming callback
   * @param {Object} options
   * @param {string} options.prompt
   * @param {string} options.systemPrompt
   * @param {string} options.provider
   * @param {string} options.model
   * @param {number} options.temperature
   * @param {Function} options.onToken
   */
  async complete(options = {}) {
    const provider = options.provider || this.settings.defaultProvider || 'mock';
    const prompt = options.prompt || '';
    const systemPrompt = options.systemPrompt || 'You are a helpful AI assistant in a dynamic interactive application.';
    const temperature = options.temperature !== undefined ? options.temperature : 0.7;
    const onToken = options.onToken || (() => {});

    try {
      if (provider === 'mock') {
        return await this.simulateMockLLM(options);
      } else if (provider === 'openai') {
        return await this.callOpenAI({ ...options, prompt, systemPrompt, temperature, onToken });
      } else if (provider === 'anthropic') {
        return await this.callAnthropic({ ...options, prompt, systemPrompt, temperature, onToken });
      } else if (provider === 'openrouter') {
        return await this.callOpenRouter({ ...options, prompt, systemPrompt, temperature, onToken });
      } else if (provider === 'ollama') {
        return await this.callOllama({ ...options, prompt, systemPrompt, temperature, onToken });
      } else {
        return await this.simulateMockLLM(options);
      }
    } catch (err) {
      console.warn(`[LLMClient] Provider "${provider}" failed:`, err);
      if (this.settings.mockFallback && provider !== 'mock') {
        globalEvents.emit('toast', { 
          type: 'warning', 
          message: `${provider} failed (${err.message}). Using Offline Mock Simulator.` 
        });
        return await this.simulateMockLLM(options);
      }
      throw err;
    }
  }

  /**
   * Intelligent Offline Mock LLM Engine
   * Generates rich, context-aware responses with streaming token jitter.
   */
  async simulateMockLLM(options) {
    const prompt = (options.prompt || '').toLowerCase();
    const system = (options.systemPrompt || '').toLowerCase();
    const onToken = options.onToken || (() => {});

    let generatedText = '';

    // Check if prompt or system is for Fantasy RPG / Game
    if (system.includes('rpg') || system.includes('dungeon') || prompt.includes('attack') || prompt.includes('dice') || prompt.includes('roll')) {
      const diceMatch = prompt.match(/roll(?:ed)?\s*[:=]?\s*(\d+)/i) || prompt.match(/(\d+)/);
      const rollVal = diceMatch ? parseInt(diceMatch[1], 10) : 15;

      if (rollVal >= 18) {
        generatedText = `⚔️ **Critical Success (Roll: ${rollVal})!**\n\nYour blade strikes true, carving through the shadowy mist with brilliant force. The dungeon creature reels backwards, dropping an ancient jeweled key onto the stone floor.\n\n*The path to the deeper vaults now lies open before you.*`;
      } else if (rollVal >= 10) {
        generatedText = `🛡️ **Success (Roll: ${rollVal})!**\n\nYou parry the enemy's flanking swipe and find a solid opening, landing a decisive blow. Your tactical discipline keeps you safe, though more shadows stir in the torchlight ahead.\n\n*What will you do next?*`;
      } else {
        generatedText = `⚠️ **Complication (Roll: ${rollVal})!**\n\nYour foot slips upon the damp cobblestones! The strike glances harmlessly off the creature's armor, and a counterattack grazes your side for 4 damage.\n\n*You need to regroup quickly before you are surrounded.*`;
      }
    } else if (system.includes('debate') || prompt.includes('debate') || prompt.includes('thesis')) {
      generatedText = `Regarding this contentious debate:\n\n1. **The Core Dilemma**: Progress accelerates exponentially, yet our institutional wisdom expands linearly. If we prioritize raw velocity, we risk systemic externalities that cannot be undone.\n2. **The Counter-Argument**: Conversely, stagnation is itself an existential danger. The problems of tomorrow cannot be solved with the dormant methods of yesterday.\n\n*Synthesis*: Controlled experimentation with rigorous real-time telemetry is the only viable path forward.`;
    } else if (system.includes('support') || prompt.includes('help') || prompt.includes('issue')) {
      generatedText = `Hello! Thank you for reaching out to our support desk.\n\nI understand your concern and I am here to assist. Based on our policy, your request has been logged and our automated diagnostics have already flagged the ticket for prioritized resolution.\n\nPlease let me know if you would like me to process a replacement or provide real-time status updates!`;
    } else {
      // General creative text completion
      generatedText = `Greetings traveler! The CosyUI visual node engine processed your input successfully.\n\nYour prompt: "${options.prompt}"\n\nAll variables and downstream trigger nodes have been updated in real-time. You can chain further logic, dice checks, or UI updates directly on the canvas!`;
    }

    // Stream tokens with natural jitter
    const tokens = generatedText.split(/(\s+)/);
    let fullOutput = '';
    for (const token of tokens) {
      fullOutput += token;
      onToken(token, fullOutput);
      await new Promise(r => setTimeout(r, Math.random() * 20 + 8));
    }

    return fullOutput;
  }

  /**
   * OpenAI API Call
   */
  async callOpenAI(options) {
    const apiKey = options.apiKey || this.settings.openAiKey;
    if (!apiKey) throw new Error('OpenAI API Key is missing. Configure it in Settings.');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.prompt }
        ],
        temperature: options.temperature,
        stream: Boolean(options.onToken)
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI HTTP ${res.status}: ${errBody}`);
    }

    if (options.onToken) {
      return await this.consumeSSE(res, (data) => {
        return data.choices?.[0]?.delta?.content || '';
      }, options.onToken);
    } else {
      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    }
  }

  /**
   * Anthropic Messages API Call
   */
  async callAnthropic(options) {
    const apiKey = options.apiKey || this.settings.anthropicKey;
    if (!apiKey) throw new Error('Anthropic API Key is missing. Configure it in Settings.');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        system: options.systemPrompt,
        messages: [{ role: 'user', content: options.prompt }],
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature,
        stream: Boolean(options.onToken)
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic HTTP ${res.status}: ${errBody}`);
    }

    if (options.onToken) {
      return await this.consumeSSE(res, (data) => {
        if (data.type === 'content_block_delta') {
          return data.delta?.text || '';
        }
        return '';
      }, options.onToken);
    } else {
      const json = await res.json();
      return json.content?.[0]?.text || '';
    }
  }

  /**
   * OpenRouter API Call
   */
  async callOpenRouter(options) {
    const apiKey = options.apiKey || this.settings.openRouterKey;
    if (!apiKey) throw new Error('OpenRouter API Key is missing.');

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || 'meta-llama/llama-3.3-70b-instruct',
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.prompt }
        ],
        temperature: options.temperature,
        stream: Boolean(options.onToken)
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenRouter HTTP ${res.status}: ${errBody}`);
    }

    if (options.onToken) {
      return await this.consumeSSE(res, (data) => {
        return data.choices?.[0]?.delta?.content || '';
      }, options.onToken);
    } else {
      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    }
  }

  /**
   * Ollama Local Server Call
   */
  async callOllama(options) {
    const url = (options.url || this.settings.ollamaUrl || 'http://localhost:11434').replace(/\/+$/, '');
    const res = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'llama3.2',
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.prompt }
        ],
        stream: Boolean(options.onToken)
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}`);
    }

    if (options.onToken) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            const token = parsed.message?.content || '';
            fullText += token;
            options.onToken(token, fullText);
          } catch {}
        }
      }
      return fullText;
    } else {
      const json = await res.json();
      return json.message?.content || '';
    }
  }

  /**
   * Helper to parse Server-Sent Events (SSE)
   */
  async consumeSSE(response, tokenExtractor, onToken) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Retain incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') return accumulatedText;
          try {
            const data = JSON.parse(jsonStr);
            const token = tokenExtractor(data);
            if (token) {
              accumulatedText += token;
              onToken(token, accumulatedText);
            }
          } catch {}
        }
      }
    }
    return accumulatedText;
  }

  /**
   * Mustache-style prompt variable interpolator
   * Example: "Hello {{player.name}}, you have {{hp}} HP!"
   */
  renderTemplate(template, variables = {}) {
    if (!template) return '';
    return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
      const parts = path.split('.');
      let current = variables;
      for (const part of parts) {
        if (current === undefined || current === null) return '';
        current = current[part];
      }
      return current !== undefined && current !== null ? String(current) : '';
    });
  }

  /**
   * Resilient JSON extractor
   * Parses JSON even if wrapped in markdown code blocks or conversational text.
   */
  extractJSON(text) {
    if (!text) return null;
    let clean = text.trim();

    // Remove markdown code fences
    const fenceMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenceMatch) {
      clean = fenceMatch[1].trim();
    }

    try {
      return JSON.parse(clean);
    } catch {}

    // Find first '{' or '[' and last matching '}' or ']'
    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;

    if (start !== -1) {
      const isObject = clean[start] === '{';
      const end = isObject ? clean.lastIndexOf('}') : clean.lastIndexOf(']');
      if (end > start) {
        try {
          return JSON.parse(clean.substring(start, end + 1));
        } catch {}
      }
    }

    return null;
  }
}
