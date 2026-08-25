# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Eiti Wizard is a zero-dependency, zero-build static Progressive Web App (single `index.html`, ~805KB / ~11,200 lines). It is an AI workspace running entirely in the browser with chat, agents, file handling, and local memory via IndexedDB. See `README.md` for the full feature list and roadmap.

### Running the dev server

Serve the repository root with any static HTTP server. Service Workers require HTTP (not `file://`).

```bash
python3 -m http.server 8080          # preferred — no install needed
# or: npx serve -l 8080 .
```

Then open `http://localhost:8080/index.html` in Chrome.

### Lint / Tests / Build

There is **no build step, no linter, and no test suite**. The entire app is vanilla HTML/CSS/JS in a single file. There is no `package.json`, no bundler, and no CI pipeline.

### AI provider notes

- The app defaults to **Ollama** (localhost:11434) for offline AI. Without a running Ollama instance, sending a chat message will produce a "Failed to fetch" error — this is expected.
- Cloud providers (OpenAI, Anthropic/Claude, DeepSeek, Groq, OpenRouter) can be configured via the Settings panel using API keys stored in IndexedDB.
- To test chat end-to-end, either start Ollama locally or configure a cloud API key in Settings → Провайдер / API Keys.

### Security notes

- **API keys are stored in plaintext in IndexedDB** (local to the browser). There is no server, so keys never leave the device — but anyone with access to the browser profile / devtools can read them. Client-side "encryption" without a user-supplied passphrase would be security theatre (the decryption key would have to live next to the data), so this is left as a documented trade-off rather than a fix.
- User-controlled strings rendered into the DOM are escaped via `escapeHtml()` (and AI/chat markdown goes through `renderMarkdown()` → DOMPurify) to avoid stored-XSS. When adding new `innerHTML` sinks, escape any user/AI/file-derived value the same way.

### Key files

| File | Purpose |
|---|---|
| `index.html` | Entire application (~11,200 lines: HTML + CSS + JS) |
| `sw.js` | Service Worker for caching / offline support |
| `manifest.json` | PWA manifest (installability, icons, shortcuts) |
| `icon-*.png` | PWA icons in repo root (48×48 through 512×512) |
