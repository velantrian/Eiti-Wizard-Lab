// research-router.js — READ-ONLY router into the Research Plane (B1).
//
// Parses the existing docs/research/EXPERIMENT_EVIDENCE_INDEX.md deterministically and returns
// verbatim card fields as POINTERS. It never rewrites, normalises or promotes a status, never writes
// anywhere, and never touches Working Memory (wm_*), Canon, ledger, wiz_ref_* or experiment records.
//   RESEARCH_INDEX_ONLY  CANON=NO  RUNTIME_AUTHORITY=NO  PRIMARY_EVIDENCE=NO
//   RESEARCH_RESULT != USER_DECISION   EXPERIMENT_PASS != WORKING_DECISION   UNKNOWN != FALSE   NOT_RUN != FAIL
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
    'A research candidate or result is never a working decision; verify claims at PRIMARY_EVIDENCE.';
  const FIELD_KEYS = Object.freeze(['EXPERIMENT_ID / NAME', 'QUESTION', 'STATUS', 'EXECUTION_VERDICT',
    'WHAT_IT_DOES_NOT_PROVE', 'OPEN_FINDING', 'PRIMARY_EVIDENCE', 'GITHUB_REF']);
  const MAX_FIELD_CHARS = 400;
  const MAX_CARDS = 5;
  const MAX_LIST = 30;

  function clip(value) {
    if (value == null) return { text: null, truncated: false };
    const text = String(value).trim();
    return text.length > MAX_FIELD_CHARS ? { text: text.slice(0, MAX_FIELD_CHARS) + '…', truncated: true } : { text, truncated: false };
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

  // Exposes the first backticked token of a verdict line (e.g. `NOT_RUN`) without altering the verbatim text.
  function verdictToken(text) {
    const m = text ? /`([A-Z_]+)`/.exec(text) : null;
    return m ? m[1] : null;
  }

  function card(entry) {
    const out = { plane: 'RESEARCH', line: entry.number, title: entry.title, truncated_fields: [] };
    for (const key of FIELD_KEYS) {
      const { text, truncated } = clip(entry.fields[key]);
      out[key] = text;               // null means "field absent in index" — never FALSE/ABSENT-as-verdict
      if (truncated) out.truncated_fields.push(key);
    }
    out.execution_verdict_token = verdictToken(entry.fields.EXECUTION_VERDICT);
    out.index_pointer = INDEX_PATH + '#' + entry.number;
    return out;
  }

  function route(markdown, args) {
    args = args || {};
    const base = { plane: 'RESEARCH', header: HEADER, notice: NOTICE, entrypoint: INDEX_PATH, read_only: true, promoted_to_working: false };
    if (typeof markdown !== 'string' || !markdown.trim()) {
      return Object.assign(base, { index_loaded: false, lines: [], note: 'Index text unavailable here; open ' + INDEX_PATH + ' directly. Nothing was inferred.' });
    }
    const cards = parseCards(markdown);
    const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
    const line = args.line != null && args.line !== '' ? Number(args.line) : null;
    if (line == null && !query) {
      return Object.assign(base, { index_loaded: true, total_lines: cards.length, lines: cards.slice(0, MAX_LIST).map(c => ({
        line: c.number, title: c.title, execution_verdict: clip(c.fields.EXECUTION_VERDICT).text,
        execution_verdict_token: verdictToken(c.fields.EXECUTION_VERDICT) })),
        note: 'Pass line or query for a card pointer.' });
    }
    let matches;
    if (line != null) matches = cards.filter(c => c.number === line);
    else matches = cards.filter(c => (c.title + ' ' + (c.fields['EXPERIMENT_ID / NAME'] || '')).toLowerCase().includes(query));
    return Object.assign(base, { index_loaded: true, total_lines: cards.length, matched: matches.length,
      cards: matches.slice(0, MAX_CARDS).map(card),
      note: matches.length ? 'Fields are verbatim from the index; null = field absent. Verify at PRIMARY_EVIDENCE.' : 'No matching research line. Not evidence of absence.' });
  }

  return Object.freeze({ INDEX_PATH, HEADER, NOTICE, FIELD_KEYS, parseCards, route });
});
