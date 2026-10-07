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
  // Every named field of an index card (verbatim). Some cards carry several fields on ONE physical line; the
  // INLINE_FOLLOWERS table lists which fields may follow a line-leading field on the same line.
  const FIELD_KEYS = Object.freeze(['EXPERIMENT_ID / NAME', 'PROJECT', 'QUESTION', 'STATUS', 'EXECUTION_VERDICT', 'SCIENTIFIC_INTERPRETATION',
    'WHAT_WAS_OBSERVED', 'WHAT_IT_SUPPORTS', 'WHAT_IT_DOES_NOT_PROVE', 'OPEN_FINDING', 'PRIMARY_EVIDENCE',
    'GITHUB_REF', 'NOTION_REF', 'DRIVE_REF', 'NOTION_STATUS', 'DRIVE_STATUS', 'CONSISTENCY', 'LAST_VERIFIED', 'NOTES']);
  const INLINE_FOLLOWERS = Object.freeze({ GITHUB_REF: ['NOTION_REF', 'DRIVE_REF'], NOTION_STATUS: ['DRIVE_STATUS', 'CONSISTENCY', 'LAST_VERIFIED'] });
  // Minimal card contract: a recognised "### N. title" heading is a valid card only if these fields are present and
  // non-empty. Any card that fails it makes the whole index fail closed (pointer-only), never a partial "OK".
  const REQUIRED_FIELDS = Object.freeze(['STATUS', 'EXECUTION_VERDICT', 'PRIMARY_EVIDENCE']);
  const MAX_MALFORMED_REPORTED = 10;
  const LIST_KEYS = Object.freeze(['STATUS', 'EXECUTION_VERDICT', 'OPEN_FINDING', 'PRIMARY_EVIDENCE', 'CONSISTENCY']);
  const SEARCH_KEYS = Object.freeze(['EXPERIMENT_ID / NAME', 'QUESTION', 'STATUS', 'EXECUTION_VERDICT', 'OPEN_FINDING', 'PRIMARY_EVIDENCE']);
  const CARD_FIELD_CHARS = 500;   // per field when a card appears in a QUERY result (code points); a direct {card:N} request is never clipped
  const LIST_FIELD_CHARS = 120;   // per field in the overview list
  const MAX_CARDS = 3;
  const MAX_LIST = 30;
  const MAX_NUMBERS = 200;        // card numbers listed per response (matched / omitted)
  const MAX_ISSUES_REPORTED = 10;
  const OFFLINE_HEADER = 'X-Eiti-Served-From';
  const OFFLINE_VALUE = 'sw-offline-cache';   // transport failure: cached copy served
  const STALE_VALUE = 'sw-stale-cache';       // transient server failure (5xx): cached copy served

  // Clip to `max` Unicode CODE POINTS (never splits a surrogate pair); an ellipsis marks the cut.
  function clipCodePoints(text, max) {
    if (max === Infinity || text.length <= max) return { text, truncated: false };   // UTF-16 length <= max implies <= max code points
    let i = 0, count = 0;
    while (i < text.length && count < max) { i += text.codePointAt(i) > 0xFFFF ? 2 : 1; count++; }
    return i >= text.length ? { text, truncated: false } : { text: text.slice(0, i) + '…', truncated: true };
  }
  function clip(value, max) {
    if (value == null) return { text: null, truncated: false };
    return clipCodePoints(String(value).trim(), max);
  }

  // Top-level authority contract, parsed from the SOURCE text (never inferred, never normalised).
  // Only the header block (everything before the first "## " heading) is read, with STRICT one-flag-per-line syntax:
  //   A. colon form  KEY: `VALUE`  (exactly one space; BOTH backticks mandatory)   e.g.  CANON: `NO`
  //   B. equals form KEY=VALUE     (no spaces, no backticks)                         e.g.  CANON=NO
  // Everything else is rejected, e.g.  KEY: VALUE   KEY: `VALUE   KEY: VALUE`   KEY : VALUE   KEY:`VALUE`   KEY=`VALUE`   KEY = VALUE
  // Each required key must be declared EXACTLY ONCE (an identical duplicate is a violation, not tolerated).
  // Combined single-line forms, inline mentions of a flag inside other prose, ambiguous values and any other
  // alternative header form are violations and fail closed. Card bodies are NOT scanned (a card's own
  // "PRIMARY_EVIDENCE:" field is not an authority flag).
  const AUTHORITY_REQUIRED = Object.freeze({ STATUS: 'RESEARCH_INDEX_ONLY', CANON: 'NO', RUNTIME_AUTHORITY: 'NO', PRIMARY_EVIDENCE: 'NO' });
  const AUTHORITY_KEYS = Object.freeze(Object.keys(AUTHORITY_REQUIRED));
  const INLINE_FLAG = /\b(STATUS|CANON|RUNTIME_AUTHORITY|PRIMARY_EVIDENCE)\s*[:=]\s*`?([A-Za-z0-9_]*)/g;

  function parseAuthorityContract(markdown) {
    const found = {}; for (const k of AUTHORITY_KEYS) found[k] = [];
    const problems = [];
    for (const line of String(markdown || '').split(/\r?\n/)) {
      if (/^## /.test(line)) break;
      let declaredHere = false;
      for (const key of AUTHORITY_KEYS) {
        if (!new RegExp('^' + key + '\\s*[:=]').test(line)) continue;
        declaredHere = true;
        // Exactly two accepted forms (optional trailing markdown line-break backslash / whitespace only):
        //   A. colon: "KEY: `VALUE`"  (single space, BOTH backticks)      B. equals: "KEY=VALUE"  (no spaces, no backticks)
        const m = new RegExp('^' + key + ': `([A-Za-z0-9_]+)`\\\\?[ \\t]*$').exec(line) || new RegExp('^' + key + '=([A-Za-z0-9_]+)\\\\?[ \\t]*$').exec(line);
        if (m) found[key].push(m[1]); else { found[key].push('<ambiguous>'); problems.push(key + ': ambiguous or non-conforming declaration "' + line.trim().slice(0, 80) + '"'); }
      }
      if (declaredHere) continue;
      // Not a flag line: any flag mentioned inline (combined single-line form, or inside prose) is itself a violation.
      for (const m of line.matchAll(INLINE_FLAG)) { found[m[1]].push(m[2] || '<inline>'); problems.push(m[1] + ': inline/combined declaration not allowed (one flag per line)'); }
    }
    for (const key of AUTHORITY_KEYS) {
      const values = found[key], distinct = [...new Set(values)];
      if (!values.length) problems.push(key + ': missing');
      else if (distinct.length > 1) problems.push(key + ': conflicting declarations (' + distinct.join(' vs ') + ')');
      else if (values.length > 1) problems.push(key + ': duplicate declaration (' + values.length + ' occurrences; exactly one required)');
      else if (distinct[0] !== AUTHORITY_REQUIRED[key] && distinct[0] !== '<ambiguous>') problems.push(key + ': declared ' + distinct[0] + ', required ' + AUTHORITY_REQUIRED[key]);
    }
    const declared = {}; for (const key of AUTHORITY_KEYS) declared[key] = found[key].length === 1 ? found[key][0] : null;
    return { valid: problems.length === 0, problems, found, declared };
  }

  // A fetched body is only treated as the Evidence Index if it carries the index header and section C.
  function looksLikeIndex(markdown) {
    return typeof markdown === 'string' && /RESEARCH_INDEX_ONLY/.test(markdown) && /^## C\. /m.test(markdown);
  }

  // Cards live under "## C." as "### N. TITLE" blocks; stop at the next "## " heading.
  // Every named field is extracted (including several fields on one physical line, see INLINE_FOLLOWERS).
  // Nothing meaningful is dropped silently: a non-blank card line that is not a recognised field, or a repeated
  // field, is recorded in card.issues and makes the index fail closed (UNSUPPORTED_CARD_CONTENT).
  const escapeRe = t => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  function parseCards(markdown) {
    const lines = String(markdown || '').split(/\r?\n/);
    const cards = [];
    let inSectionC = false, card = null;
    const put = (key, value) => {
      if (key in card.fields) card.issues.push({ kind: 'DUPLICATE_FIELD', field: key });
      else card.fields[key] = value.trim();
    };
    for (const line of lines) {
      if (/^## /.test(line)) { inSectionC = /^## C\. /.test(line); card = null; continue; }
      if (!inSectionC) continue;
      const heading = /^### (\d+)\. (.+?)\s*$/.exec(line);
      if (heading) { card = { number: Number(heading[1]), title: heading[2], fields: {}, issues: [] }; cards.push(card); continue; }
      if (!card || !line.trim()) continue;
      const key = FIELD_KEYS.find(k => line.startsWith(k + ':'));
      if (!key) { card.issues.push({ kind: 'UNRECOGNIZED_LINE', snippet: line.trim().slice(0, 80) }); continue; }
      const rest = line.slice(key.length + 1).replace(/\\\s*$/, '');
      const marks = [];
      for (const follower of INLINE_FOLLOWERS[key] || []) {
        const m = new RegExp('(?:^|\\s)' + escapeRe(follower) + ':(?:\\s|$)').exec(rest);
        if (m) marks.push({ key: follower, at: m.index, valueFrom: m.index + m[0].length });
      }
      marks.sort((x, y) => x.at - y.at);
      put(key, rest.slice(0, marks.length ? marks[0].at : rest.length));
      marks.forEach((mk, i) => put(mk.key, rest.slice(mk.valueFrom, i + 1 < marks.length ? marks[i + 1].at : rest.length)));
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

  // Fail-closed (PARTIAL_INDEX_ACCEPTANCE = NOT_ALLOWED_IN_B1): the whole index is unavailable, no card is served,
  // and the response carries diagnostics instead of instructing the (in-app) agent to perform an impossible action.
  function failClosed(base, parseStatus, reasons, extra) {
    return Object.assign(base, { index_loaded: false, parse_status: parseStatus, diagnostics: { reasons }, partial_index_acceptance: 'NOT_ALLOWED_IN_B1',
      note: 'Fail-closed: the Evidence Index could not be trusted (' + parseStatus + '), so NO research cards are served and nothing was inferred. ' +
        'Do not answer research questions from this call; tell the user research navigation is unavailable (parse_status above). `entrypoint` is the repository path of the index.' }, extra || {});
  }

  const isPositiveInteger = v => typeof v === 'number' && Number.isInteger(v) && v >= 1;
  const ALLOWED_ARGS = Object.freeze(['query', 'card', 'line']);   // `line` is an alias of `card`

  // Pure argument preflight: decides whether a request is valid WITHOUT touching the network, the index or any loader.
  // Returns { error } (a VALIDATION response) or { cardNumber, query } (query is null when absent/blank-with-card).
  function preflightArgs(args) {
    if (args === undefined) args = {};   // only a genuinely omitted argument object means {}; null / 0 / false / "" / [] are rejected
    // strict plain object (prototype exactly Object.prototype): class instances, Object.create(proto / null), Date / Map / Set / RegExp ... are rejected
    if (!(typeof args === 'object' && args !== null && !Array.isArray(args) && Object.getPrototypeOf(args) === Object.prototype && Object.prototype.toString.call(args) === '[object Object]')) return { error: validation('arguments must be an object, or omitted entirely. Nothing was executed.') };
    const unknown = Object.keys(args).filter(k => !ALLOWED_ARGS.includes(k));
    if (unknown.length) return { error: validation('Unknown argument(s) for research_route: ' + unknown.join(', ') + '. Allowed: ' + ALLOWED_ARGS.join(', ') + '. Nothing was executed.') };
    const hasCard = args.card != null, hasLine = args.line != null;
    if (args.query != null && typeof args.query !== 'string') return { error: validation('query must be a string.') };
    const hasQuery = typeof args.query === 'string' && args.query.trim() !== '';   // a blank optional query is ABSENT ...
    for (const [name, present] of [['card', hasCard], ['line', hasLine]]) if (present && !isPositiveInteger(args[name])) return { error: validation(name + ' must be a positive integer research card number (a number, not a string).') };
    if (hasCard && hasLine && args.card !== args.line) return { error: validation('Provide either card or line (alias), not conflicting values.') };
    const cardNumber = hasCard ? args.card : hasLine ? args.line : null;
    if (cardNumber != null && hasQuery) return { error: validation('Provide either card/line or query, not both.') };
    // ... but a blank query with no card is no routing request at all
    if (args.query != null && !hasQuery && cardNumber == null) return { error: validation('query must be a non-empty string; omit it for the overview, or give card.') };
    return { cardNumber, query: hasQuery ? args.query : null };
  }

  // THE strict document-validity contract of the Research Index, as ONE pure function. The router serves cards only from
  // a document that passes it, and the service worker admits a network 200 into the last-known-good cache (and serves a
  // cached fallback) only if it passes the SAME function. Gates, in order: index marker + section C -> authority contract
  // -> cards parsed -> unique card numbers -> required card fields -> no unsupported/unrecognised/duplicate card content.
  // Returns { ok:true, authority, cards } or { ok:false, parseStatus, reasons, extra }.
  function validateResearchIndex(markdown) {
    if (!looksLikeIndex(markdown)) {
      const unavailable = markdown == null || markdown === '';
      return { ok: false, parseStatus: unavailable ? 'INDEX_UNAVAILABLE' : 'NOT_AN_EVIDENCE_INDEX', reasons: [unavailable ? 'index text could not be obtained' : 'body lacks the RESEARCH_INDEX_ONLY marker or the "## C." section'], extra: {} };
    }
    const authority = parseAuthorityContract(markdown);
    if (!authority.valid) {
      return { ok: false, parseStatus: 'AUTHORITY_CONTRACT_INVALID', reasons: authority.problems.slice(0, MAX_ISSUES_REPORTED), withholdHeader: true,
        extra: { authority_contract: { valid: false, required: Object.assign({}, AUTHORITY_REQUIRED), found: authority.found, problems: authority.problems.slice(0, MAX_ISSUES_REPORTED) } } };
    }
    const cards = parseCards(markdown);
    if (!cards.length) return { ok: false, parseStatus: 'NO_CARDS_PARSED', reasons: ['header found but no "### N. title" cards were parsed under "## C."'], extra: {} };
    const seen = new Map(); for (const c of cards) seen.set(c.number, (seen.get(c.number) || 0) + 1);
    const duplicated = [...seen].filter(([, n]) => n > 1);
    if (duplicated.length) {
      return { ok: false, parseStatus: 'DUPLICATE_CARD_NUMBER', reasons: duplicated.slice(0, MAX_ISSUES_REPORTED).map(([num, n]) => 'card number ' + num + ' appears ' + n + ' times'),
        extra: { duplicate_card_numbers: duplicated.slice(0, MAX_ISSUES_REPORTED).map(([num]) => num) } };
    }
    const malformed = cards.map(c => ({ card_number: c.number, missing: REQUIRED_FIELDS.filter(k => !(c.fields[k] && c.fields[k].trim())) })).filter(m => m.missing.length);
    if (malformed.length) {
      return { ok: false, parseStatus: 'MALFORMED_CARDS', reasons: malformed.slice(0, MAX_MALFORMED_REPORTED).map(m => 'card ' + m.card_number + ': missing ' + m.missing.join(', ')),
        extra: { malformed_total: malformed.length, malformed_cards: malformed.slice(0, MAX_MALFORMED_REPORTED), required_fields: REQUIRED_FIELDS.slice() } };
    }
    const unsupported = cards.filter(c => c.issues.length).map(c => ({ card_number: c.number, issues: c.issues.slice(0, 3) }));
    if (unsupported.length) {
      return { ok: false, parseStatus: 'UNSUPPORTED_CARD_CONTENT',
        reasons: unsupported.slice(0, MAX_ISSUES_REPORTED).map(u => 'card ' + u.card_number + ': ' + u.issues.map(i => i.kind + (i.field ? ' ' + i.field : '')).join(', ')),
        extra: { unsupported_cards: unsupported.slice(0, MAX_ISSUES_REPORTED), unsupported_total: unsupported.length } };
    }
    return { ok: true, authority, cards };
  }

  function route(markdown, args, meta) {
    meta = meta || {};
    const pre = preflightArgs(args);
    if (pre.error) return pre.error;
    const cardNumber = pre.cardNumber, hasQuery = pre.query !== null;
    const base = { plane: 'RESEARCH', header: HEADER, notice: NOTICE, entrypoint: INDEX_PATH, read_only: true, promoted_to_working: false,
      index_source: meta.source || 'UNKNOWN' };
    // A cached fallback (OFFLINE_CACHE / STALE_CACHE) must never look like fresh navigation.
    base.stale = base.index_source === 'NETWORK' ? false : (base.index_source === 'OFFLINE_CACHE' || base.index_source === 'STALE_CACHE') ? true : null;
    if (base.stale === true) base.warning = 'STALE: this research navigation comes from a cached copy of the index (' + base.index_source + '), not a fresh network read; it may not reflect the current index. Say so when relying on it.';

    const verdict = validateResearchIndex(markdown);
    if (!verdict.ok) {
      let status = verdict.parseStatus;
      if (status === 'INDEX_UNAVAILABLE' && meta.error) status = 'FETCH_FAILED';
      if (verdict.withholdHeader) delete base.header;   // the router's own header claim is withheld for a document that contradicts it
      return failClosed(base, status, verdict.reasons, verdict.extra);
    }
    const authority = verdict.authority, cards = verdict.cards;
    Object.assign(base, { index_loaded: true, parse_status: 'OK', total_cards: cards.length, authority_contract: { valid: true, declared: authority.declared } });

    const numbers = list => ({ numbers: list.slice(0, MAX_NUMBERS), truncated: list.length > MAX_NUMBERS });
    if (cardNumber == null && !hasQuery) {
      const shown = cards.slice(0, MAX_LIST);
      return Object.assign(base, { cards: shown.map(listEntry), truncated: cards.length > MAX_LIST,
        card_numbers: numbers(cards.map(c => c.number)).numbers, omitted_card_numbers: numbers(cards.slice(MAX_LIST).map(c => c.number)).numbers,
        note: (base.warning ? base.warning + ' ' : '') + 'Overview (fields verbatim, clipped per truncated_fields). Pass card (number) for the complete card; omitted_card_numbers lists cards not shown here.' });
    }
    let matches;
    if (cardNumber != null) matches = cards.filter(c => c.number === cardNumber);
    else {
      const terms = pre.query.trim().toLowerCase().split(/\s+/);
      matches = cards.filter(c => {
        const hay = (c.title + '\n' + SEARCH_KEYS.map(k => c.fields[k] || '').join('\n')).toLowerCase();
        return terms.every(t => hay.includes(t));
      });
    }
    // Every matching card number is discoverable: cards are returned in full only up to MAX_CARDS,
    // the remaining matches are listed in omitted_card_numbers (fetch each with { card: N }).
    const direct = cardNumber != null;
    const shown = matches.slice(0, MAX_CARDS), allNumbers = numbers(matches.map(c => c.number)), omitted = numbers(matches.slice(MAX_CARDS).map(c => c.number));
    // A direct { card: N } request returns every field COMPLETE (no clipping); only query results are clipped.
    const views = shown.map(c => projectCard(c, FIELD_KEYS, direct ? Infinity : CARD_FIELD_CHARS));
    const anyClipped = views.some(v => v.truncated_fields.length);
    let note;
    if (!matches.length) note = 'No card in the current index matches. This is not evidence that no such research exists.';
    else {
      note = 'Fields are verbatim from the index; null = field absent; caveat fields (CONSISTENCY, NOTES, ...) are part of the card. Verify at PRIMARY_EVIDENCE.';
      if (direct) note += ' Direct card: all fields are complete.';
      if (matches.length > MAX_CARDS) note += ' Only the first ' + MAX_CARDS + ' matching cards are shown in full: call again with { card: N } for each number in omitted_card_numbers.';
      if (anyClipped) note += ' Some fields are clipped here (see truncated_fields): call { card: N } for the complete card.';
    }
    if (base.warning) note = base.warning + ' ' + note;
    return Object.assign(base, { matched: matches.length, matched_card_numbers: allNumbers.numbers, matched_card_numbers_truncated: allNumbers.truncated,
      truncated: matches.length > MAX_CARDS, omitted_card_numbers: omitted.numbers, cards: views, note });
  }

  // Loader may return a string or { text, source }; failures degrade to pointer-only, never throw.
  async function routeWithLoader(loader, args) {
    const pre = preflightArgs(args);   // a request known to be invalid fails BEFORE the loader / network is touched
    if (pre.error) return pre.error;
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

  return Object.freeze({ INDEX_PATH, HEADER, NOTICE, FIELD_KEYS, REQUIRED_FIELDS, ALLOWED_ARGS, AUTHORITY_REQUIRED, parseAuthorityContract, validateResearchIndex, preflightArgs, clipCodePoints, MAX_CARDS, OFFLINE_HEADER, OFFLINE_VALUE, STALE_VALUE, looksLikeIndex, parseCards, route, routeWithLoader });
});
