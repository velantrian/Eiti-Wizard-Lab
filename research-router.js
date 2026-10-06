// research-router.js — READ-ONLY router into the Research Plane (B1).
//
// Parses the existing docs/research/EXPERIMENT_EVIDENCE_INDEX.md deterministically and returns
// verbatim card fields as POINTERS. It never rewrites, normalises, classifies or promotes a status
// (no verdict is derived from prose), never writes anywhere, and never touches Working Memory (wm_*),
// Canon, ledger, wiz_ref_* or experiment records. It does not depend on Working Memory being available.
//   RESEARCH_INDEX_ONLY  CANON=NO  RUNTIME_AUTHORITY=NO  PRIMARY_EVIDENCE=NO
//   RESEARCH_RESULT != USER_DECISION   EXPERIMENT_PASS != WORKING_DECISION   UNKNOWN != FALSE   NOT_RUN != FAIL
//
// Search is navigation over the CURRENT index text only (case-insensitive substring; every
// whitespace-separated term must occur). It is not an exhaustive scientific search.
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ResearchRouter = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  const INDEX_PATH = 'docs/research/EXPERIMENT_EVIDENCE_INDEX.md';
  const HEADER = 'RESEARCH_INDEX_ONLY CANON=NO RUNTIME_AUTHORITY=NO PRIMARY_EVIDENCE=NO';
  const NOTICE = 'Research Plane pointer. Not working state, not a user decision, not Canon. ' +
    'A research candidate or result is never a working decision; verify claims at PRIMARY_EVIDENCE. ' +
    'Fields are verbatim from the index; no verdict is derived. Navigation search over the current index only, not an exhaustive scientific search.';
  const FIELD_KEYS = Object.freeze(['EXPERIMENT_ID / NAME', 'QUESTION', 'STATUS', 'EXECUTION_VERDICT',
    'WHAT_IT_DOES_NOT_PROVE', 'OPEN_FINDING', 'PRIMARY_EVIDENCE', 'GITHUB_REF']);
  const LIST_KEYS = Object.freeze(['STATUS', 'EXECUTION_VERDICT', 'OPEN_FINDING', 'PRIMARY_EVIDENCE']);
  const SEARCH_KEYS = Object.freeze(['EXPERIMENT_ID / NAME', 'QUESTION', 'STATUS', 'EXECUTION_VERDICT', 'OPEN_FINDING', 'PRIMARY_EVIDENCE']);
  const CARD_FIELD_CHARS = 400;   // per field in a card view
  const LIST_FIELD_CHARS = 120;   // per field in the overview list
  const MAX_CARDS = 5;
  const MAX_LIST = 30;
  const OFFLINE_HEADER = 'X-Eiti-Served-From';
  const OFFLINE_VALUE = 'sw-offline-cache';

  function clip(value, max) {
    if (value == null) return { text: null, truncated: false };
    const text = String(value).trim();
    return text.length > max ? { text: text.slice(0, max) + '…', truncated: true } : { text, truncated: false };
  }

  // A fetched body is only treated as the Evidence Index if it carries the index header and section C.
  function looksLikeIndex(markdown) {
    return typeof markdown === 'string' && /RESEARCH_INDEX_ONLY/.test(markdown) && /^## C\. /m.test(markdown);
  }

  // Cards live under "## C." as "### N. TITLE" blocks; stop at the next "## " heading.
  function parseCards(markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    const cards = [];
    let inSectionC = false, card = null;
    for (const line of lines) {
      if (/^## /.test(line)) { inSectionC = /^## C\. /.test(line); card = null; continue; }
      if (!inSectionC) continue;
      const heading = /^### (\d+)\. (.+?)\s*$/.exec(line);
      if (heading) { card = { number: Number(heading[1]), title: heading[2], fields: {} }; cards.push(card); continue; }
      if (!card) continue;
      for (const key of FIELD_KEYS) {
        if (line.startsWith(key + ':')) {
          if (!(key in card.fields)) card.fields[key] = line.slice(key.length + 1).replace(/\\\s*$/, '').trim();
          break;
        }
      }
    }
    return cards;
  }

  // Verbatim fields only; `null` = field absent in the index. No derived verdict/status of any kind.
  function projectCard(entry, keys, max) {
    const out = { plane: 'RESEARCH', card_number: entry.number, heading: entry.title, truncated_fields: [] };
    for (const key of keys) {
      const { text, truncated } = clip(entry.fields[key], max);
      out[key] = text;
      if (truncated) out.truncated_fields.push(key);
    }
    return out;
  }

  function listEntry(entry) {
    const out = projectCard(entry, LIST_KEYS, LIST_FIELD_CHARS);
    const name = clip(entry.fields['EXPERIMENT_ID / NAME'], LIST_FIELD_CHARS);
    out['EXPERIMENT_ID / NAME'] = name.text;
    if (name.truncated) out.truncated_fields.push('EXPERIMENT_ID / NAME');
    return out;
  }

  function validation(message) {
    return { ok: false, code: 'VALIDATION', plane: 'RESEARCH', error: message };
  }

  function route(markdown, args, meta) {
    args = args || {}; meta = meta || {};
    const base = { plane: 'RESEARCH', header: HEADER, notice: NOTICE, entrypoint: INDEX_PATH, read_only: true, promoted_to_working: false,
      index_source: meta.source || 'UNKNOWN' };
    // card = research CARD number (not a filesystem line number); `line` is accepted as an alias of card.
    const hasCard = args.card != null && args.card !== '', hasLine = args.line != null && args.line !== '';
    const hasQuery = typeof args.query === 'string' && args.query.trim() !== '';
    if (hasCard && hasLine && Number(args.card) !== Number(args.line)) return validation('Provide either card or line (alias), not conflicting values.');
    const cardNumber = hasCard ? Number(args.card) : hasLine ? Number(args.line) : null;
    if (cardNumber != null && hasQuery) return validation('Provide either card/line or query, not both.');
    if (cardNumber != null && !Number.isInteger(cardNumber)) return validation('card must be an integer research card number.');
    if (args.query != null && typeof args.query !== 'string') return validation('query must be a string.');

    if (!looksLikeIndex(markdown)) {
      return Object.assign(base, { index_loaded: false, parse_status: markdown == null || markdown === '' ? (meta.error ? 'FETCH_FAILED' : 'INDEX_UNAVAILABLE') : 'NOT_AN_EVIDENCE_INDEX',
        note: 'Index could not be read as the Evidence Index; open ' + INDEX_PATH + ' directly. Nothing was inferred.' });
    }
    const cards = parseCards(markdown);
    if (!cards.length) {
      return Object.assign(base, { index_loaded: false, parse_status: 'NO_CARDS_PARSED',
        note: 'Index header found but no research cards were parsed (layout may have changed); open ' + INDEX_PATH + ' directly. Nothing was inferred.' });
    }
    Object.assign(base, { index_loaded: true, parse_status: 'OK', total_cards: cards.length });

    if (cardNumber == null && !hasQuery) {
      return Object.assign(base, { cards: cards.slice(0, MAX_LIST).map(listEntry), truncated: cards.length > MAX_LIST,
        note: 'Overview (fields verbatim, clipped per truncated_fields). Pass card or query for a fuller card.' });
    }
    let matches;
    if (cardNumber != null) matches = cards.filter(c => c.number === cardNumber);
    else {
      const terms = args.query.trim().toLowerCase().split(/\s+/);
      matches = cards.filter(c => {
        const hay = (c.title + '\n' + SEARCH_KEYS.map(k => c.fields[k] || '').join('\n')).toLowerCase();
        return terms.every(t => hay.includes(t));
      });
    }
    return Object.assign(base, { matched: matches.length, truncated: matches.length > MAX_CARDS,
      cards: matches.slice(0, MAX_CARDS).map(c => projectCard(c, FIELD_KEYS, CARD_FIELD_CHARS)),
      note: matches.length ? 'Fields are verbatim from the index; null = field absent. Verify at PRIMARY_EVIDENCE.' : 'No card in the current index matches. This is not evidence that no such research exists.' });
  }

  // Loader may return a string or { text, source }; failures degrade to pointer-only, never throw.
  async function routeWithLoader(loader, args) {
    let text = null, source = 'UNKNOWN', error = false;
    if (typeof loader === 'function') {
      try {
        const loaded = await loader();
        if (typeof loaded === 'string') text = loaded;
        else if (loaded && typeof loaded.text === 'string') { text = loaded.text; source = loaded.source || 'UNKNOWN'; }
      } catch (_) { error = true; }
    }
    return route(text, args, { source, error });
  }

  return Object.freeze({ INDEX_PATH, HEADER, NOTICE, FIELD_KEYS, OFFLINE_HEADER, OFFLINE_VALUE, looksLikeIndex, parseCards, route, routeWithLoader });
});
