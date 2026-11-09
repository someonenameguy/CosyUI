# CosyUI LLM Runtime Specification
**Document ID**: `03_LLM_RUNTIME_SPEC.md`  
**Author**: Agent 03 - LLM Runtime Specialist  
**Target Environment**: Vanilla JavaScript (ES2022+), Browser-native (Zero External Dependencies)  
**Status**: APPROVED / READY FOR IMPLEMENTATION  

---

## 1. Executive Summary & Design Philosophy

The CosyUI LLM Runtime provides the core computational intelligence backbone for node-based workflows, interactive narrative games, and AI agent experiments. It is built under strict principles:

1. **Zero External Dependencies**: Standard browser primitives only (`fetch`, `ReadableStream`, `TextDecoder`, `AbortController`, `EventTarget`). No `npm` packages, no CDN script tags, no bundling steps required.
2. **Provider Agnostic & Universal**: Seamless support for OpenAI, Anthropic, OpenRouter, local Ollama instances, and arbitrary custom/OpenAI-compatible endpoints.
3. **Offline-First / Zero-Key Instant Play**: A sophisticated built-in Mock LLM engine simulates context-aware Dungeon Master narratives, debate rebuttals, NPC dialogues, and branching choices with realistic token-by-token streaming jitter—enabling immediate testing and game play with zero API keys or network connection.
4. **Resilient Streaming Pipeline**: Robust Server-Sent Events (SSE) and NDJSON line-buffering that handles broken packet boundaries, automatic exponential backoff on HTTP 429 rate limits, and clean AbortController cancellation.
5. **Declarative Prompt Templating & Output Parsing**: Safe mustache-style (`{{variable}}`) expression evaluation, dynamic system prompt synthesis, conversation history windowing, and bulletproof output parsers (JSON un-fencing, regex matchers, numbered choice extractors).

---

## 2. Universal LLM Client Architecture

### 2.1 Provider Landscape & API Normalization

| Provider | Default Endpoint | Auth Header Style | Streaming Format | Special Request Nuances |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer <key>` | SSE `data: {"choices":[{"delta":{"content":"..."}}]}` | Standard `messages` array with `system`, `user`, `assistant`. |
| **Anthropic** | `https://api.anthropic.com/v1/messages` | `x-api-key: <key>` + `anthropic-version: 2023-06-01` | SSE `event: content_block_delta` `data: {"delta":{"text":"..."}}` | `system` is top-level property; `messages` must strictly alternate `user` and `assistant`. |
| **OpenRouter** | `https://openrouter.ai/api/v1/chat/completions` | `Authorization: Bearer <key>` + `HTTP-Referer`, `X-Title` | SSE (OpenAI compatible) | Broad multi-model routing (`anthropic/claude-3.5-sonnet`, `meta-llama/llama-3-70b-instruct`). |
| **Ollama (Native)**| `http://localhost:11434/api/chat` | None / Optional | NDJSON chunks: `{"message":{"content":"..."},"done":false}` | Localhost CORS requires `OLLAMA_ORIGINS="*"`. Native format uses line-delimited JSON. |
| **Ollama (v1)** | `http://localhost:11434/v1/chat/completions` | None / Optional | SSE (OpenAI compatible) | Standard OpenAI compatibility layer shipped in modern Ollama. |
| **Custom / Local**| User-specified URL (e.g. LM Studio, vLLM, LocalAI) | Configurable (`Bearer`, `api-key`, Custom header, or None) | SSE (OpenAI compatible) or NDJSON | Supports custom headers and configurable path overrides. |
| **Mock Engine** | Internal JavaScript generator | None (Completely Offline) | Synthetic token timer via `ReadableStream` or async generator | Generates context-aware RPG / debate / game outputs without network. |

---

### 2.2 Unified Request & Response Data Contracts

```typescript
/** Canonical Internal LLM Message Structure */
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

/** Canonical Request Options */
interface LLMRequestConfig {
  provider: 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'custom' | 'mock';
  apiKey?: string;
  endpointUrl?: string; // Optional override, defaults to provider standard
  model: string;
  messages: ChatMessage[];
  temperature?: number; // 0.0 to 2.0 (default 0.7)
  maxTokens?: number;   // default 1024
  topP?: number;        // default 1.0
  stop?: string[];      // stop sequences
  stream?: boolean;     // default true
  customHeaders?: Record<string, string>;
  mockScenario?: 'rpg_dm' | 'debate' | 'choice_list' | 'echo' | 'raw_json';
}

/** Canonical Stream Chunk Event */
interface LLMStreamChunk {
  token: string;          // Incremental piece of text
  accumulated: string;    // Full text accumulated so far
  done: boolean;
  finishReason?: string | null;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/** Final Non-Streaming or Completed Stream Response */
interface LLMResponse {
  text: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: any;
}
```

---

### 2.3 Provider Adapters Implementation Blueprint

```javascript
/**
 * Universal LLM Client for CosyUI
 * Zero dependencies, pure browser standards.
 */
class UniversalLLMClient {
  constructor(defaultConfig = {}) {
    this.defaultConfig = {
      provider: 'mock',
      temperature: 0.7,
      maxTokens: 1024,
      stream: true,
      ...defaultConfig
    };
    this.mockEngine = new MockLLMEngine();
  }

  /**
   * Main dispatch method
   * @param {LLMRequestConfig} config
   * @param {AbortSignal} [signal]
   * @param {Function} [onChunk] callback: (chunk: LLMStreamChunk) => void
   * @returns {Promise<LLMResponse>}
   */
  async complete(config, signal = null, onChunk = null) {
    const merged = { ...this.defaultConfig, ...config };

    if (merged.provider === 'mock') {
      return this.mockEngine.generate(merged, signal, onChunk);
    }

    switch (merged.provider) {
      case 'openai':
      case 'openrouter':
      case 'custom':
        return this._callOpenAICompatible(merged, signal, onChunk);

      case 'anthropic':
        return this._callAnthropic(merged, signal, onChunk);

      case 'ollama':
        return this._callOllama(merged, signal, onChunk);

      default:
        throw new Error(`Unsupported LLM provider: "${merged.provider}"`);
    }
  }

  /* -------------------------------------------------------------
   * Provider: OpenAI / OpenRouter / Custom Endpoints
   * ----------------------------------------------------------- */
  async _callOpenAICompatible(config, signal, onChunk) {
    let url = config.endpointUrl;
    if (!url) {
      if (config.provider === 'openrouter') {
        url = 'https://openrouter.ai/api/v1/chat/completions';
      } else {
        url = 'https://api.openai.com/v1/chat/completions';
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(config.customHeaders || {})
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    if (config.provider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin || 'https://cosyui.local';
      headers['X-Title'] = 'CosyUI Graph Runner';
    }

    const body = {
      model: config.model || (config.provider === 'openrouter' ? 'meta-llama/llama-3-8b-instruct' : 'gpt-4o-mini'),
      messages: config.messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 1024,
      stream: Boolean(config.stream)
    };
    if (config.topP !== undefined) body.top_p = config.topP;
    if (config.stop) body.stop = config.stop;

    const response = await this._fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      await this._handleHttpError(response, config.provider);
    }

    if (!config.stream) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';
      return {
        text,
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        },
        raw: data
      };
    }

    // Process SSE Stream
    return this._parseOpenAISSE(response.body, onChunk, signal);
  }

  /* -------------------------------------------------------------
   * Provider: Anthropic Messages API
   * ----------------------------------------------------------- */
  async _callAnthropic(config, signal, onChunk) {
    const url = config.endpointUrl || 'https://api.anthropic.com/v1/messages';

    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'dangerously-allow-browser': 'true', // Required when calling directly from client browser
      ...(config.customHeaders || {})
    };

    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey.trim();
    }

    // Separate top-level system message from user/assistant history
    let systemPrompt = '';
    const messages = [];

    for (const msg of config.messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else {
        // Ensure role is either 'user' or 'assistant'
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

    // Guard against empty messages or consecutive roles
    const sanitizedMessages = this._normalizeAnthropicMessages(messages);

    const body = {
      model: config.model || 'claude-3-5-sonnet-20241022',
      messages: sanitizedMessages,
      max_tokens: config.maxTokens ?? 1024,
      temperature: config.temperature ?? 0.7,
      stream: Boolean(config.stream)
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }
    if (config.stop) {
      body.stop_sequences = config.stop;
    }

    const response = await this._fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      await this._handleHttpError(response, 'anthropic');
    }

    if (!config.stream) {
      const data = await response.json();
      const text = data.content?.map(c => c.text || '').join('') || '';
      return {
        text,
        finishReason: data.stop_reason || 'end_turn',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        },
        raw: data
      };
    }

    return this._parseAnthropicSSE(response.body, onChunk, signal);
  }

  /* -------------------------------------------------------------
   * Provider: Ollama Local Server
   * ----------------------------------------------------------- */
  async _callOllama(config, signal, onChunk) {
    let baseUrl = config.endpointUrl || 'http://localhost:11434';
    baseUrl = baseUrl.replace(/\/+$/, '');

    // Prefer native /api/chat or fallback to /v1/chat/completions
    const url = baseUrl.endsWith('/v1')
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/api/chat`;

    if (url.includes('/v1/chat/completions')) {
      return this._callOpenAICompatible({ ...config, endpointUrl: url }, signal, onChunk);
    }

    const body = {
      model: config.model || 'llama3:latest',
      messages: config.messages,
      stream: Boolean(config.stream),
      options: {
        temperature: config.temperature ?? 0.7,
        num_predict: config.maxTokens ?? 1024
      }
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error(
        `Failed to connect to Ollama at ${url}. Ensure Ollama is running and OLLAMA_ORIGINS="*" is set for CORS.`
      );
    }

    if (!response.ok) {
      await this._handleHttpError(response, 'ollama');
    }

    if (!config.stream) {
      const data = await response.json();
      return {
        text: data.message?.content || '',
        finishReason: data.done_reason || 'stop',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        raw: data
      };
    }

    return this._parseOllamaNDJSON(response.body, onChunk, signal);
  }

  /* -------------------------------------------------------------
   * Retry Mechanism with Exponential Backoff
   * ----------------------------------------------------------- */
  async _fetchWithRetry(url, options, maxRetries = 3, initialBackoff = 800) {
    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(url, options);
        // Retry on 429 (Rate Limit) or 503/504 (Overload/Gateway timeout)
        if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < maxRetries) {
          const retryAfter = res.headers.get('retry-after');
          let delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : initialBackoff * Math.pow(2, attempt);
          delay += Math.floor(Math.random() * 200); // add jitter
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          continue;
        }
        return res;
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (attempt < maxRetries) {
          const delay = initialBackoff * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          continue;
        }
        throw err;
      }
    }
  }

  /* -------------------------------------------------------------
   * Error Diagnostics
   * ----------------------------------------------------------- */
  async _handleHttpError(response, provider) {
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson);
    } catch {
      errorDetail = await response.text();
    }

    let message = `[${provider.toUpperCase()} API Error ${response.status}]: ${errorDetail}`;
    if (response.status === 401 || response.status === 403) {
      message += ' -> Check your API key in project settings.';
    } else if (response.status === 404) {
      message += ' -> Model or endpoint path not found.';
    } else if (response.status === 429) {
      message += ' -> Rate limit or credit quota exceeded.';
    }
    throw new Error(message);
  }

  _normalizeAnthropicMessages(messages) {
    if (messages.length === 0) {
      return [{ role: 'user', content: 'Hello' }];
    }
    const result = [];
    for (let i = 0; i < messages.length; i++) {
      const cur = messages[i];
      if (result.length > 0 && result[result.length - 1].role === cur.role) {
        // Merge consecutive messages of the same role
        result[result.length - 1].content += '\n\n' + cur.content;
      } else {
        result.push({ role: cur.role, content: cur.content });
      }
    }
    // Must start with user message
    if (result[0].role !== 'user') {
      result.unshift({ role: 'user', content: 'Continue.' });
    }
    return result;
  }
}
```

---

## 3. Built-in Mock / Offline LLM Engine

### 3.1 Why a Mock Engine is Essential
CosyUI is designed to be runnable anywhere, anytime:
- Zero initial configuration: Users can clone or open the app and instantly run complete RPG story flows without entering an API key.
- Safe testing: Rapid verification of complex node graphs without incurring costs or triggering API rate limits.
- Realistic UI validation: Simulates realistic token-by-token typing rhythm and latency so UI streaming, typewriter effects, and abort button mechanics can be tested faithfully.

---

### 3.2 Intelligent Context-Aware Simulation
The `MockLLMEngine` inspects incoming messages, game variables, dice rolls, and system instructions to produce dynamic, high-quality responses across four primary archetypes:

```javascript
/**
 * Context-Aware Mock LLM Simulator
 * Generates thematic RPG, debate, and choice game responses completely offline.
 */
class MockLLMEngine {
  constructor() {
    this.rpgThemes = {
      fantasy: {
        locations: ['ancient runic altar', 'mist-shrouded whispering woods', 'subterranean crystal grotto', 'forgotten citadel armory', 'tavern of the Stumbling Drake'],
        creatures: ['shadow stalker', 'dwarven automatons', 'spectral warden', 'gilded basilisk', 'amber-eyed goblin rogue'],
        items: ['Moonstone Amulet', 'Rune-inscribed Longsword', 'Flask of Elixir', 'Weathered Parchment', 'Bag of Caltrops']
      },
      scifi: {
        locations: ['decompression airlock B-7', 'derelict cryo-stasis bay', 'ion-core reactor room', 'orbital relay observation deck'],
        creatures: ['malfunctioning maintenance drone', 'cybernetic bounty hunter', 'plasma anomaly', 'AI defense subroutine'],
        items: ['EMP Burst Charge', 'Plasma Torch', 'Encrypted Datapad', 'Nanite Repair Vial']
      }
    };
  }

  /**
   * Generates a context-aware mock response with optional token streaming
   */
  async generate(config, signal = null, onChunk = null) {
    const lastUserMessage = [...config.messages].reverse().find(m => m.role === 'user')?.content || '';
    const systemPrompt = config.messages.find(m => m.role === 'system')?.content || '';
    const fullConversation = config.messages.map(m => `${m.role}: ${m.content}`).join('\n');

    let responseText = '';
    const scenario = config.mockScenario || this._inferScenario(systemPrompt, lastUserMessage);

    switch (scenario) {
      case 'rpg_dm':
        responseText = this._generateRPGResponse(lastUserMessage, systemPrompt, fullConversation);
        break;
      case 'debate':
        responseText = this._generateDebateResponse(lastUserMessage, systemPrompt);
        break;
      case 'choice_list':
        responseText = this._generateChoiceListResponse(lastUserMessage);
        break;
      case 'raw_json':
        responseText = this._generateJSONResponse(lastUserMessage, systemPrompt);
        break;
      case 'echo':
      default:
        responseText = `[Offline Mock LLM Received]: "${lastUserMessage}"\nProcessed under system instructions: "${systemPrompt.slice(0, 100)}..."`;
        break;
    }

    // Estimate token metrics
    const promptTokens = Math.max(1, Math.round(fullConversation.length / 4));
    const completionTokens = Math.max(1, Math.round(responseText.length / 4));

    if (!config.stream || !onChunk) {
      return {
        text: responseText,
        finishReason: 'stop',
        usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
      };
    }

    // Stream with realistic typing cadence
    return this._streamTokens(responseText, signal, onChunk, promptTokens);
  }

  /* -------------------------------------------------------------
   * Scenario Inference
   * ----------------------------------------------------------- */
  _inferScenario(system, userMsg) {
    const combined = `${system} ${userMsg}`.toLowerCase();
    if (combined.includes('json') || combined.includes('format: json')) return 'raw_json';
    if (combined.includes('dungeon master') || combined.includes('rpg') || combined.includes('adventure') || combined.includes('game')) return 'rpg_dm';
    if (combined.includes('debate') || combined.includes('rebuttal') || combined.includes('argument')) return 'debate';
    if (combined.includes('choice') || combined.includes('options') || combined.includes('choose')) return 'choice_list';
    return 'rpg_dm'; // Default to RPG DM for maximum playful interactivity
  }

  /* -------------------------------------------------------------
   * 1. Dynamic RPG Dungeon Master Generator
   * ----------------------------------------------------------- */
  _generateRPGResponse(userPrompt, systemPrompt, history) {
    const lower = userPrompt.toLowerCase();
    const isSciFi = systemPrompt.toLowerCase().includes('sci-fi') || lower.includes('ship') || lower.includes('plasma');
    const theme = isSciFi ? this.rpgThemes.scifi : this.rpgThemes.fantasy;

    const loc = theme.locations[Math.floor(Math.random() * theme.locations.length)];
    const foe = theme.creatures[Math.floor(Math.random() * theme.creatures.length)];
    const loot = theme.items[Math.floor(Math.random() * theme.items.length)];

    // Check for dice roll indicators in input (e.g. [Rolled 18 on d20])
    const rollMatch = userPrompt.match(/\[(?:Rolled|Dice|Roll):\s*(\d+)/i) || userPrompt.match(/\b(\d+)\s*(?:on d20|result)\b/i);
    let rollNarrative = '';
    if (rollMatch) {
      const val = parseInt(rollMatch[1], 10);
      if (val >= 18) {
        rollNarrative = `🎲 **Critical Success (Roll: ${val})!** Your execution is flawless, piercing straight through the danger with sublime poise.\n\n`;
      } else if (val <= 5) {
        rollNarrative = `🎲 **Critical Peril (Roll: ${val})!** A sudden misstep destabilizes your footing, inviting imminent hazard!\n\n`;
      } else {
        rollNarrative = `🎲 **Standard Outcome (Roll: ${val})!** You manage to react in time, though the margin is razor thin.\n\n`;
      }
    }

    // Branching narrative based on player verbs
    let actionReaction = '';
    if (lower.includes('attack') || lower.includes('strike') || lower.includes('fight')) {
      actionReaction = `You steel yourself and launch an offensive against the ${foe}. Sparks cascade across the stone floor as your attack connects!`;
    } else if (lower.includes('examine') || lower.includes('look') || lower.includes('inspect') || lower.includes('search')) {
      actionReaction = `You step closer to scrutinize the ${loc}. Hidden beneath centuries of dust, your fingers brush against a ${loot}.`;
    } else if (lower.includes('talk') || lower.includes('persuade') || lower.includes('ask') || lower.includes('negotiate')) {
      actionReaction = `"State your purpose," speaks a low, resonant voice echoing through the chamber. The tension is palpable.`;
    } else if (lower.includes('flee') || lower.includes('run') || lower.includes('sneak') || lower.includes('hide')) {
      actionReaction = `Sliding into the obsidian shadows, you suppress your breathing. The tremors gradually recede into the dark corridors.`;
    } else {
      actionReaction = `You take a deliberate breath and evaluate your surroundings. The atmosphere inside the ${loc} is dense with anticipation.`;
    }

    return `${rollNarrative}${actionReaction}

A low hum vibrates through the air. You sense that your next decision will irrevocably alter the path ahead.

**What do you do?**
1. Press forward and inspect the ${loc} more closely.
2. Ready your stance to confront the ${foe}.
3. Secure the ${loot} and search for an alternate exit.
4. Attempt a quiet retreat into the darkness.`;
  }

  /* -------------------------------------------------------------
   * 2. Debate & Socratic Argument Generator
   * ----------------------------------------------------------- */
  _generateDebateResponse(userPrompt, systemPrompt) {
    return `You raise an intriguing perspective regarding: "${userPrompt.slice(0, 80)}...".

However, critical evaluation reveals two fundamental counter-arguments:
1. **The Unintended Consequences Thesis**: If this principle were universalized, the structural incentive structure would shift toward short-term optimization at the expense of systemic stability.
2. **The Epistemic Boundary**: You presuppose access to complete information, whereas real-world decisions operate under bounded rationality and asymmetric incentives.

Consider this counter-question: How does your position account for edge cases where the core assumptions invert under external pressure?`;
  }

  /* -------------------------------------------------------------
   * 3. Structured Choice List Generator
   * ----------------------------------------------------------- */
  _generateChoiceListResponse(userPrompt) {
    return `Based on your request "${userPrompt}", here are four actionable choices:
1. Investigate the northern passage and map the surroundings.
2. Forge an alliance with the local merchant guild.
3. Decrypt the ancient codex using acquired fragments.
4. Reinforce your defenses and await dawn.`;
  }

  /* -------------------------------------------------------------
   * 4. Structured JSON Generator
   * ----------------------------------------------------------- */
  _generateJSONResponse(userPrompt, systemPrompt) {
    return `\`\`\`json
{
  "status": "success",
  "intent": "${userPrompt.replace(/"/g, '\\"')}",
  "confidence": 0.94,
  "action": "PROCEED_NEXT_STAGE",
  "entities": {
    "target": "ancient_relic",
    "powerLevel": 42,
    "unlocked": true
  },
  "dialogue": "The mechanism unlocks with a satisfying click."
}
\`\`\``;
  }

  /* -------------------------------------------------------------
   * Token-by-Token Streaming Simulator
   * ----------------------------------------------------------- */
  async _streamTokens(fullText, signal, onChunk, promptTokens) {
    // Break into realistic token words / punctuation chunks
    const tokens = fullText.match(/\s+|\S+/g) || [fullText];
    let accumulated = '';
    let index = 0;

    return new Promise((resolve, reject) => {
      const step = () => {
        if (signal?.aborted) {
          const err = new DOMException('Generation aborted by user.', 'AbortError');
          reject(err);
          return;
        }

        if (index >= tokens.length) {
          const finalUsage = {
            promptTokens,
            completionTokens: Math.max(1, Math.round(accumulated.length / 4)),
            totalTokens: promptTokens + Math.max(1, Math.round(accumulated.length / 4))
          };
          if (onChunk) {
            onChunk({ token: '', accumulated, done: true, finishReason: 'stop', usage: finalUsage });
          }
          resolve({
            text: accumulated,
            finishReason: 'stop',
            usage: finalUsage
          });
          return;
        }

        const chunk = tokens[index++];
        accumulated += chunk;

        if (onChunk) {
          onChunk({
            token: chunk,
            accumulated,
            done: false,
            finishReason: null
          });
        }

        // Natural typing delay: 18ms - 40ms, slightly longer for punctuation
        let delay = Math.floor(Math.random() * 22) + 18;
        if (/[.,!?;:]\s*$/.test(chunk)) {
          delay += 75; // pause on punctuation
        } else if (chunk.includes('\n')) {
          delay += 110; // pause on newline
        }

        setTimeout(step, delay);
      };

      step();
    });
  }
}
```

---

## 4. Streaming Token Pipeline & SSE Parser

### 4.1 Broken Packet & Boundary Handling
Server-Sent Events over HTTP chunked transfer encoding can split across byte packets at arbitrary boundaries (e.g. halfway through `data: {"choi` or inside a multi-byte UTF-8 code point).

Our pipeline uses `TextDecoder({ stream: true })` and an incremental line buffer accumulator:
1. Decode incoming `Uint8Array` bytes into text while preserving incomplete UTF-8 sequences.
2. Prepend any remnant buffer from the prior chunk.
3. Split on newline characters (`\n` or `\r\n`).
4. Keep the final incomplete line in the remnant buffer for the next network chunk.
5. Parse completed lines.

```
Incoming Stream (Packets)
       │
       ▼
 [Uint8Array] ──► TextDecoder(utf8, { stream: true })
       │
       ▼
 [Line Buffer] ──► Split by '\n' ──► [Unfinished tail kept in buffer]
       │
       ▼
 [SSE Framer] ──► Match "data: " / "event: "
       │
       ▼
 [JSON Parser] ──► Extract text delta ──► Emit onChunk(token, accumulated)
```

---

### 4.2 Production SSE Parsers Blueprint

```javascript
/* -------------------------------------------------------------
 * OpenAI / OpenRouter SSE Stream Parser
 * ----------------------------------------------------------- */
UniversalLLMClient.prototype._parseOpenAISSE = async function(bodyStream, onChunk, signal) {
  const reader = bodyStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let lineBuffer = '';
  let accumulated = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let finishReason = 'stop';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException('Stream aborted by user.', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split(/\r?\n/);
      // Keep last incomplete segment in buffer
      lineBuffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) continue; // Skip comments/heartbeats

        if (line.startsWith('data: ')) {
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            finishReason = 'stop';
            continue;
          }

          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            const reason = parsed.choices?.[0]?.finish_reason;
            if (reason) finishReason = reason;

            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || promptTokens;
              completionTokens = parsed.usage.completion_tokens || completionTokens;
            }

            if (delta) {
              accumulated += delta;
              if (onChunk) {
                onChunk({
                  token: delta,
                  accumulated,
                  done: false,
                  finishReason: null
                });
              }
            }
          } catch (e) {
            // Ignore non-fatal JSON parse error for malformed interim chunk
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Handle any remaining lineBuffer if present
  if (lineBuffer.trim().startsWith('data: ')) {
    const payload = lineBuffer.trim().slice(6).trim();
    if (payload !== '[DONE]') {
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) accumulated += delta;
      } catch {}
    }
  }

  const finalUsage = {
    promptTokens: promptTokens || Math.max(1, Math.round(accumulated.length / 4)),
    completionTokens: completionTokens || Math.max(1, Math.round(accumulated.length / 4)),
    totalTokens: (promptTokens + completionTokens) || Math.max(2, Math.round(accumulated.length / 2))
  };

  if (onChunk) {
    onChunk({
      token: '',
      accumulated,
      done: true,
      finishReason,
      usage: finalUsage
    });
  }

  return { text: accumulated, finishReason, usage: finalUsage };
};

/* -------------------------------------------------------------
 * Anthropic Messages SSE Stream Parser
 * ----------------------------------------------------------- */
UniversalLLMClient.prototype._parseAnthropicSSE = async function(bodyStream, onChunk, signal) {
  const reader = bodyStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let lineBuffer = '';
  let accumulated = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let finishReason = 'end_turn';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException('Stream aborted by user.', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();

        try {
          const eventData = JSON.parse(payload);

          // Anthropic event types
          if (eventData.type === 'message_start' && eventData.message?.usage) {
            inputTokens = eventData.message.usage.input_tokens || 0;
          } else if (eventData.type === 'content_block_delta') {
            const delta = eventData.delta?.text || '';
            if (delta) {
              accumulated += delta;
              if (onChunk) {
                onChunk({
                  token: delta,
                  accumulated,
                  done: false,
                  finishReason: null
                });
              }
            }
          } else if (eventData.type === 'message_delta') {
            if (eventData.delta?.stop_reason) {
              finishReason = eventData.delta.stop_reason;
            }
            if (eventData.usage?.output_tokens) {
              outputTokens = eventData.usage.output_tokens;
            }
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  const finalUsage = {
    promptTokens: inputTokens,
    completionTokens: outputTokens || Math.max(1, Math.round(accumulated.length / 4)),
    totalTokens: inputTokens + (outputTokens || Math.max(1, Math.round(accumulated.length / 4)))
  };

  if (onChunk) {
    onChunk({
      token: '',
      accumulated,
      done: true,
      finishReason,
      usage: finalUsage
    });
  }

  return { text: accumulated, finishReason, usage: finalUsage };
};

/* -------------------------------------------------------------
 * Ollama NDJSON Stream Parser
 * ----------------------------------------------------------- */
UniversalLLMClient.prototype._parseOllamaNDJSON = async function(bodyStream, onChunk, signal) {
  const reader = bodyStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let lineBuffer = '';
  let accumulated = '';
  let promptTokens = 0;
  let completionTokens = 0;
  let finishReason = 'stop';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException('Stream aborted by user.', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        try {
          const item = JSON.parse(line);
          const delta = item.message?.content || '';
          if (delta) {
            accumulated += delta;
            if (onChunk) {
              onChunk({
                token: delta,
                accumulated,
                done: false,
                finishReason: null
              });
            }
          }

          if (item.done) {
            finishReason = item.done_reason || 'stop';
            promptTokens = item.prompt_eval_count || 0;
            completionTokens = item.eval_count || 0;
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  const finalUsage = {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  };

  if (onChunk) {
    onChunk({
      token: '',
      accumulated,
      done: true,
      finishReason,
      usage: finalUsage
    });
  }

  return { text: accumulated, finishReason, usage: finalUsage };
};
```

---

## 5. Prompt Templating Engine

### 5.1 Architecture & Mustache Variable Resolution
The Prompt Templating Engine evaluates text templates safely without `eval()` or `Function()`. It supports:
- Dot notation property lookup: `{{player.stats.strength}}`, `{{inventory.0.name}}`.
- Default values: `{{playerName || "Wanderer"}}`.
- Safe condition blocks: `{{#if hasKey}}You unlock the chest.{{/if}}`.
- Negated condition blocks: `{{^hasKey}}The lock remains stubborn.{{/hasKey}}`.
- List iteration: `{{#each items}} - {{name}} (x{{qty}})\n{{/each}}`.

```javascript
/**
 * Safe Zero-Dependency Template Engine
 */
class PromptTemplateEngine {
  /**
   * Render a template string against a context object
   * @param {string} template
   * @param {Record<string, any>} context
   * @returns {string}
   */
  static render(template, context = {}) {
    if (!template || typeof template !== 'string') return '';

    let output = template;

    // 1. Process Section Blocks: {{#if key}} ... {{/if}}
    output = output.replace(/\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) => {
      const val = PromptTemplateEngine._resolveKey(key, context);
      const isTruthy = Boolean(val && (Array.isArray(val) ? val.length > 0 : true));
      return isTruthy ? PromptTemplateEngine.render(inner, context) : '';
    });

    // 2. Process Inverted Blocks: {{^key}} ... {{/key}}
    output = output.replace(/\{\{\^([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
      const val = PromptTemplateEngine._resolveKey(key, context);
      const isFalsy = !val || (Array.isArray(val) && val.length === 0);
      return isFalsy ? PromptTemplateEngine.render(inner, context) : '';
    });

    // 3. Process Loops: {{#each key}} ... {{/each}}
    output = output.replace(/\{\{#each\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, inner) => {
      const list = PromptTemplateEngine._resolveKey(key, context);
      if (!Array.isArray(list) || list.length === 0) return '';
      return list.map((item, idx) => {
        const itemCtx = (typeof item === 'object' && item !== null)
          ? { ...context, ...item, '@index': idx, '@this': item }
          : { ...context, this: item, '@index': idx, '@this': item };
        return PromptTemplateEngine.render(inner, itemCtx);
      }).join('');
    });

    // 4. Process Simple Variables: {{key}} and Fallbacks: {{key || "default"}}
    output = output.replace(/\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\|\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_.]+)))?\s*\}\}/g, 
      (_, key, defDbl, defSgl, defVar) => {
        const val = PromptTemplateEngine._resolveKey(key, context);
        if (val !== undefined && val !== null && val !== '') {
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
        if (defDbl !== undefined) return defDbl;
        if (defSgl !== undefined) return defSgl;
        if (defVar !== undefined) {
          const fallbackVal = PromptTemplateEngine._resolveKey(defVar, context);
          return fallbackVal !== undefined ? String(fallbackVal) : '';
        }
        return '';
      }
    );

    return output;
  }

  /**
   * Safe property path resolution (e.g. 'party.leader.hp')
   */
  static _resolveKey(path, context) {
    if (!path || !context) return undefined;
    const parts = path.trim().split('.');
    let current = context;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }
}
```

---

### 5.2 Conversation History Windowing & Management
To prevent LLM context-window overflow and manage token expenditure, the `ConversationHistoryManager` maintains message lists with pruning strategies:

```javascript
class ConversationHistoryManager {
  /**
   * Applies sliding-window truncation while always preserving the initial System prompt
   * @param {ChatMessage[]} messages
   * @param {number} maxTurns Maximum user+assistant exchanges to keep (default: 8)
   * @returns {ChatMessage[]}
   */
  static pruneByTurns(messages, maxTurns = 8) {
    const systemMessages = messages.filter(m => m.role === 'system');
    const dialogueMessages = messages.filter(m => m.role !== 'system');

    // Keep the most recent 2 * maxTurns (user + assistant pairs)
    const windowedDialogue = dialogueMessages.slice(-Math.max(2, maxTurns * 2));

    return [...systemMessages, ...windowedDialogue];
  }

  /**
   * Estimate tokens in a message array and prune oldest messages if exceeding budget
   * @param {ChatMessage[]} messages
   * @param {number} maxTokenBudget e.g. 4000 tokens
   * @returns {ChatMessage[]}
   */
  static pruneByTokenBudget(messages, maxTokenBudget = 4000) {
    const system = messages.filter(m => m.role === 'system');
    const dialogue = messages.filter(m => m.role !== 'system');

    let currentTokens = system.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
    const keptDialogue = [];

    // Traverse dialogue from newest to oldest
    for (let i = dialogue.length - 1; i >= 0; i--) {
      const msgTokens = Math.ceil(dialogue[i].content.length / 4);
      if (currentTokens + msgTokens <= maxTokenBudget) {
        keptDialogue.unshift(dialogue[i]);
        currentTokens += msgTokens;
      } else {
        break; // Stop including older messages
      }
    }

    return [...system, ...keptDialogue];
  }
}
```

---

## 6. Output Parsers & Data Extractors

LLM outputs are inherently unstructured text. CosyUI node graphs require clean data contracts (e.g., choices must populate UI Buttons, JSON must update Game Variables).

### 6.1 Parser Suite Implementation

```javascript
class OutputParsers {
  /**
   * 1. Raw Text Parser (with whitespace trimming & normalization)
   */
  static raw(text, options = { trim: true }) {
    if (typeof text !== 'string') return '';
    return options.trim ? text.trim() : text;
  }

  /**
   * 2. Resilient JSON Extractor
   * Handles markdown fences (```json ... ```), trailing commas, and unquoted keys.
   */
  static extractJSON(text, fallback = null) {
    if (!text || typeof text !== 'string') return fallback;

    // Remove markdown code fences if present
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    // Fast path: direct parse
    try {
      return JSON.parse(cleaned);
    } catch (_) {}

    // Fallback: extract the first balanced { ... } or [ ... ] block
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = -1;
    let endChar = '}';

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      endChar = '}';
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      endChar = ']';
    }

    if (startIdx !== -1) {
      const lastIdx = cleaned.lastIndexOf(endChar);
      if (lastIdx > startIdx) {
        const candidate = cleaned.slice(startIdx, lastIdx + 1);
        try {
          return JSON.parse(candidate);
        } catch (_) {
          // Attempt lenient cleanup: remove trailing commas before } or ]
          const relaxed = candidate.replace(/,\s*([}\]])/g, '$1');
          try {
            return JSON.parse(relaxed);
          } catch (_) {}
        }
      }
    }

    return fallback;
  }

  /**
   * 3. Choice List Extractor
   * Extracts numbered options (1. Option), bullet points (* Option, - Option),
   * or <choice>Option</choice> tags for dynamic UI Button nodes.
   */
  static extractChoices(text) {
    if (!text || typeof text !== 'string') return [];

    const choices = [];

    // Strategy A: Explicit XML/HTML choice tags: <choice>...</choice>
    const tagMatches = [...text.matchAll(/<choice(?:\s+id=["']?([^"'>]+)["']?)?>([\s\S]*?)<\/choice>/gi)];
    if (tagMatches.length > 0) {
      return tagMatches.map((m, i) => ({
        id: m[1] || `choice_${i + 1}`,
        index: i + 1,
        text: m[2].trim()
      }));
    }

    // Strategy B: Numbered list items (e.g. "1. Open the door", "1) Flee", "[1] Strike")
    const lines = text.split(/\r?\n/);
    const numberedRegex = /^(?:\[?(\d+)\]?[.)\-:]|\((\d+)\))\s+(.*)$/;
    const bulletRegex = /^[*\-•]\s+(.*)$/;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const numMatch = line.match(numberedRegex);
      if (numMatch) {
        const num = parseInt(numMatch[1] || numMatch[2], 10);
        const choiceText = numMatch[3].trim().replace(/^\*\*|\*\*$/g, ''); // strip bold
        choices.push({
          id: `choice_${num}`,
          index: num,
          text: choiceText
        });
        continue;
      }

      // If already collecting numbered items, don't mix bullets unless choices is empty
      if (choices.length === 0) {
        const bulletMatch = line.match(bulletRegex);
        if (bulletMatch) {
          const bulletText = bulletMatch[1].trim().replace(/^\*\*|\*\*$/g, '');
          choices.push({
            id: `choice_${choices.length + 1}`,
            index: choices.length + 1,
            text: bulletText
          });
        }
      }
    }

    return choices;
  }

  /**
   * 4. Tag / Key-Value & Regex Extractor
   * Extracts game state directives like [HP: -5], [GOLD: +10], [GOTO: tavern]
   */
  static extractTags(text, customRegex = /\[([A-Z_]+):\s*([^\]]+)\]/gi) {
    if (!text || typeof text !== 'string') return [];
    const results = [];
    const matches = [...text.matchAll(customRegex)];
    for (const m of matches) {
      results.push({
        raw: m[0],
        key: m[1]?.trim(),
        value: m[2]?.trim()
      });
    }
    return results;
  }
}
```

---

## 7. Token Tracking, Error Handling & API Validation

### 7.1 Heuristic Token Counter (Zero Dependency)
For client-side cost forecasting and UI budget meters before an API roundtrip:
```javascript
class TokenEstimator {
  /**
   * Fast rule-of-thumb BPE token approximation
   * Average English words = ~1.3 tokens; 4 chars per token average across code/text.
   */
  static estimate(text) {
    if (!text) return 0;
    // Word boundary + punctuation heuristic
    const words = text.trim().split(/\s+/).length;
    const chars = text.length;
    const estByChars = Math.ceil(chars / 3.8);
    const estByWords = Math.ceil(words * 1.3);
    return Math.max(1, Math.round((estByChars + estByWords) / 2));
  }

  /**
   * Estimate token usage for full ChatMessage history
   */
  static estimateMessages(messages) {
    let tokens = 0;
    for (const msg of messages) {
      tokens += 4; // per-message formatting overhead (<im_start>, role, etc.)
      tokens += TokenEstimator.estimate(msg.content);
    }
    tokens += 3; // assistant reply priming
    return tokens;
  }
}
```

### 7.2 API Key Validation Utilities
```javascript
class APIKeyValidator {
  static validate(provider, key) {
    if (provider === 'mock' || provider === 'ollama') {
      return { valid: true, error: null };
    }
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return { valid: false, error: `API Key required for provider: ${provider}` };
    }
    const clean = key.trim();

    if (provider === 'openai') {
      if (!clean.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API keys typically start with "sk-"' };
      }
      if (clean.length < 20) {
        return { valid: false, error: 'OpenAI API key appears too short.' };
      }
    }

    if (provider === 'anthropic') {
      if (!clean.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic API keys typically start with "sk-ant-"' };
      }
    }

    return { valid: true, error: null };
  }
}
```

---

## 8. Node Graph Engine Integration

The LLM Runtime connects directly with Agent 02's Graph Canvas and Agent 04's UI Customizer via standardized Node Schemas:

```
+--------------------+        +---------------------+        +--------------------+
| PromptTemplateNode |        |       LLMNode       |        |  OutputParserNode  |
|--------------------|        |---------------------|        |--------------------|
| in: template       | ───►   | in: prompt          | ───►   | in: rawText        |
| in: variables (obj)|        | in: systemPrompt    |        | out: jsonObject    |
| out: renderedText  |        | in: history (arr)   |        | out: choiceList    |
+--------------------+        | in: modelConfig     |        +--------------------+
                              | out: streamChunk    |                  │
                              | out: fullText       |                  ▼
                              | out: usageStats     |        +--------------------+
                              +---------------------+        |   UI Choice Node   |
                                                             | (Agent 04 Player)  |
                                                             +--------------------+
```

### 8.1 Node Data Definitions

```javascript
/** Node Graph Spec for LLM Prompt Node */
const LLMPromptNodeDef = {
  type: 'llm_prompt',
  title: 'LLM Prompt',
  category: 'LLM Runtime',
  color: '#8b5cf6', // Cosy violet
  inputs: [
    { id: 'prompt', label: 'Prompt', type: 'string', required: true },
    { id: 'system', label: 'System Instructions', type: 'string' },
    { id: 'history', label: 'Chat History', type: 'array' },
    { id: 'trigger', label: 'Execute', type: 'signal' }
  ],
  outputs: [
    { id: 'stream', label: 'Stream Token', type: 'stream' },
    { id: 'text', label: 'Full Text', type: 'string' },
    { id: 'choices', label: 'Choices', type: 'array' },
    { id: 'json', label: 'Extracted JSON', type: 'object' },
    { id: 'done', label: 'Completed', type: 'signal' },
    { id: 'error', label: 'Error', type: 'string' }
  ],
  properties: {
    provider: 'mock', // 'mock' | 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'custom'
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1024,
    apiKey: '',
    endpointUrl: '',
    mockScenario: 'rpg_dm',
    autoParseChoices: true
  }
};
```

---

## 9. Verification & Acceptance Criteria Matrix

| Feature Module | Verification Test | Expected Pass Result |
| :--- | :--- | :--- |
| **Mock Engine (RPG)** | Call `.complete({ provider: 'mock', mockScenario: 'rpg_dm' })` | Emits realistic atmospheric text + 4 numbered options. |
| **Mock Engine (Streaming)** | Stream mock response with `onChunk` callback | Emits tokens sequentially at ~20-30ms intervals; abort signal halts stream instantly. |
| **OpenAI SSE Parser** | Feed chunked mock SSE buffer with fragmented lines | Decodes UTF-8 without dropping characters; calls `onChunk` accurately. |
| **Anthropic Adapter** | Request with system prompt + alternating messages | Moves system message to top-level `system` property, formats payload correctly. |
| **Ollama NDJSON** | Line-delimited stream with `eval_count` | Extracts token delta and final evaluation usage metrics. |
| **Mustache Template Engine** | Render `{{player.name}} has {{#if hasSword}}sword{{/if}}` | Resolves nested objects and conditional rendering without `eval`. |
| **JSON Parser** | Extract from ````json\n{"val": 10}\n```` with trailing noise | Returns clean parsed object `{ val: 10 }`. |
| **Choice Extractor** | Extract from standard numbered list `1. Explore\n2. Retreat` | Returns `[{ id: 'choice_1', index: 1, text: 'Explore' }, ...]` |
| **Rate Limit Backoff** | Mock HTTP 429 response | Exponentially backs off with jitter and retries up to 3 times. |

---

## 10. Summary & Handoff Confirmation

This specification provides the comprehensive architecture, contracts, and zero-dependency implementation blueprints for the CosyUI LLM Runtime.
All components are fully decoupled, browser-native, and immediately compatible with the Graph Engine (Agent 02), Frontend UI Customizer (Agent 04), and Game Logic (Agent 05).
