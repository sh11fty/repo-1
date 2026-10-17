import { ModelUnavailable } from './provider.js';

/** Live provider. The API key is read from the environment only and is never logged or returned. */
export function anthropicProvider({ model, apiKey = process.env.ANTHROPIC_API_KEY, timeoutMs = 60000 } = {}) {
  return {
    name: `anthropic:${model}`,
    isStub: false,
    available: () => Boolean(apiKey && model),
    async complete({ system, user, maxTokens = 2000, temperature = 0 }) {
      if (!apiKey) throw new ModelUnavailable('ANTHROPIC_API_KEY not set');
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] }),
          signal: ctl.signal,
        });
        if (!res.ok) throw new ModelUnavailable(`model API returned HTTP ${res.status}`);
        const data = await res.json();
        const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        if (!text) throw new ModelUnavailable('model returned no text');
        return { text };
      } catch (e) {
        if (e instanceof ModelUnavailable) throw e;
        throw new ModelUnavailable(`model call failed: ${e.name}`);
      } finally { clearTimeout(t); }
    },
  };
}
