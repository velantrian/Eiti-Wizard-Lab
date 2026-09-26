// wiz-memory-admission.js — Memory Admission Controller v0.1 · REVIEW MODE ONLY (lab, step 2: apply / dismiss)
// ─────────────────────────────────────────────────────────────────────────────
// Status: RESEARCH/LAB · NOT CANON · NOT RUNTIME AUTHORIZATION · NOT A GLOBAL MEMORY OWNER ·
// NOT AN AUTOMATIC MEMORY WRITER · NOT AN E0-A REPLACEMENT. See docs/MEMORY_ADMISSION_REVIEW.md.
//
// An incoming information object ("memory passport") is validated, related wiz_ref_* records are
// retrieved READ-ONLY from wiz_ref_*, deterministic hard rules are applied, and a transparent
// REVIEW PACKET is produced and staged in the lab-only table wiz_admission_reviews with
// review_state = 'AWAITING_REVIEW'. Nothing else happens until an explicit user decision:
//   PREPARE → AWAITING_REVIEW → APPLY (execute exactly the prepared write plan) or DISMISS (no reference write).
//
//   LLM OUTPUT ≠ MEMORY DECISION · SIMILARITY ≠ IDENTITY ≠ DUPLICATE ≠ SUPERSESSION ·
//   NEW INFORMATION ≠ NEW MEMORY · RETRIEVED ≠ EVIDENCE · RELATION ≠ TRUTH
//
// ZERO-WRITE GUARANTEE (audit rev 1): this file contains NO statement that writes wiz_ref_* tables and calls
// NO WizRef function that takes a db (WizRef.search/trace/… run WizRef.initSchema, which can migrate/backfill/
// repair wiz_ref_*). Retrieval is this file's own SELECT-only SQL, executed under PRAGMA query_only=ON inside a
// SAVEPOINT that is always rolled back; wiz_ref_* is snapshotted (schema + every row, incl. meta/pins/FTS shadow
// tables) before, after and at staging time — any difference aborts with nothing staged. A legacy or repair-needing
// reference DB is never migrated or repaired here → UNCERTAIN with a warning. prepare() writes only
// wiz_admission_reviews; dismiss() writes only wiz_admission_reviews / wiz_admission_actions (wiz_ref_* verified
// unchanged).
//
// STEP 2 — the ONE reference write path: apply() → _applyTx() → a single WizRef.importJSONL() call that imports
// exactly write_plan.import_bundle (built and shown at prepare time, sealed by packet_sha256). Before it: integrity
// check, authority check (plan-required authority only from a host authority token — a click is never authority),
// full stale-plan check. Around it: one outer SAVEPOINT covering import + exact-effect verification + review record
// update; any failure rolls everything back (SQLite-atomic). Persistence (browser, step 2 rev 1): the action runs on
// an isolated copy; that candidate is written to IndexedDB first and becomes live only in a synchronous
// check-and-swap if the live database did not change meanwhile — otherwise it is rebuilt on top of the new live
// database (concurrent writes are carried, never dropped); on failure the live database is what gets saved. See
// _durable for the exact guarantee and its limits. No other code in this file writes wiz_ref_*.
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.WizAdmission = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  const VERSION = '0.1-step2-rev1';
  // The ONLY admission mode. There is no AUTO / AUTONOMOUS / BACKGROUND_ADMIT / AUTO_PROMOTE / AUTO_MERGE.
  const ADMISSION_MODE = 'REVIEW';
  // CLOSED outcome enum — exactly these 8 values, frozen.
  const OUTCOMES = Object.freeze(['DUPLICATE', 'REFINEMENT', 'NEW_EVIDENCE', 'CONTRADICTION',
    'NEW_RELATED_ITEM', 'STATUS_CHANGE', 'OUT_OF_SCOPE', 'UNCERTAIN']);
  // Review WORKFLOW state (not an epistemic status). prepare writes AWAITING_REVIEW; apply → APPLIED; dismiss → DISMISSED.
  const REVIEW_STATES = Object.freeze(['AWAITING_REVIEW', 'APPLIED', 'DISMISSED']);
  // Memory passport
  const PASSPORT_FIELDS = Object.freeze(['WHAT', 'SOURCE', 'WHO', 'WHEN', 'SCOPE', 'ENTITY', 'GOAL', 'TYPE', 'STATUS',
    'RELATIONS', 'RATIONALE', 'EVIDENCE', 'CONFIDENCE', 'VALIDITY', 'SUPERSEDES', 'EXPIRY', 'PROVENANCE']);
  const REQUIRED_FIELDS = Object.freeze(['WHAT', 'SOURCE', 'WHO', 'WHEN', 'SCOPE', 'TYPE', 'STATUS', 'PROVENANCE']);
  // Typed extension inputs (external, explicit — never inferred from similarity)
  const TYPED_INPUTS = Object.freeze(['MODE', 'ITEM_ID', 'REFINES', 'EQUIVALENT_TO', 'PROPOSED_STATUS_CHANGE']);
  // Relation types a NEW_RELATED_ITEM may use (subset of the Reference Memory contract; the others have
  // their own outcome — CONTRADICTS → CONTRADICTION, SUPPORTS/COUNTEREVIDENCE → NEW_EVIDENCE — and
  // SUPERSEDES is never proposed by admission v0.1).
  const RELATED_ITEM_RELATION_TYPES = Object.freeze(['RELATED_TO', 'DERIVED_FROM', 'ROUTES_TO', 'OWNS', 'TESTED_BY', 'IMPLEMENTED_IN', 'DOCUMENTED_IN']);
  const EVIDENCE_DIRECTIONS = Object.freeze(['SUPPORTS', 'COUNTEREVIDENCE']);
  const VERIFIED_LIKE = Object.freeze(['VERIFIED', 'VALIDATED', 'QUALIFIED', 'CANON', 'CONFIRMED', 'TRUE', 'PROD_AUTH']);
  // Hard-blocked status transitions (never proposed, not even for review)
  const FORBIDDEN_TRANSITIONS = Object.freeze([['UNKNOWN', 'FALSE'], ['CANDIDATE', 'VERIFIED'], ['RESEARCH_RESULT', 'PROD_AUTH'], ['MODEL_PROPOSAL', 'USER_DECISION']]);
  const EQUIVALENCE_DECLARERS = Object.freeze(['USER', 'EXTERNAL_SYSTEM']);
  const MODEL_RE = /\b(MODEL|LLM|AI|AGENT|ASSISTANT|GPT|CLAUDE|GROK)\b|MODEL_/i;

  const TABLE = 'wiz_admission_reviews';
  const DDL = `CREATE TABLE IF NOT EXISTS ${TABLE} (
    review_id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    mode TEXT NOT NULL DEFAULT 'REVIEW' CHECK (mode = 'REVIEW'),
    incoming_json TEXT NOT NULL,
    candidate_json TEXT NOT NULL,
    proposed_outcome TEXT NOT NULL CHECK (proposed_outcome IN ('DUPLICATE','REFINEMENT','NEW_EVIDENCE','CONTRADICTION','NEW_RELATED_ITEM','STATUS_CHANGE','OUT_OF_SCOPE','UNCERTAIN')),
    rationale TEXT NOT NULL,
    affected_records_json TEXT NOT NULL,
    write_plan_json TEXT NOT NULL,
    review_state TEXT NOT NULL DEFAULT 'AWAITING_REVIEW' CHECK (review_state IN ('AWAITING_REVIEW','APPLIED','DISMISSED')),
    reviewed_at INTEGER,
    packet_json TEXT NOT NULL,
    packet_sha256 TEXT
  )`;
  const DDL_INDEX = `CREATE INDEX IF NOT EXISTS idx_wiz_admission_reviews_state ON ${TABLE}(review_state, created_at)`;
  // step 2 (additive): seal of the exact prepared packet (tamper check before apply) — for tables created by step 1
  const DDL_ADD_PACKET_SHA = `ALTER TABLE ${TABLE} ADD COLUMN packet_sha256 TEXT`;
  // step 2: append-only record of review ACTIONS (apply / dismiss attempts and their results). The prepared packet is
  // never rewritten; history = what was proposed THEN (packet_json) + what happened at each action NOW (this table).
  const ACTIONS_TABLE = 'wiz_admission_actions';
  const ACTION_RESULTS = Object.freeze(['APPLIED', 'DISMISSED', 'REFUSED', 'STALE_REVIEW', 'INTEGRITY_FAILED', 'FAILED']);
  const DDL_ACTIONS = `CREATE TABLE IF NOT EXISTS ${ACTIONS_TABLE} (
    action_id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('APPLY','DISMISS')),
    requested_at INTEGER NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('APPLIED','DISMISSED','REFUSED','STALE_REVIEW','INTEGRITY_FAILED','FAILED')),
    review_state_after TEXT NOT NULL CHECK (review_state_after IN ('AWAITING_REVIEW','APPLIED','DISMISSED')),
    result_json TEXT NOT NULL
  )`;
  const DDL_ACTIONS_INDEX = `CREATE INDEX IF NOT EXISTS idx_wiz_admission_actions_review ON ${ACTIONS_TABLE}(review_id, requested_at)`;

  // WizRef is used ONLY for constants (ENUMS.item_type, SCHEMA_VERSION) and the pure hash helper sha256Hex (no db
  // argument). No WizRef function that takes a db is ever called: search/trace/getSource/project/resolveRelation/
  // stats/exportJSONL all run WizRef.initSchema(), which can migrate/backfill/repair wiz_ref_* (audit rev 1, P1-1).
  const WizRefApi = () => (root && root.WizRef) || (typeof require === 'function' ? (() => { try { return require('./wiz-ref-memory.js'); } catch (e) { return null; } })() : null);
  // Reference Memory schema this read-only reader understands. Anything else → no retrieval, UNCERTAIN.
  const REF_SCHEMA_VERSION = '3';
  const REF_TABLES = Object.freeze(['wiz_ref_sources', 'wiz_ref_items', 'wiz_ref_relations', 'wiz_ref_meta', 'wiz_ref_items_fts']);
  const REF_COLUMNS = Object.freeze({
    wiz_ref_items: ['item_id', 'source_id', 'project_id', 'item_type', 'claim', 'source_status', 'epistemic_state', 'as_of', 'provenance',
      'lifecycle', 'capture_backfilled', 'logical_item_id', 'version_id', 'source_title_at_capture', 'source_surface_at_capture',
      'source_kind_at_capture', 'source_authority_class_at_capture', 'source_revision_at_capture', 'source_as_of_at_capture', 'source_content_hash_at_capture'],
    wiz_ref_sources: ['source_id', 'title', 'surface', 'source_kind', 'authority_class', 'revision', 'as_of'],
    wiz_ref_relations: ['relation_id', 'relation_type', 'epistemic_status', 'record_hash', 'from_version_id', 'to_version_id', 'pin_backfilled'],
  });

  // ── schema (additive: two lab tables + indexes; never touches wiz_ref_* or personal memory) ──
  function initSchema(db) {
    if (!db) return false;
    db.run(DDL); db.run(DDL_INDEX);
    if (!_rowsRaw(db, `PRAGMA table_info(${TABLE})`).some(r => r[1] === 'packet_sha256')) db.run(DDL_ADD_PACKET_SHA);
    db.run(DDL_ACTIONS); db.run(DDL_ACTIONS_INDEX);
    return true;
  }

  // ── helpers ──
  const _s = v => (v === undefined || v === null ? '' : String(v)).trim();
  const normText = v => _s(v).normalize('NFC').replace(/\s+/g, ' ');
  const isModel = v => MODEL_RE.test(_s(v));
  // READ-ONLY query helpers (db.prepare + step; callers pass SELECT / PRAGMA table_info only)
  function _rowsRaw(db, sql, p) { const st = db.prepare(sql); st.bind(p || []); const o = []; while (st.step()) o.push(st.get()); st.free(); return o; }
  function _rowsObj(db, sql, p) { const st = db.prepare(sql); st.bind(p || []); const o = []; while (st.step()) o.push(st.getAsObject()); st.free(); return o; }
  const _one = (db, sql, p) => { const r = _rowsRaw(db, sql, p)[0]; return r ? r[0] : null; };
  const _hasObj = (db, name) => _rowsRaw(db, "SELECT 1 FROM sqlite_master WHERE name=?", [name]).length > 0;
  function refInitialised(db) { return _hasObj(db, 'wiz_ref_items'); }
  function _stable(v) { // canonical JSON (sorted keys) for provenance comparison
    if (Array.isArray(v)) return '[' + v.map(_stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function canonProvenance(v) {
    if (v === undefined || v === null || v === '') return '';
    if (typeof v === 'object') return _stable(v);
    const t = String(v).trim();
    try { const j = JSON.parse(t); if (j && typeof j === 'object') return _stable(j); } catch (e) { /* plain text provenance */ }
    return normText(t);
  }
  function _randHex(n) {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || (root && root.crypto) || null;
    const b = new Uint8Array(Math.ceil(n / 2));
    if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b); else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
    return Array.from(b, x => x.toString(16).padStart(2, '0')).join('').slice(0, n);
  }

  // Fingerprint of ALL wiz_ref_* objects: schema rows of sqlite_master + every row of every wiz_ref* table
  // (incl. wiz_ref_meta/schema_version, relation pins and the FTS shadow tables), order-independent. Read-only.
  function refSnapshot(db) {
    const hex = u => Array.from(u, b => b.toString(16).padStart(2, '0')).join('');
    const enc = v => (v instanceof Uint8Array ? 'x' + hex(v) : v);
    const schema = _rowsRaw(db, "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name GLOB 'wiz_ref*' OR tbl_name GLOB 'wiz_ref*' ORDER BY type, name");
    const out = { schema, tables: {} };
    for (const [type, name] of schema) {
      if (type !== 'table') continue;
      out.tables[name] = _rowsRaw(db, `SELECT * FROM "${name.replace(/"/g, '""')}"`).map(r => JSON.stringify(r.map(enc))).sort();
    }
    return JSON.stringify(out);
  }
  async function refFingerprint(db) { return WizRefApi().sha256Hex(refSnapshot(db)); }

  // ── Reference Memory readiness (read-only; NEVER migrates or repairs — that is WizRef.initSchema's job) ──
  // ABSENT: no wiz_ref_items · NEEDS_MIGRATION: not schema v3 / tables or columns missing → nothing is read ·
  // NEEDS_REPAIR: v3 but rows the WizRef initSchema would backfill/repair → read what is readable, outcome UNCERTAIN ·
  // READY: v3 and consistent.
  function refReadiness(db) {
    if (!refInitialised(db)) return { state: 'ABSENT', readable: false, schema_version: null, issues: ['wiz_ref_items does not exist'] };
    const issues = [];
    const missingTables = REF_TABLES.filter(t => !_hasObj(db, t));
    if (missingTables.length) issues.push('missing tables: ' + missingTables.join(', '));
    const ver = missingTables.includes('wiz_ref_meta') ? null : _one(db, "SELECT value FROM wiz_ref_meta WHERE key='schema_version'");
    if (_s(ver) !== REF_SCHEMA_VERSION) issues.push(`schema_version ${ver == null ? '(none)' : ver} ≠ ${REF_SCHEMA_VERSION}`);
    const W = WizRefApi();
    if (W && W.SCHEMA_VERSION !== undefined && String(W.SCHEMA_VERSION) !== REF_SCHEMA_VERSION) issues.push(`loaded WizRef is schema v${W.SCHEMA_VERSION}; this reader understands v${REF_SCHEMA_VERSION} only`);
    for (const [t, cols] of Object.entries(REF_COLUMNS)) {
      if (missingTables.includes(t)) continue;
      const have = new Set(_rowsRaw(db, `PRAGMA table_info(${t})`).map(r => r[1]));
      const miss = cols.filter(c => !have.has(c));
      if (miss.length) issues.push(`${t} lacks columns: ${miss.join(', ')}`);
    }
    if (issues.length) return { state: 'NEEDS_MIGRATION', readable: false, schema_version: ver, issues };
    const cnt = (label, sql) => { const n = Number(_one(db, sql)) || 0; if (n) issues.push(`${n} ${label}`); };
    cnt('item rows without version_id', 'SELECT count(*) FROM wiz_ref_items WHERE version_id IS NULL');
    cnt('item rows without capture provenance', 'SELECT count(*) FROM wiz_ref_items WHERE source_title_at_capture IS NULL AND COALESCE(capture_backfilled,0)=0');
    cnt('item rows missing from wiz_ref_items_fts', 'SELECT count(*) FROM wiz_ref_items WHERE item_id NOT IN (SELECT item_id FROM wiz_ref_items_fts)');
    cnt('relations without record_hash', 'SELECT count(*) FROM wiz_ref_relations WHERE record_hash IS NULL');
    cnt('relations without version pins', 'SELECT count(*) FROM wiz_ref_relations WHERE from_version_id IS NULL AND to_version_id IS NULL AND COALESCE(pin_backfilled,0)=0');
    if (issues.length) return { state: 'NEEDS_REPAIR', readable: true, schema_version: ver, issues };
    return { state: 'READY', readable: true, schema_version: ver, issues: [] };
  }

  // ── passport normalisation + validation ──
  function normalizeIncoming(incoming) {
    const errors = [], warnings = [];
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) return { errors: ['incoming must be a JSON object (memory passport)'], warnings, inc: null };
    const inc = {};
    for (const [k, v] of Object.entries(incoming)) {
      const K = String(k).toUpperCase();
      if (PASSPORT_FIELDS.includes(K) || TYPED_INPUTS.includes(K)) inc[K] = v;
      else warnings.push(`unknown passport field "${k}" ignored`);
    }
    if (inc.MODE !== undefined && _s(inc.MODE).toUpperCase() !== ADMISSION_MODE)
      errors.push(`MODE "${inc.MODE}" rejected — ADMISSION_MODE = REVIEW is the only mode (no AUTO/AUTONOMOUS/BACKGROUND_ADMIT/AUTO_PROMOTE/AUTO_MERGE)`);
    for (const f of REQUIRED_FIELDS) {
      const v = inc[f];
      const empty = v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
      if (empty) errors.push(`required passport field ${f} missing`);
    }
    if (typeof inc.WHAT === 'string') inc.WHAT = normText(inc.WHAT);
    else if (inc.WHAT !== undefined) errors.push('WHAT must be a string (the claim)');
    if (inc.SOURCE !== undefined) {
      if (typeof inc.SOURCE === 'string') inc.SOURCE = { source_id: _s(inc.SOURCE) };
      if (typeof inc.SOURCE !== 'object' || (!_s(inc.SOURCE.source_id) && !(_s(inc.SOURCE.title) && _s(inc.SOURCE.surface))))
        errors.push('SOURCE must name a source_id (or title + surface)');
    }
    if (inc.WHEN !== undefined && !/^\d{4}-\d{2}-\d{2}/.test(_s(inc.WHEN))) errors.push('WHEN must be an ISO date (YYYY-MM-DD…)');
    const W = WizRefApi();
    if (inc.TYPE !== undefined && W && !W.ENUMS.item_type.includes(_s(inc.TYPE))) errors.push(`TYPE "${inc.TYPE}" is not a Reference Memory item_type`);
    for (const f of ['WHO', 'SCOPE', 'STATUS', 'WHEN']) if (inc[f] !== undefined) inc[f] = _s(inc[f]);
    if (inc.RELATIONS !== undefined && !Array.isArray(inc.RELATIONS)) errors.push('RELATIONS must be an array of {relation_type, target_version_id}');
    return { errors, warnings, inc };
  }

  // ── caller context: semantic AUTHORITY vs. user INTERACTION (audit rev 1 P1-3, audit rev 2 P1-3b) ──
  //   USER_INTERACTION ≠ USER_AUTHORITY · PREPARE_REVIEW ≠ CONFIRM_EQUIVALENCE ≠ AUTHORIZE_STATUS_CHANGE
  // Two structurally separate, unforgeable token kinds, each in its own module-private WeakSet:
  //  • AUTHORITY tokens (_authTokens, passed as opts.caller): the only thing trustedAs() accepts. Minted ONLY by
  //    hostCallerContext(), which exists ONLY in a non-DOM host (node tests / a future host integration).
  //    The module does NOT authenticate that host: code able to call hostCallerContext('USER') must already be
  //    trusted, and a future real host owns the authority boundary. Future trusted USER authority may come only
  //    from (1) a separately verified user-authored event supplied by the host, or (2) a dedicated explicit
  //    confirmation action whose semantics name exactly what is confirmed. Neither exists in step 1.
  //  • INTERACTION tokens (_interactionTokens, passed as opts.interaction): audit/UI only — "a user clicked
  //    Prepare review". Minted by the browser glue from a genuine click. Never in _authTokens, never read by
  //    trustedAs(); passing one as opts.caller is ignored like any other untrusted value.
  // Authority never comes from the incoming JSON. Default = UNTRUSTED, no interaction. In the browser there is NO
  // path that yields a trusted authority token.
  const TRUSTED_CALLER_KINDS = Object.freeze(['USER', 'EXTERNAL_SYSTEM']);
  const INTERACTION_KINDS = Object.freeze(['USER_INTERACTION']);
  const _authTokens = new WeakSet();
  const _interactionTokens = new WeakSet();
  function _mintAuthority(kind, via) {
    if (!TRUSTED_CALLER_KINDS.includes(kind)) throw new Error('caller kind must be one of ' + TRUSTED_CALLER_KINDS.join('/'));
    const t = Object.freeze({ kind, via: String(via || 'host') }); _authTokens.add(t); return t;
  }
  function _mintInteraction(via) { // NOT authority: no `kind` field, never added to _authTokens
    const t = Object.freeze({ interaction: 'USER_INTERACTION', via: String(via || 'unknown') }); _interactionTokens.add(t); return t;
  }
  function callerOf(opts) {
    const c = opts && opts.caller, i = opts && opts.interaction;
    const interaction = i && typeof i === 'object' && _interactionTokens.has(i) ? { interaction: 'USER_INTERACTION', interaction_via: i.via } : { interaction: 'NONE', interaction_via: null };
    if (c && typeof c === 'object' && _authTokens.has(c)) return Object.assign({ kind: c.kind, via: c.via, trusted: true }, interaction);
    return Object.assign({ kind: 'UNTRUSTED', via: c === undefined || c === null ? 'none' : 'unverified caller value ignored', trusted: false }, interaction);
  }
  const callerText = c => `${c.kind}${c.trusted ? '' : ', untrusted'}${c.interaction === 'USER_INTERACTION' ? '; USER_INTERACTION present — user interaction ≠ user authority' : ''}`;

  // ── read-only retrieval (own SELECT-only SQL; similarity only RANKS) ──
  const CAND_COLS = `i.item_id, i.logical_item_id, i.version_id, i.claim, i.item_type, i.epistemic_state, i.source_status,
      COALESCE(i.lifecycle,'ACTIVE') AS lifecycle, i.project_id, i.as_of, i.provenance, i.source_id, COALESCE(i.capture_backfilled,0) AS capture_backfilled,
      i.source_title_at_capture AS cap_title, i.source_surface_at_capture AS cap_surface, i.source_kind_at_capture AS cap_kind,
      i.source_authority_class_at_capture AS cap_authority_class, i.source_revision_at_capture AS cap_revision,
      i.source_as_of_at_capture AS cap_as_of, i.source_content_hash_at_capture AS cap_content_hash,
      s.title AS cur_title, s.surface AS cur_surface, s.source_kind AS cur_kind, s.authority_class AS cur_authority_class, s.revision AS cur_revision, s.as_of AS cur_as_of,
      (SELECT count(*) FROM wiz_ref_items c WHERE c.item_id = c.logical_item_id AND c.version_id = i.version_id) AS cur_count`;
  const CAND_FROM = 'FROM wiz_ref_items i LEFT JOIN wiz_ref_sources s ON s.source_id = i.source_id';
  const ACTIVE = "COALESCE(i.lifecycle,'ACTIVE')!='SUPERSEDED'";
  function _view(r) { // provenance-bearing, read-only view of one stored version (never a bare claim)
    const cap = (a, b) => (r[a] != null ? r[a] : r[b]);
    const src = { source_id: r.source_id, title: cap('cap_title', 'cur_title'), surface: cap('cap_surface', 'cur_surface'), kind: cap('cap_kind', 'cur_kind'),
      authority_class: cap('cap_authority_class', 'cur_authority_class'), revision: r.cap_revision, as_of: r.cap_as_of, content_hash: r.cap_content_hash,
      current_revision: r.cur_revision, current_as_of: r.cur_as_of };
    const caveats = [];
    if (src.surface === 'fixture') caveats.push('SYNTHETIC TEST FIXTURE — not Velantrim corpus');
    if (src.surface === 'demo' || src.authority_class === 'DEMO_ONLY') caveats.push('DEMO/EXAMPLE DATA — not a source fact');
    if (r.lifecycle === 'SUPERSEDED') caveats.push('SUPERSEDED (archived version)');
    if (r.capture_backfilled) caveats.push('CAPTURE PROVENANCE BACKFILLED at schema migration');
    if (r.cap_revision != null && r.cur_revision != null && String(r.cap_revision) !== String(r.cur_revision)) caveats.push(`SOURCE CHANGED SINCE CAPTURE (rev ${r.cap_revision} → ${r.cur_revision})`);
    const isCur = Number(r.cur_count) > 0;
    const block = [
      `[REFERENCE MEMORY · read-only admission view] ${r.project_id || '—'} / ${r.item_type} / ${r.epistemic_state || 'SOURCE_ASSERTION'}`,
      `source (at capture): ${src.title || '—'} (${r.source_id}; ${src.surface || '—'}/${src.kind || '—'}; authority=${src.authority_class || 'UNSPECIFIED'}${src.revision ? '; rev=' + src.revision : ''}${src.as_of ? '; as_of=' + src.as_of : ''})`,
      `version: ${r.version_id || '—'}${isCur ? ' (current)' : ' (archived version of ' + (r.logical_item_id || '—') + ')'} · as_of: ${r.as_of || 'UNKNOWN'}${r.provenance ? ' · provenance: ' + r.provenance : ''}`,
      `claim (source-bound, not verified truth): ${r.claim}`,
      ...caveats.map(c => '⚠ ' + c),
    ].join('\n');
    return { item_id: r.item_id, logical_item_id: r.logical_item_id, version_id: r.version_id, is_current_version: isCur,
      claim: r.claim, item_type: r.item_type, epistemic_state: r.epistemic_state || 'SOURCE_ASSERTION', source_status: r.source_status,
      lifecycle: r.lifecycle, project_id: r.project_id, as_of: r.as_of, provenance: r.provenance, capture_backfilled: !!r.capture_backfilled,
      source: src, caveats, block };
  }
  function _relations(db, versionId) {
    const q = col => _rowsObj(db, `SELECT relation_id, relation_type, from_version_id, to_version_id, epistemic_status FROM wiz_ref_relations WHERE ${col}=? ORDER BY relation_type, relation_id`, [versionId]);
    return { outgoing: q('from_version_id'), incoming: q('to_version_id') };
  }
  function ftsSearch(db, text, scope, limit) { // FTS5/BM25 ranking over current versions in scope; AND first, OR fallback
    const terms = (String(text || '').match(/[\p{L}\p{N}_]{2,}/gu) || []).map(t => '"' + t.replace(/"/g, '') + '"*');
    if (!terms.length) return { rows: [], mode: 'none' };
    const run = m => { try { return _rowsObj(db, `SELECT ${CAND_COLS}, bm25(wiz_ref_items_fts) AS score FROM wiz_ref_items_fts JOIN wiz_ref_items i ON i.item_id = wiz_ref_items_fts.item_id LEFT JOIN wiz_ref_sources s ON s.source_id = i.source_id
      WHERE wiz_ref_items_fts MATCH ? AND i.project_id = ? AND ${ACTIVE} ORDER BY score LIMIT ?`, [m, scope, limit]); }
      catch (e) { if (/fts5: syntax error|malformed MATCH|unterminated string/i.test(String(e && e.message))) return []; throw e; } }; // only FTS query-syntax errors are tolerated; anything else (e.g. a refused write) aborts
    let rows = run(terms.join(' ')), mode = 'all';
    if (!rows.length && terms.length > 1) { rows = run(terms.join(' OR ')); mode = 'any'; }
    return { rows, mode };
  }
  function retrieveCandidates(db, inc, opts) {
    const limit = Math.max(1, Math.min(Number((opts || {}).candidate_limit) || 8, 25));
    const { rows, mode } = ftsSearch(db, inc.WHAT, inc.SCOPE, limit);
    return rows.map((r, i) => {
      const v = _view(r);
      return Object.assign({ rank: i + 1 }, v, {
        relations: _relations(db, r.version_id),
        similarity: { method: 'FTS5/BM25 (read-only SELECT)', match_mode: mode, note: 'RANK ONLY — similarity never sets the outcome' },
        deterministic: { same_logical_item: !!(inc.ITEM_ID && r.logical_item_id === _s(inc.ITEM_ID)), identical_claim_text: normText(r.claim) === inc.WHAT },
      });
    });
  }
  // exact version lookup (no fuzzy resolution): the stored version with exactly this version_id
  function exactVersion(db, versionId) {
    if (!_s(versionId)) return null;
    const r = _rowsObj(db, `SELECT ${CAND_COLS} ${CAND_FROM} WHERE i.version_id=? ORDER BY (i.item_id=i.version_id) DESC LIMIT 1`, [_s(versionId)])[0];
    return r ? _view(r) : null;
  }
  // all stored versions (current + archived) of a logical item id
  function versionsOf(db, logicalId) {
    return _rowsObj(db, `SELECT ${CAND_COLS} ${CAND_FROM} WHERE i.logical_item_id=? ORDER BY (i.item_id=i.logical_item_id) DESC, i.item_id`, [_s(logicalId)]).map(_view);
  }
  const itemIdExists = (db, id) => !!_s(id) && _rowsRaw(db, 'SELECT 1 FROM wiz_ref_items WHERE item_id=? OR logical_item_id=? LIMIT 1', [_s(id), _s(id)]).length > 0;
  // versions in scope whose claim text is identical (normalized) to the incoming claim — full scan, no limit
  function identicalText(db, inc) {
    return _rowsObj(db, `SELECT ${CAND_COLS} ${CAND_FROM} WHERE i.project_id=? AND i.item_type=?`, [inc.SCOPE, inc.TYPE]).filter(r => normText(r.claim) === inc.WHAT).map(_view);
  }

  // ── DUPLICATE identity rule (audit rev 1, P1-2) ──
  // DUPLICATE by identity requires ITEM_ID = the logical item id AND every field below equal to the stored
  // version, compared against that version's CAPTURE provenance (never the current source record):
  const DUPLICATE_MATCH_FIELDS = Object.freeze(['claim', 'item_type', 'scope', 'source_id', 'status', 'when', 'provenance', 'source_revision', 'source_as_of', 'source_content_hash']);
  function duplicateMismatches(inc, v) {
    const S = inc.SOURCE || {};
    const pairs = {
      claim: [inc.WHAT, normText(v.claim)], item_type: [inc.TYPE, v.item_type], scope: [inc.SCOPE, v.project_id],
      source_id: [S.source_id, v.source.source_id], status: [inc.STATUS, v.epistemic_state], when: [inc.WHEN, v.as_of],
      provenance: [canonProvenance(inc.PROVENANCE), canonProvenance(v.provenance)],
      source_revision: [S.revision, v.source.revision], source_as_of: [S.as_of, v.source.as_of], source_content_hash: [S.content_hash, v.source.content_hash],
    };
    const out = DUPLICATE_MATCH_FIELDS.filter(f => _s(pairs[f][0]) !== _s(pairs[f][1]));
    if (v.capture_backfilled) out.push('capture_provenance_backfilled');
    return out;
  }

  // ── decision (deterministic; first matching rule wins; READ-ONLY) ──
  function decide(db, inc, candidates, opts) {
    const warnings = [], hard = [];
    const scope = (opts && opts.review_scope) || null;
    const caller = opts._caller;
    const res = (outcome, reason, extra) => Object.assign({ outcome, reason, warnings, hard_rules: hard, affected: [], relations: [], status_effect: { changes: [], note: 'no status change proposed' }, writes: [], basis: null }, extra || {});
    const ref = v => ({ version_id: v.version_id, logical_item_id: v.logical_item_id, item_id: v.item_id, claim: v.claim, epistemic_state: v.epistemic_state, is_current_version: v.is_current_version });
    const newId = opts._newLogicalId;
    const addItem = () => ({ op: 'ADD_ITEM', logical_item_id: newId, item_type: inc.TYPE, claim: inc.WHAT, status: inc.STATUS, scope: inc.SCOPE, source_id: inc.SOURCE.source_id || null });
    const trustedAs = kind => caller.trusted && caller.kind === kind && !isModel(inc.WHO);

    // 1) scope
    if (scope && Array.isArray(scope.project_ids) && scope.project_ids.length && !scope.project_ids.includes(inc.SCOPE))
      return res('OUT_OF_SCOPE', `incoming SCOPE "${inc.SCOPE}" is outside the controller review scope [${scope.project_ids.join(', ')}] — no reference write is proposed`, { basis: 'SCOPE_MISMATCH' });
    const rd = opts._readiness;
    if (rd.state === 'ABSENT') { warnings.push('REFERENCE_MEMORY_NOT_INITIALISED — no candidates could be retrieved'); return res('UNCERTAIN', 'reference memory is not initialised; nothing to compare against — human review required'); }
    if (rd.state !== 'READY') {
      warnings.push(`REFERENCE_MEMORY_${rd.state}: reference memory needs migration/repair (${rd.issues.join('; ')}); retrieval is read-only — nothing was migrated or repaired${rd.readable ? '; readable records shown as candidates' : '; no records read'}`);
      return res('UNCERTAIN', `reference memory is in state ${rd.state}; the admission controller never migrates or repairs it — human review required (run the normal Reference Memory boot/migration first)`, { affected: candidates.map(ref) });
    }

    // 2) hard rules on the incoming status (apply regardless of candidates)
    const st = inc.STATUS.toUpperCase();
    if (VERIFIED_LIKE.includes(st)) { hard.push('CLAIM WITHOUT SOURCE ↛ VERIFIED / USER SAID X ≠ X IS TRUE'); warnings.push(`HARD_RULE_BLOCKED: incoming STATUS "${inc.STATUS}" is VERIFIED-like; admission never admits a claim as verified`); return res('UNCERTAIN', 'incoming asserts a VERIFIED-like status; blocked by hard rule — human review required'); }
    if (st === 'USER_DECISION' && isModel(inc.WHO)) { hard.push('MODEL_PROPOSAL ↛ USER_DECISION'); warnings.push('HARD_RULE_BLOCKED: model-originated incoming cannot carry STATUS USER_DECISION'); return res('UNCERTAIN', 'model output declared as USER_DECISION; blocked by hard rule'); }
    if (st === 'USER_DECISION' && !trustedAs('USER')) { hard.push('LLM OUTPUT ≠ MEMORY DECISION'); warnings.push(`HARD_RULE_BLOCKED: STATUS USER_DECISION requires a trusted USER caller context (caller: ${callerText(caller)})`); return res('UNCERTAIN', 'STATUS USER_DECISION claimed without trusted USER caller context; the string in the passport is not proof'); }
    if (st === 'PROD_AUTH' && inc.TYPE === 'RESEARCH_RESULT') { hard.push('RESEARCH_RESULT ↛ PROD_AUTH'); return res('UNCERTAIN', 'RESEARCH_RESULT cannot carry PROD_AUTH; blocked by hard rule'); }

    // 3) deterministic DUPLICATE (hard identity only — never similarity, never identical text alone)
    //  3a) trusted, explicit, pre-declared equivalence
    if (inc.EQUIVALENT_TO) {
      const eq = typeof inc.EQUIVALENT_TO === 'object' ? inc.EQUIVALENT_TO : {}; const by = _s(eq.declared_by).toUpperCase();
      const v = exactVersion(db, eq.version_id);
      if (!v) { warnings.push(`EQUIVALENT_TO version "${eq.version_id}" is not an existing exact version`); return res('UNCERTAIN', 'EQUIVALENT_TO does not name an existing exact version — human review required'); }
      const aff = [ref(v)];
      if (!EQUIVALENCE_DECLARERS.includes(by) || isModel(eq.declared_by) || !trustedAs(by)) {
        hard.push('LLM OUTPUT ≠ MEMORY DECISION');
        warnings.push(`EQUIVALENT_TO declared_by "${eq.declared_by}" not accepted: requires declared_by ∈ ${EQUIVALENCE_DECLARERS.join('/')} with a matching TRUSTED caller context (caller: ${callerText(caller)}) and a non-model WHO (WHO: ${inc.WHO})`);
        return res('UNCERTAIN', 'declared equivalence is not backed by a trusted caller context — the passport cannot authorise itself; human review required', { affected: aff });
      }
      if (!_s(eq.basis)) { warnings.push('EQUIVALENT_TO without basis'); return res('UNCERTAIN', 'declared equivalence without basis — human review required', { affected: aff }); }
      return res('DUPLICATE', `equivalence pre-declared by trusted ${by} caller (basis: ${_s(eq.basis)}) to exact version ${v.version_id}`, { basis: 'DECLARED_EQUIVALENCE', affected: aff });
    }
    //  3b) exact ITEM_ID + compatible exact content (DUPLICATE_MATCH_FIELDS vs capture provenance)
    const idExists = itemIdExists(db, inc.ITEM_ID);
    if (inc.ITEM_ID && idExists) {
      const vers = versionsOf(db, inc.ITEM_ID);
      const cur = vers.find(v => v.is_current_version);
      const curMis = cur ? duplicateMismatches(inc, cur) : ['no current version'];
      if (cur && !curMis.length) return res('DUPLICATE', `same logical item_id ${inc.ITEM_ID} and exact compatible content (${DUPLICATE_MATCH_FIELDS.join('/')}) with current version ${cur.version_id}`, { basis: 'EXACT_IDENTITY_AND_CONTENT', affected: [ref(cur)] });
      const oldHit = vers.filter(v => !v.is_current_version && !duplicateMismatches(inc, v).length);
      if (oldHit.length) { hard.push('SUPERSEDED ≠ ERASED'); warnings.push(`incoming equals ARCHIVED version(s) ${oldHit.map(v => v.version_id).join(', ')} — not a duplicate of the current state`); return res('UNCERTAIN', 'incoming matches only an archived (superseded) version; re-assertion vs. revert needs human review', { affected: oldHit.map(ref) }); }
      warnings.push(`ITEM_ID ${inc.ITEM_ID} exists but content is not compatible with current version ${cur ? cur.version_id : '—'} (differs in: ${curMis.join(', ')}) — NOT a duplicate`);
    }
    //  3c) identical claim text WITHOUT identity → UNCERTAIN (never DUPLICATE)
    if (!(inc.ITEM_ID && idExists)) {
      const same = identicalText(db, inc);
      if (same.length) { warnings.push(`identical claim text exists in ${same.map(v => v.version_id).join(', ')} but no ITEM_ID identity (IDENTICAL TEXT ≠ SAME ITEM)`); return res('UNCERTAIN', 'identical claim text without deterministic identity — possible duplicate; human review required', { affected: same.map(ref) }); }
    }

    // 4) explicit typed intents (never inferred from candidates: RETRIEVED ≠ EVIDENCE, SIMILAR ≠ SAME)
    const rels = Array.isArray(inc.RELATIONS) ? inc.RELATIONS : [];
    const intents = (inc.REFINES ? 1 : 0) + rels.length + (inc.PROPOSED_STATUS_CHANGE ? 1 : 0);
    if (inc.SUPERSEDES) { warnings.push('SUPERSEDES given — supersession is not an admission outcome in v0.1; reviewer decides'); }
    if (intents > 1) return res('UNCERTAIN', `ambiguous typed intent (${intents} declared: REFINES/RELATIONS/PROPOSED_STATUS_CHANGE) — human review required`, { affected: candidates.map(ref) });

    if (inc.PROPOSED_STATUS_CHANGE) {
      const sc = inc.PROPOSED_STATUS_CHANGE || {};
      const v = exactVersion(db, sc.target_version_id);
      const missing = ['target_version_id', 'from_status', 'to_status', 'authority', 'evidence', 'rationale'].filter(f => !_s(typeof sc[f] === 'object' ? JSON.stringify(sc[f]) : sc[f]));
      if (missing.length) return res('UNCERTAIN', `status change without basis (missing ${missing.join(', ')}) — not proposed`, { affected: v ? [ref(v)] : [] });
      if (!v) return res('UNCERTAIN', `status change target ${sc.target_version_id} is not an existing exact version`);
      const from = _s(sc.from_status).toUpperCase(), to = _s(sc.to_status).toUpperCase(), cur = _s(v.epistemic_state).toUpperCase();
      const aff = [ref(v)];
      if (from !== cur) return res('UNCERTAIN', `declared from_status ${from} ≠ current status ${cur} of ${v.version_id} (stale request)`, { affected: aff });
      const forb = FORBIDDEN_TRANSITIONS.find(([a, b]) => a === from && b === to)
        || (v.item_type === 'RESEARCH_RESULT' && to === 'PROD_AUTH' ? ['RESEARCH_RESULT', 'PROD_AUTH'] : null)
        || (to === 'USER_DECISION' && (isModel(inc.WHO) || isModel(sc.authority)) ? ['MODEL_PROPOSAL', 'USER_DECISION'] : null);
      if (forb) { hard.push(`${forb[0]} ↛ ${forb[1]}`); warnings.push(`HARD_RULE_BLOCKED: ${forb[0]} → ${forb[1]}`); return res('UNCERTAIN', `status transition ${from} → ${to} is forbidden by hard rule ${forb[0]} ↛ ${forb[1]}`, { affected: aff }); }
      // authority is only what the TRUSTED caller context proves — the authority string in the JSON is a claim
      const auth = _s(sc.authority).toUpperCase();
      if (!TRUSTED_CALLER_KINDS.includes(auth) || !trustedAs(auth)) {
        hard.push('LLM OUTPUT ≠ MEMORY DECISION');
        warnings.push(`AUTHORITY_NOT_PROVEN: authority "${sc.authority}" in the passport is not backed by a matching trusted caller context (caller: ${callerText(caller)}; WHO: ${inc.WHO})`);
        return res('UNCERTAIN', `status change ${from} → ${to} claims authority "${sc.authority}" without trusted caller context — not accepted as authority; human review required`, { affected: aff });
      }
      return res('STATUS_CHANGE', `explicit status change request ${from} → ${to} on exact version ${v.version_id} (authority: ${auth}, proven by trusted caller context via ${caller.via}; rationale: ${_s(sc.rationale)})`, {
        basis: 'TYPED_STATUS_CHANGE', affected: aff,
        status_effect: { changes: [{ target_version_id: v.version_id, from_status: from, proposed_to_status: to, source: inc.SOURCE, authority: auth, authority_proof: { caller_kind: caller.kind, via: caller.via }, evidence: sc.evidence, rationale: sc.rationale }], note: 'proposal only — applied (step 2) as a new immutable version; relations to the old version stay pinned' },
        writes: [{ op: 'ADD_ITEM_VERSION', logical_item_id: v.logical_item_id, base_version_id: v.version_id, change: 'epistemic_state', from_status: from, to_status: to }],
      });
    }
    if (inc.REFINES) {
      const v = exactVersion(db, inc.REFINES);
      if (!v) return res('UNCERTAIN', `REFINES target ${inc.REFINES} is not an existing exact version`);
      const aff = [ref(v)];
      if (!v.is_current_version) return res('UNCERTAIN', `REFINES target ${v.version_id} is an archived version; refinement applies to the current version only`, { affected: aff });
      if (inc.ITEM_ID && _s(inc.ITEM_ID) !== v.logical_item_id) return res('UNCERTAIN', `ITEM_ID ${inc.ITEM_ID} differs from the REFINES target item ${v.logical_item_id}`, { affected: aff });
      if (v.item_type !== inc.TYPE || _s(v.project_id) !== inc.SCOPE) return res('UNCERTAIN', 'REFINES target differs in TYPE or SCOPE — not a refinement', { affected: aff });
      if (_s(v.epistemic_state).toUpperCase() !== st) return res('UNCERTAIN', `refinement cannot carry a status transition (${v.epistemic_state} → ${inc.STATUS}); use PROPOSED_STATUS_CHANGE`, { affected: aff });
      return res('REFINEMENT', `explicit REFINES of current version ${v.version_id}, same TYPE/SCOPE/STATUS — after review becomes a new immutable version of ${v.logical_item_id}`, {
        basis: 'TYPED_REFINES', affected: aff,
        writes: [{ op: 'ADD_ITEM_VERSION', logical_item_id: v.logical_item_id, base_version_id: v.version_id, claim: inc.WHAT, status: inc.STATUS, change: 'content' }],
        status_effect: { changes: [], note: 'no status transition; old version stays as immutable archived version, relations stay pinned to it' },
      });
    }
    if (rels.length === 1) {
      const r = rels[0] || {}; const rt = _s(r.relation_type).toUpperCase();
      const v = exactVersion(db, r.target_version_id);
      if (!v) return res('UNCERTAIN', `RELATIONS target ${r.target_version_id} is not an existing exact version`);
      const aff = [ref(v)];
      // an ADD_ITEM under an existing logical id would silently become a new version of that item in step 2
      if (inc.ITEM_ID && idExists) return res('UNCERTAIN', `ITEM_ID ${inc.ITEM_ID} already exists in reference memory; adding a separate item under it would collide — human review required`, { affected: aff });
      if (!v.is_current_version) warnings.push(`relation target ${v.version_id} is an ARCHIVED version (explicitly pinned)`);
      const rel = { relation_type: rt, from: newId, target_version_id: v.version_id, target_logical_item_id: v.logical_item_id };
      const writes = [addItem(), { op: 'ADD_RELATION', relation_type: rt, from_logical_item_id: newId, target_version_id: v.version_id }];
      if (rt === 'CONTRADICTS') return res('CONTRADICTION', `explicit CONTRADICTS against exact version ${v.version_id}; no winner is chosen`, { basis: 'TYPED_RELATION', affected: aff, relations: [rel], writes, status_effect: { changes: [], note: 'no winner chosen — both claims keep their status (RELATION ≠ TRUTH)' } });
      if (EVIDENCE_DIRECTIONS.includes(rt)) {
        if (!_s(inc.RATIONALE)) return res('UNCERTAIN', 'NEW_EVIDENCE requires a RATIONALE', { affected: aff });
        return res('NEW_EVIDENCE', `explicit ${rt} evidence for exact version ${v.version_id} (direction ${rt}; source ${inc.SOURCE.source_id || inc.SOURCE.title}; rationale: ${_s(inc.RATIONALE)})`, { basis: 'TYPED_RELATION', affected: aff, relations: [Object.assign(rel, { direction: rt })], writes, status_effect: { changes: [], note: 'evidence never changes status' } });
      }
      if (RELATED_ITEM_RELATION_TYPES.includes(rt)) return res('NEW_RELATED_ITEM', `separate new item related to exact version ${v.version_id} via ${rt}`, { basis: 'TYPED_RELATION', affected: aff, relations: [rel], writes });
      return res('UNCERTAIN', `relation_type "${r.relation_type}" is not admissible in v0.1 (allowed: CONTRADICTS, ${EVIDENCE_DIRECTIONS.join(', ')}, ${RELATED_ITEM_RELATION_TYPES.join(', ')})`, { affected: aff });
    }

    // 5) no deterministic basis → UNCERTAIN (first-class result, never a best guess)
    if (!candidates.length) return res('UNCERTAIN', 'no related records in scope and no typed intent; a standalone addition is a reviewer decision (NEW INFORMATION ≠ NEW MEMORY)');
    if (candidates.length === 1) return res('UNCERTAIN', `one similar candidate (${candidates[0].version_id}) but no deterministic identity and no typed intent (SIMILARITY ≠ IDENTITY ≠ DUPLICATE)`, { affected: candidates.map(ref) });
    return res('UNCERTAIN', `ambiguous candidate set (${candidates.length} similar records) and no deterministic basis — human review required`, { affected: candidates.map(ref) });
  }

  // ── executable write plan (step 2) — built at PREPARE time, READ-ONLY, shown to the user and sealed ──
  // The plan carries the EXACT records that an explicit Apply will import via WizRef.importJSONL (import_bundle), the
  // preconditions the stale-plan guard re-checks, the exact expected effect, and any authority the plan itself needs.
  // Apply never recomputes any of it: new meaning = new Prepare.
  const IMPORT_SEED_ID = 'wiz-admission';
  const VERSION_ID_RE = /^(.*)@([0-9a-f]{14})$/;
  const SOURCE_FIELDS = Object.freeze(['title', 'surface', 'source_kind', 'authority_class', 'locator', 'revision', 'as_of', 'currentness', 'content_hash']);
  const CAPTURE_COLS = Object.freeze(['source_title', 'source_surface', 'source_kind', 'source_authority_class', 'source_revision', 'source_as_of', 'source_currentness', 'source_content_hash'].map(f => f + '_at_capture'));
  const CARRY_FIELDS = Object.freeze(['source_id', 'project_id', 'item_type', 'claim', 'source_section', 'source_status', 'epistemic_state', 'authority_scope', 'validity', 'confidence', 'as_of', 'supersedes_item_id', 'provenance']);
  const _itemRow = (db, itemId) => _rowsObj(db, 'SELECT * FROM wiz_ref_items WHERE item_id=?', [_s(itemId)])[0] || null;
  const _sourceRow = (db, id) => _rowsObj(db, 'SELECT * FROM wiz_ref_sources WHERE source_id=?', [_s(id)])[0] || null;
  const _relExists = (db, id) => _rowsRaw(db, 'SELECT 1 FROM wiz_ref_relations WHERE relation_id=?', [_s(id)]).length > 0;
  const _provStr = p => (p === undefined || p === null || p === '' ? null : (typeof p === 'object' ? _stable(p) : String(p)));
  const _optFields = (inc, item) => {
    if (inc.CONFIDENCE !== undefined && inc.CONFIDENCE !== null && inc.CONFIDENCE !== '' && !isNaN(Number(inc.CONFIDENCE))) item.confidence = Number(inc.CONFIDENCE);
    if (inc.VALIDITY !== undefined && inc.VALIDITY !== null && inc.VALIDITY !== '') item.validity = typeof inc.VALIDITY === 'object' ? _stable(inc.VALIDITY) : _s(inc.VALIDITY);
    return item;
  };
  function buildPlan(db, inc, d, ctx) {
    const plan = {
      executes: false,
      note: 'PROPOSAL — nothing has been written to reference memory. Only an explicit Apply executes EXACTLY import_bundle below via WizRef.importJSONL, after an integrity + stale-plan check. Apply ≠ USER_DECISION ≠ VERIFIED.',
      proposed_new_logical_item_id: d.writes.some(w => w.op === 'ADD_ITEM') ? ctx.newLogicalId : null,
      writes: d.writes, import_bundle: null, preconditions: null, expected_effect: null, requires_authority: null,
      resolved: false, unresolved: [], apply: '',
    };
    const unresolved = plan.unresolved;
    if (d.outcome === 'UNCERTAIN' || d.outcome === 'OUT_OF_SCOPE') {
      unresolved.push(`outcome ${d.outcome} has no executable write plan — Apply is refused; new meaning requires a new Prepare`);
      plan.apply = 'REFUSED — no executable plan (Dismiss, or Prepare again with explicit typed intent)';
      return plan;
    }
    const pre = { ref_fingerprint: null, reference_state: ctx.readiness.state, targets: d.affected.map(a => ({ version_id: a.version_id, logical_item_id: a.logical_item_id, must_be_current: !!a.is_current_version, epistemic_state: a.epistemic_state })), absent_item_ids: [], absent_relation_ids: [], sources: [] };
    const eff = { reference_mutation: false, items_added: [], items_revised: [], archived_versions: [], relations_added: [], sources_added: [] };
    const records = [];
    if (d.basis === 'DECLARED_EQUIVALENCE') plan.requires_authority = { kind: _s(inc.EQUIVALENT_TO.declared_by).toUpperCase(), reason: 'declared equivalence (EQUIVALENT_TO.declared_by)' };
    if (d.basis === 'TYPED_STATUS_CHANGE') plan.requires_authority = { kind: _s(inc.PROPOSED_STATUS_CHANGE.authority).toUpperCase(), reason: 'status change authority (PROPOSED_STATUS_CHANGE.authority)' };
    const srcPlan = () => { // existing source → referenced, NEVER revised; new source → full record from the passport
      const S = inc.SOURCE || {}; const sid = _s(S.source_id);
      if (!sid) { unresolved.push('SOURCE has no source_id — a reference item cannot be written without a source record id'); return null; }
      const known = pre.sources.find(x => x.source_id === sid);
      const ex = _sourceRow(db, sid);
      if (ex) {
        const diff = SOURCE_FIELDS.filter(f => _s(S[f]) && _s(S[f]) !== _s(ex[f]));
        if (diff.length) { unresolved.push(`passport SOURCE differs from the stored source record ${sid} in ${diff.join(', ')} — admission never revises a source record`); return null; }
        if (!known) pre.sources.push({ source_id: sid, exists: true, record_hash: ex.record_hash });
        return { sid, record: null };
      }
      const miss = ['title', 'surface', 'source_kind'].filter(f => !_s(S[f]));
      if (miss.length) { unresolved.push(`new source ${sid} lacks ${miss.join(', ')} — its source record cannot be created`); return null; }
      const rec = { source_id: sid, project_id: _s(S.project_id) || inc.SCOPE };
      for (const f of SOURCE_FIELDS) if (_s(S[f])) rec[f] = _s(S[f]);
      if (_s(S.privacy)) rec.privacy = _s(S.privacy);
      if (known) return { sid, record: null }; // already carried by an earlier record of this bundle
      pre.sources.push({ source_id: sid, exists: false }); eff.sources_added.push(sid);
      return { sid, record: rec };
    };
    for (const w of d.writes) {
      if (w.op === 'ADD_ITEM') {
        const id = _s(w.logical_item_id);
        if (/@/.test(id)) { unresolved.push(`logical item id "${id}" must not contain "@" (reserved for immutable version ids)`); continue; }
        if (itemIdExists(db, id)) { unresolved.push(`logical item id ${id} already exists in reference memory`); continue; }
        const sp = srcPlan(); if (!sp) continue;
        const item = _optFields(inc, { item_id: id, source_id: sp.sid, project_id: inc.SCOPE, item_type: inc.TYPE, claim: inc.WHAT, epistemic_state: inc.STATUS, as_of: inc.WHEN, provenance: _provStr(inc.PROVENANCE) });
        records.push(sp.record ? { source: sp.record, item } : { item });
        pre.absent_item_ids.push(id); eff.items_added.push(id);
      } else if (w.op === 'ADD_RELATION') {
        const tgt = exactVersion(db, w.target_version_id);
        if (!tgt) { unresolved.push(`relation target ${w.target_version_id} is not an existing exact version`); continue; }
        const relId = `rel:adm:${w.from_logical_item_id}:${w.relation_type}->${tgt.version_id}`;
        if (_relExists(db, relId)) { unresolved.push(`relation id ${relId} already exists`); continue; }
        records.push({ relation: { relation_id: relId, from_item_id: w.from_logical_item_id, to_item_id: tgt.logical_item_id, to_version_id: tgt.version_id,
          relation_type: w.relation_type, epistemic_status: 'SOURCE_ASSERTION', source_id: _s((inc.SOURCE || {}).source_id) || null, scope: inc.SCOPE, rationale: _s(inc.RATIONALE) || null } });
        pre.absent_relation_ids.push(relId);
        eff.relations_added.push({ relation_id: relId, relation_type: w.relation_type, from_logical_item_id: w.from_logical_item_id, to_version_id: tgt.version_id });
      } else if (w.op === 'ADD_ITEM_VERSION') {
        const base = _itemRow(db, w.logical_item_id);
        if (!base || base.version_id !== w.base_version_id || base.logical_item_id !== w.logical_item_id) { unresolved.push(`base version ${w.base_version_id} is not the current version of ${w.logical_item_id}`); continue; }
        const item = {}; for (const f of CARRY_FIELDS) if (base[f] !== null && base[f] !== undefined) item[f] = base[f];
        item.item_id = w.logical_item_id;
        let src = null;
        if (w.change === 'epistemic_state') { // same content, new status → keep the version's capture provenance verbatim
          item.epistemic_state = w.to_status;
          for (const c of CAPTURE_COLS) if (base[c] !== null && base[c] !== undefined) item[c] = base[c];
          if (Number(base.capture_backfilled)) item.capture_backfilled = 1;
        } else { // content refinement: new claim / WHEN / PROVENANCE from the passport, captured from its source now
          const sp = srcPlan(); if (!sp) continue;
          src = sp.record;
          Object.assign(item, { source_id: sp.sid, claim: inc.WHAT, as_of: inc.WHEN, provenance: _provStr(inc.PROVENANCE) }); _optFields(inc, item);
        }
        records.push(src ? { source: src, item } : { item });
        eff.items_revised.push(w.logical_item_id); eff.archived_versions.push(w.base_version_id);
      } else unresolved.push(`unknown write op ${w.op}`);
    }
    const statuses = records.filter(r => r.item).map(r => _s(r.item.epistemic_state).toUpperCase());
    if (statuses.some(x => VERIFIED_LIKE.includes(x))) unresolved.push('a record would carry a VERIFIED-like status — never written by admission');
    if (statuses.includes('USER_DECISION') && !plan.requires_authority) plan.requires_authority = { kind: 'USER', reason: 'a written record carries USER_DECISION' };
    eff.reference_mutation = records.length > 0;
    plan.import_bundle = records.length ? { format: 'wiz-ref-jsonl/1', seed_id: IMPORT_SEED_ID, seed_version: ctx.reviewId, records } : null;
    plan.preconditions = pre; plan.expected_effect = eff;
    plan.resolved = unresolved.length === 0;
    plan.apply = !plan.resolved ? 'REFUSED — plan unresolved (see unresolved)'
      : (plan.requires_authority ? `requires a trusted ${plan.requires_authority.kind} authority token supplied by the host — a UI click is NOT authority (browser: refused)` : '')
        + (plan.requires_authority ? '' : (eff.reference_mutation ? 'available — an explicit Apply imports exactly import_bundle' : 'available — Apply records the decision; NO reference write'));
    return plan;
  }

  // ── read-only phase: SQLite-enforced (PRAGMA query_only=ON) inside a SAVEPOINT that is ALWAYS rolled back ──
  // Synchronous by construction, so no other code can run (and hit query_only) while it is active.
  function _readOnlyPhase(db, fn) {
    const prevQO = Number(_one(db, 'PRAGMA query_only')) ? 1 : 0;
    db.run('PRAGMA query_only=ON');
    db.run('SAVEPOINT wiz_adm_readonly');
    let out, err = null;
    try { out = fn(); } catch (e) { err = e; }
    let restoreErr = null;
    try { db.run('ROLLBACK TO wiz_adm_readonly'); db.run('RELEASE wiz_adm_readonly'); } catch (e) { restoreErr = e; }
    db.run(`PRAGMA query_only=${prevQO ? 'ON' : 'OFF'}`);
    if (err) throw new Error('ZERO-WRITE GUARD: read-only phase aborted — nothing staged (' + ((err && err.message) || err) + ')');
    if (restoreErr) throw new Error('ZERO-WRITE GUARD: could not roll back the read-only savepoint — nothing staged (' + restoreErr.message + ')');
    return out;
  }

  // ── prepare(): build + stage a review packet. The ONLY write is one INSERT into wiz_admission_reviews. ──
  async function prepare(db, incoming, opts = {}) {
    if (!db) throw new Error('no database');
    const W = WizRefApi(); if (!W) throw new Error('WizRef (reference memory) not loaded');
    if (opts.mode !== undefined && _s(opts.mode).toUpperCase() !== ADMISSION_MODE) return { ok: false, errors: [`mode "${opts.mode}" rejected — ADMISSION_MODE = REVIEW is the only mode`], warnings: [] };
    const { errors, warnings, inc } = normalizeIncoming(incoming);
    if (errors.length) return { ok: false, errors, warnings }; // nothing staged, nothing written
    const caller = callerOf(opts);
    const createdAt = Date.now(), rnd = _randHex(12);
    const reviewId = 'adm-review:' + createdAt.toString(36) + ':' + rnd;
    // proposed logical id of a NEW item: ITEM_ID if given, else review-derived (random) — never derived from content
    const newLogicalId = _s(inc.ITEM_ID) || ('adm:' + createdAt.toString(36) + rnd);
    const outOfScope = !!(opts.review_scope && Array.isArray(opts.review_scope.project_ids) && opts.review_scope.project_ids.length && !opts.review_scope.project_ids.includes(inc.SCOPE));

    // Phase 1 — READ ONLY (sync): snapshot → readiness → candidates → decision → snapshot, under query_only + rolled-back savepoint
    const ph = _readOnlyPhase(db, () => {
      const snapBefore = refSnapshot(db);
      const readiness = refReadiness(db);
      const candidates = readiness.readable && !outOfScope ? retrieveCandidates(db, inc, opts) : [];
      const d = decide(db, inc, candidates, Object.assign({}, opts, { _readiness: readiness, _newLogicalId: newLogicalId, _caller: caller }));
      const plan = buildPlan(db, inc, d, { newLogicalId, reviewId, readiness });
      return { snapBefore, readiness, candidates, d, plan, snapAfter: refSnapshot(db) };
    });
    const snapRestored = refSnapshot(db);
    if (ph.snapAfter !== ph.snapBefore || snapRestored !== ph.snapBefore) throw new Error('ZERO-WRITE VIOLATION: wiz_ref_* changed during prepare — nothing staged');
    const { readiness, candidates, d, plan } = ph;
    if (!OUTCOMES.includes(d.outcome)) throw new Error('internal: outcome outside the closed enum');
    const fp = ph.snapBefore === JSON.stringify({ schema: [], tables: {} }) ? null : await W.sha256Hex(ph.snapBefore);
    if (plan.preconditions) plan.preconditions.ref_fingerprint = fp;
    const packet = {
      mode: ADMISSION_MODE, admission_version: VERSION, review_id: reviewId, created_at: createdAt,
      incoming: inc,
      caller: caller,
      reference_memory: { state: readiness.state, readable: readiness.readable, schema_version: readiness.schema_version, issues: readiness.issues, access: 'READ_ONLY (SELECT under PRAGMA query_only, rolled-back savepoint)' },
      candidate_matches: candidates,
      proposed_outcome: d.outcome,
      reason: d.reason,
      decision_basis: d.basis || 'NONE (no deterministic basis)',
      affected_records: d.affected,
      proposed_relations: d.relations,
      proposed_status_effect: d.status_effect,
      provenance: { passport: inc.PROVENANCE, source: inc.SOURCE, who: inc.WHO, when: inc.WHEN },
      hard_rules_triggered: d.hard_rules,
      warnings: warnings.concat(d.warnings),
      write_plan: plan,
      ref_fingerprint: { before: fp, after: fp, unchanged: true },
      state: 'AWAITING_REVIEW',
    };
    for (const f of ['reason', 'affected_records', 'provenance']) if (packet[f] === undefined || packet[f] === null) throw new Error('internal: mandatory packet field missing: ' + f);
    // Phase 2 — STAGING (sync): one INSERT into wiz_admission_reviews; wiz_ref_* re-verified before COMMIT
    const packetJson = JSON.stringify(packet);
    const packetSha = await W.sha256Hex(packetJson); // seal: apply refuses if packet_json / write_plan_json no longer match
    initSchema(db);
    db.run('BEGIN');
    try {
      db.run(`INSERT INTO ${TABLE}(review_id,created_at,mode,incoming_json,candidate_json,proposed_outcome,rationale,affected_records_json,write_plan_json,review_state,reviewed_at,packet_json,packet_sha256)
        VALUES(?,?,?,?,?,?,?,?,?,?,NULL,?,?)`, [reviewId, createdAt, ADMISSION_MODE, JSON.stringify(inc), JSON.stringify(candidates), d.outcome, d.reason,
        JSON.stringify(d.affected), JSON.stringify(packet.write_plan), 'AWAITING_REVIEW', packetJson, packetSha]);
      if (refSnapshot(db) !== ph.snapBefore) throw new Error('ZERO-WRITE VIOLATION: wiz_ref_* changed between retrieval and staging — nothing staged');
      db.run('COMMIT');
    } catch (e) { try { db.run('ROLLBACK'); } catch (_) {} throw e; }
    return { ok: true, errors: [], warnings: packet.warnings, review_id: reviewId, packet, packet_sha256: packetSha };
  }

  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
  // STEP 2 — APPLY / DISMISS (human-gated; ADMISSION_MODE stays REVIEW)
  //   PREPARE ≠ APPLY · APPLY ≠ AUTHORSHIP · APPLY ≠ USER_DECISION · APPLY ≠ VERIFIED · USER_INTERACTION ≠ USER_AUTHORITY
  // An Apply means only "execute exactly this shown write plan". Authority a plan itself needs (declared equivalence,
  // status change authority, a USER_DECISION record) must come from a host AUTHORITY token (opts.caller) — never from
  // an Apply/Dismiss click, which yields at most a USER_INTERACTION token.
  // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
  let _actionLock = false; // module lock: browser Prepare (+ its save), Apply and Dismiss are mutually exclusive (a concurrent call → REFUSED BUSY / "in progress", zero writes)
  const REF_PK = Object.freeze({ wiz_ref_items: 'item_id', wiz_ref_relations: 'relation_id', wiz_ref_sources: 'source_id', wiz_ref_meta: 'key' });
  const IMPORT_META_KEYS = Object.freeze(['seed_id', 'seed_version', 'seed_as_of', 'seed_hash', 'seed.' + IMPORT_SEED_ID, 'last_import_at']); // importer bookkeeping
  const _hasActions = db => _hasObj(db, ACTIONS_TABLE);
  const _loadRaw = (db, id) => (_hasTable(db) ? _rowsObj(db, `SELECT * FROM ${TABLE} WHERE review_id=?`, [_s(id)])[0] || null : null);
  function listActions(db, reviewId) {
    if (!db || !_hasActions(db)) return [];
    return _rowsObj(db, `SELECT action_id, review_id, action, requested_at, result, review_state_after, result_json FROM ${ACTIONS_TABLE} WHERE review_id=? ORDER BY requested_at, rowid`, [_s(reviewId)])
      .map(r => Object.assign({}, r, { result_json: undefined, detail: JSON.parse(r.result_json) }));
  }
  function _insertAction(db, r) {
    const id = 'adm-action:' + r.requested_at.toString(36) + ':' + _randHex(10);
    const detail = Object.assign({}, r); delete detail.record;
    db.run(`INSERT INTO ${ACTIONS_TABLE}(action_id,review_id,action,requested_at,result,review_state_after,result_json) VALUES(?,?,?,?,?,?,?)`,
      [id, r.review_id, r.action, r.requested_at, r.result, r.review_state, JSON.stringify(detail)]);
    return id;
  }
  const _ctxOf = opts => { const c = callerOf(opts); return { interaction: c.interaction, interaction_via: c.interaction_via, authority: c.trusted ? { kind: c.kind, via: c.via, trusted: true } : { kind: 'NONE', trusted: false } }; };
  function _res(action, reviewId, at, opts, result, code, extra) {
    return Object.assign({ ok: result === 'APPLIED' || result === 'DISMISSED', action, review_id: _s(reviewId), requested_at: at, result, code,
      review_state: 'AWAITING_REVIEW', reference_writes: 0, reprepare_required: false, problems: [], record: true }, _ctxOf(opts), extra || {});
  }
  // row-level state of wiz_ref_* (for the exact-effect verification inside the apply savepoint)
  function _refState(db) {
    const st = { schema: JSON.stringify(_rowsRaw(db, "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name GLOB 'wiz_ref*' OR tbl_name GLOB 'wiz_ref*' ORDER BY type, name")) };
    for (const [t, pk] of Object.entries(REF_PK)) { const m = new Map(); for (const r of _rowsObj(db, `SELECT * FROM ${t}`)) m.set(String(r[pk]), r); st[t] = m; }
    st.fts = _rowsRaw(db, 'SELECT item_id, claim, project_id, item_type FROM wiz_ref_items_fts').map(r => JSON.stringify(r));
    return st;
  }
  function _diff(a, b) {
    const added = [], removed = [], changed = [];
    for (const [k, v] of b) { if (!a.has(k)) added.push(k); else if (JSON.stringify(a.get(k)) !== JSON.stringify(v)) changed.push(k); }
    for (const k of a.keys()) if (!b.has(k)) removed.push(k);
    return { added, removed, changed };
  }
  const _sameSet = (x, y) => JSON.stringify([...x].map(String).sort()) === JSON.stringify([...y].map(String).sort());
  const _multisetMinus = (a, b) => { const m = new Map(); for (const x of b) m.set(x, (m.get(x) || 0) + 1); const out = []; for (const x of a) { const n = m.get(x) || 0; if (n) m.set(x, n - 1); else out.push(x); } return out; };
  // EXACT effect: only the planned rows appear/change; every pre-existing relation (and its version pins) is untouched
  function _verifyEffect(before, after, plan) {
    const errs = [], eff = plan.expected_effect;
    const recs = plan.import_bundle ? plan.import_bundle.records : [];
    const recItem = id => (recs.find(r => r.item && r.item.item_id === id) || {}).item;
    if (before.schema !== after.schema) errs.push('wiz_ref_* schema changed');
    const it = _diff(before.wiz_ref_items, after.wiz_ref_items);
    const expAdded = eff.items_added.concat(eff.archived_versions.filter(v => !before.wiz_ref_items.has(v)));
    if (!_sameSet(it.added, expAdded)) errs.push(`items added ${JSON.stringify(it.added)} ≠ planned ${JSON.stringify(expAdded)}`);
    if (it.removed.length) errs.push('items removed: ' + it.removed.join(', '));
    if (!_sameSet(it.changed, eff.items_revised)) errs.push(`items changed ${JSON.stringify(it.changed)} ≠ planned ${JSON.stringify(eff.items_revised)}`);
    const rl = _diff(before.wiz_ref_relations, after.wiz_ref_relations);
    if (!_sameSet(rl.added, eff.relations_added.map(r => r.relation_id))) errs.push(`relations added ${JSON.stringify(rl.added)} ≠ planned`);
    if (rl.removed.length || rl.changed.length) errs.push('existing relations changed/removed (pins must never move): ' + rl.removed.concat(rl.changed).join(', '));
    const sr = _diff(before.wiz_ref_sources, after.wiz_ref_sources);
    if (!_sameSet(sr.added, eff.sources_added) || sr.removed.length || sr.changed.length) errs.push(`sources: added ${JSON.stringify(sr.added)} changed ${JSON.stringify(sr.changed)} removed ${JSON.stringify(sr.removed)} ≠ planned ${JSON.stringify(eff.sources_added)}`);
    const mt = _diff(before.wiz_ref_meta, after.wiz_ref_meta);
    const badMeta = mt.added.concat(mt.changed, mt.removed).filter(k => !IMPORT_META_KEYS.includes(k));
    if (badMeta.length) errs.push('unexpected wiz_ref_meta change: ' + badMeta.join(', '));
    // FTS (derived): expected = before − old rows of revised items + rows of every added / revised item (as multisets)
    const ftsRow = r => JSON.stringify([r.item_id, r.claim, r.project_id || '', r.item_type]);
    const expFts = _multisetMinus(before.fts, before.fts.filter(x => eff.items_revised.includes(JSON.parse(x)[0])))
      .concat(it.added.concat(eff.items_revised).map(id => ftsRow(after.wiz_ref_items.get(id) || { item_id: id })));
    if (JSON.stringify(expFts.slice().sort()) !== JSON.stringify(after.fts.slice().sort())) errs.push('FTS index ≠ planned item delta');
    const applied = { items: [], archived_versions: [], relations: [], sources: sr.added.slice() };
    for (const id of eff.items_added) {
      const r = after.wiz_ref_items.get(id), rec = recItem(id) || {};
      if (!r) continue;
      if (r.logical_item_id !== id || !String(r.version_id).startsWith(id + '@') || r.claim !== rec.claim || r.epistemic_state !== rec.epistemic_state || _s(r.lifecycle || 'ACTIVE') !== 'ACTIVE') errs.push(`added item ${id} does not match its planned record`);
      applied.items.push({ item_id: id, logical_item_id: r.logical_item_id, version_id: r.version_id, epistemic_state: r.epistemic_state, op: 'ADD_ITEM' });
    }
    const versionsBefore = new Set([...before.wiz_ref_items.values()].map(r => r.version_id));
    eff.items_revised.forEach((logical, i) => {
      const r = after.wiz_ref_items.get(logical), b = before.wiz_ref_items.get(logical), baseV = eff.archived_versions[i], rec = recItem(logical) || {};
      const arch = after.wiz_ref_items.get(baseV);
      if (!r || !b || !arch) { errs.push(`revision of ${logical}: rows missing`); return; }
      if (r.version_id === b.version_id || versionsBefore.has(r.version_id)) errs.push(`revision of ${logical} did not produce a NEW immutable version (${r.version_id})`);
      if (r.claim !== rec.claim || r.epistemic_state !== rec.epistemic_state || r.logical_item_id !== logical) errs.push(`current row of ${logical} does not match its planned record`);
      if (arch.version_id !== baseV || arch.lifecycle !== 'SUPERSEDED' || arch.logical_item_id !== logical) errs.push(`old version ${baseV} was not preserved as an archived immutable version`);
      for (const f of CARRY_FIELDS.concat(CAPTURE_COLS)) if (JSON.stringify(arch[f]) !== JSON.stringify(b[f])) errs.push(`archived version ${baseV} differs from the old content in ${f}`);
      applied.items.push({ item_id: logical, logical_item_id: logical, version_id: r.version_id, epistemic_state: r.epistemic_state, op: 'ADD_ITEM_VERSION', previous_version_id: baseV });
      applied.archived_versions.push(baseV);
    });
    for (const x of eff.relations_added) {
      const r = after.wiz_ref_relations.get(x.relation_id); if (!r) continue;
      const from = after.wiz_ref_items.get(x.from_logical_item_id);
      if (r.to_version_id !== x.to_version_id || !from || r.from_version_id !== from.version_id || r.relation_type !== x.relation_type || r.epistemic_status !== 'SOURCE_ASSERTION') errs.push(`relation ${x.relation_id} is not pinned exactly as planned`);
      applied.relations.push({ relation_id: r.relation_id, relation_type: r.relation_type, from_version_id: r.from_version_id, to_version_id: r.to_version_id, epistemic_status: r.epistemic_status });
    }
    return { errors: errs, applied };
  }
  // STALE-PLAN GUARD (read-only): the reference memory must be exactly as it was when the plan was prepared
  async function _staleCheck(db, plan, W) {
    const pre = plan.preconditions, problems = [];
    const rd = refReadiness(db);
    if (rd.state !== 'READY') { problems.push(`reference memory is ${rd.state} (${rd.issues.join('; ')})`); return problems; }
    for (const t of pre.targets) {
      const v = exactVersion(db, t.version_id);
      if (!v) { problems.push(`target version ${t.version_id} no longer exists`); continue; }
      if (t.must_be_current && !v.is_current_version) {
        problems.push(`target version ${t.version_id} is no longer the current version of ${t.logical_item_id}`);
        const now = _itemRow(db, t.logical_item_id);
        if (now && _s(now.epistemic_state) !== _s(t.epistemic_state)) problems.push(`current status of ${t.logical_item_id} changed (${t.epistemic_state} → ${now.epistemic_state}); from_status no longer matches`);
      }
      if (_s(v.epistemic_state) !== _s(t.epistemic_state)) problems.push(`target ${t.version_id} status changed (${t.epistemic_state} → ${v.epistemic_state}); from_status no longer matches`);
    }
    for (const id of pre.absent_item_ids) if (itemIdExists(db, id)) problems.push(`proposed new logical item id ${id} now collides with an existing item`);
    for (const id of pre.absent_relation_ids) if (_relExists(db, id)) problems.push(`proposed relation id ${id} now exists`);
    for (const x of pre.sources) {
      const ex = _sourceRow(db, x.source_id);
      if (x.exists && (!ex || ex.record_hash !== x.record_hash)) problems.push(`source record ${x.source_id} changed or disappeared since prepare`);
      if (!x.exists && ex) problems.push(`source record ${x.source_id} was created since prepare`);
    }
    const fpNow = await W.sha256Hex(refSnapshot(db));
    if (fpNow !== pre.ref_fingerprint) problems.push(`reference memory fingerprint changed since prepare (${pre.ref_fingerprint} → ${fpNow})`);
    return problems;
  }
  // importJSONL runs its own BEGIN/COMMIT/ROLLBACK. Inside the outer apply SAVEPOINT those become a NESTED savepoint
  // (same semantics, one level down), so the import + the review record update commit or roll back TOGETHER.
  // Nothing else about the importer changes (same function, same validation, same writes).
  function _nestedTxDb(db) {
    const MAP = { BEGIN: ['SAVEPOINT wiz_ref_import'], COMMIT: ['RELEASE wiz_ref_import'], ROLLBACK: ['ROLLBACK TO wiz_ref_import', 'RELEASE wiz_ref_import'] };
    const TXN = /^\s*(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)\b/i;
    return new Proxy(db, { get(t, k) {
      if (k === 'run') return (sql, params) => {
        const key = String(sql).trim().toUpperCase();
        if (MAP[key]) { for (const x of MAP[key]) t.run(x); return t; }
        if (TXN.test(String(sql))) throw new Error('unexpected transaction statement from the importer: ' + sql);
        return params === undefined ? t.run(sql) : t.run(sql, params);
      };
      if (k === 'exec') return (sql, params) => { if (TXN.test(String(sql))) throw new Error('unexpected transaction statement from the importer: ' + sql); return t.exec(sql, params); };
      const v = t[k]; return typeof v === 'function' ? v.bind(t) : v;
    } });
  }
  const _bundleText = (plan) => [JSON.stringify({ manifest: { format: plan.import_bundle.format, seed_id: plan.import_bundle.seed_id, seed_version: plan.import_bundle.seed_version, note: 'admission review apply — exactly the prepared write plan' } })]
    .concat(plan.import_bundle.records.map(r => JSON.stringify(r))).join('\n') + '\n';

  // The transactional core of APPLY. Returns a result object; on success the review is APPLIED and the action row is
  // written INSIDE the same savepoint as the import. Failures leave the database exactly as before (caller records them).
  async function _applyTx(db, reviewId, opts) {
    const W = WizRefApi(); if (!W) throw new Error('WizRef (reference memory) not loaded');
    const at = Date.now(), R = (result, code, extra) => _res('APPLY', reviewId, at, opts, result, code, extra);
    const row = _loadRaw(db, reviewId);
    if (!row) return R('REFUSED', 'NOT_FOUND', { record: false, problems: ['no such review'] });
    if (row.review_state !== 'AWAITING_REVIEW') return R('REFUSED', 'ALREADY_TERMINAL', { record: false, review_state: row.review_state, reviewed_at: row.reviewed_at, problems: [`review is ${row.review_state}; terminal states are never reversed or re-applied`] });
    // 1) integrity: the stored packet is exactly the one prepared (and shown)
    const integ = []; let packet = null;
    try { packet = JSON.parse(row.packet_json); } catch (e) { integ.push('packet_json is not valid JSON'); }
    if (!row.packet_sha256) integ.push('no packet_sha256 seal (prepared by an earlier admission build) — prepare again');
    else if ((await W.sha256Hex(row.packet_json)) !== row.packet_sha256) integ.push('packet_json does not match the packet_sha256 sealed at prepare');
    if (packet) {
      if (row.write_plan_json !== JSON.stringify(packet.write_plan)) integ.push('write_plan_json differs from the sealed packet write plan');
      if (row.proposed_outcome !== packet.proposed_outcome) integ.push('proposed_outcome differs from the sealed packet');
      if (row.incoming_json !== JSON.stringify(packet.incoming)) integ.push('incoming_json differs from the sealed packet');
      if (packet.review_id !== row.review_id || packet.mode !== ADMISSION_MODE || row.mode !== ADMISSION_MODE) integ.push('review id / mode mismatch');
      const wp = packet.write_plan || {};
      if (!('import_bundle' in wp) || !('preconditions' in wp) || !('expected_effect' in wp) || !('resolved' in wp)) integ.push('write plan lacks the step-2 executable fields — prepare again');
    }
    if (opts.expected_packet_sha256 !== undefined && opts.expected_packet_sha256 !== row.packet_sha256) integ.push('the packet shown to the user is not the stored packet');
    if (integ.length) return R('INTEGRITY_FAILED', 'REPREPARE_REQUIRED', { reprepare_required: true, problems: integ });
    const plan = packet.write_plan;
    const base = { proposed_outcome: packet.proposed_outcome, packet_sha256: row.packet_sha256 };
    // 2) only an executable, resolved plan
    if (packet.proposed_outcome === 'UNCERTAIN' || packet.proposed_outcome === 'OUT_OF_SCOPE' || !plan.resolved)
      return R('REFUSED', 'NO_EXECUTABLE_PLAN', Object.assign(base, { problems: plan.unresolved.length ? plan.unresolved : ['plan not resolved'] }));
    // 3) authority the PLAN needs — only a matching host authority token; an Apply click is never authority
    const caller = callerOf(opts);
    if (plan.requires_authority && !(caller.trusted && caller.kind === plan.requires_authority.kind))
      return R('REFUSED', 'AUTHORITY_NOT_PROVEN', Object.assign(base, { problems: [`plan requires trusted ${plan.requires_authority.kind} authority (${plan.requires_authority.reason}); caller: ${callerText(caller)} — APPLY ≠ USER_DECISION, USER_INTERACTION ≠ USER_AUTHORITY`], hard_rules: ['LLM OUTPUT ≠ MEMORY DECISION', 'APPLY ≠ USER_DECISION'] }));
    const recs = plan.import_bundle ? plan.import_bundle.records : [];
    const sts = recs.filter(r => r.item).map(r => _s(r.item.epistemic_state).toUpperCase());
    if (sts.some(x => VERIFIED_LIKE.includes(x)) || (sts.includes('USER_DECISION') && !plan.requires_authority))
      return R('REFUSED', 'EPISTEMIC_PROMOTION_BLOCKED', Object.assign(base, { problems: ['APPLY ≠ VERIFIED / USER_DECISION: the plan would write a promoted status without proven authority'] }));
    // 4) stale-plan guard
    const stale = await _staleCheck(db, plan, W);
    if (stale.length) return R('STALE_REVIEW', 'REPREPARE_REQUIRED', Object.assign(base, { reprepare_required: true, problems: stale }));
    // 5) atomic write: import (nested savepoint) + exact-effect verification + review record, one outer savepoint
    const snap0 = refSnapshot(db), fp0 = plan.preconditions.ref_fingerprint;
    const before = _refState(db);
    db.run('SAVEPOINT wiz_adm_apply');
    try {
      let imp = null;
      if (recs.length) {
        imp = await W.importJSONL(_nestedTxDb(db), _bundleText(plan), { seed_id: IMPORT_SEED_ID, seed_version: row.review_id });
        if (!imp.ok || !imp.committed) throw Object.assign(new Error('WizRef.importJSONL rejected the bundle: ' + (imp.errors || []).map(e => e.msg).join('; ')), { code: 'IMPORT_REJECTED', import_errors: imp.errors });
      }
      const v = _verifyEffect(before, _refState(db), plan);
      if (v.errors.length) throw Object.assign(new Error('unexpected reference effect: ' + v.errors.join('; ')), { code: 'UNEXPECTED_EFFECT' });
      const fp1 = recs.length ? await W.sha256Hex(refSnapshot(db)) : fp0;
      if (!recs.length && refSnapshot(db) !== snap0) throw Object.assign(new Error('ZERO-WRITE VIOLATION on a no-write apply'), { code: 'UNEXPECTED_EFFECT' });
      const result = R('APPLIED', recs.length ? 'IMPORTED_EXACT_PLAN' : 'NO_REFERENCE_WRITE', Object.assign(base, {
        review_state: 'APPLIED', reviewed_at: at, reference_writes: recs.length,
        applied: v.applied, reference_mutation: recs.length > 0,
        import: imp ? { seed_id: imp.seed_id, seed_version: imp.seed_version, items_inserted: imp.items_inserted, items_revised: imp.items_revised, items_unchanged: imp.items_unchanged, relations_inserted: imp.relations_inserted, sources_inserted: imp.sources_inserted, warnings: imp.warnings } : null,
        ref_fingerprint: { before: fp0, after: fp1 },
        authority_used: plan.requires_authority ? { kind: caller.kind, via: caller.via, required_by: plan.requires_authority.reason } : 'NONE — Apply executes the shown plan only (not USER_DECISION, not VERIFIED)',
      }));
      try { db.run(`UPDATE ${TABLE} SET review_state='APPLIED', reviewed_at=? WHERE review_id=? AND review_state='AWAITING_REVIEW'`, [at, row.review_id]); }
      catch (e) { throw Object.assign(new Error('review record update failed: ' + e.message), { code: 'REVIEW_UPDATE_FAILED' }); }
      if (db.getRowsModified() !== 1) throw Object.assign(new Error('review record not updated (concurrent change?)'), { code: 'REVIEW_UPDATE_FAILED' });
      result.action_id = _insertAction(db, result);
      db.run('RELEASE wiz_adm_apply');
      return result;
    } catch (e) {
      let rolledBack = true;
      try { db.run('ROLLBACK TO wiz_adm_apply'); db.run('RELEASE wiz_adm_apply'); } catch (e2) { rolledBack = false; }
      return R('FAILED', e.code || 'APPLY_ERROR', Object.assign(base, { problems: [String((e && e.message) || e)], import_errors: e.import_errors || [], rolled_back: rolledBack, reference_unchanged: refSnapshot(db) === snap0 }));
    }
  }
  function _dismissTx(db, reviewId, opts) {
    const at = Date.now(), R = (result, code, extra) => _res('DISMISS', reviewId, at, opts, result, code, extra);
    const row = _loadRaw(db, reviewId);
    if (!row) return R('REFUSED', 'NOT_FOUND', { record: false, problems: ['no such review'] });
    if (row.review_state !== 'AWAITING_REVIEW') return R('REFUSED', 'ALREADY_TERMINAL', { record: false, review_state: row.review_state, reviewed_at: row.reviewed_at, problems: [`review is ${row.review_state}; terminal states are never reversed`] });
    const reason = opts.reason === undefined || opts.reason === null || _s(opts.reason) === '' ? null : _s(opts.reason).slice(0, 2000);
    const snap0 = refSnapshot(db);
    db.run('SAVEPOINT wiz_adm_dismiss');
    try {
      db.run(`UPDATE ${TABLE} SET review_state='DISMISSED', reviewed_at=? WHERE review_id=? AND review_state='AWAITING_REVIEW'`, [at, row.review_id]);
      if (db.getRowsModified() !== 1) throw new Error('review record not updated');
      const result = R('DISMISSED', 'DISMISSED', { review_state: 'DISMISSED', reviewed_at: at, reason, proposed_outcome: row.proposed_outcome, packet_sha256: row.packet_sha256 || null, reference_writes: 0 });
      result.action_id = _insertAction(db, result);
      if (refSnapshot(db) !== snap0) throw new Error('ZERO-WRITE VIOLATION: wiz_ref_* changed during dismiss');
      db.run('RELEASE wiz_adm_dismiss');
      return result;
    } catch (e) {
      try { db.run('ROLLBACK TO wiz_adm_dismiss'); db.run('RELEASE wiz_adm_dismiss'); } catch (e2) {}
      return R('FAILED', 'DISMISS_ERROR', { problems: [String((e && e.message) || e)], reference_unchanged: refSnapshot(db) === snap0 });
    }
  }
  const _public = r => { const o = Object.assign({}, r); delete o.record; return o; };
  const _recordFailure = (db, r) => { if (r.record && !r.ok) { try { r.action_id = _insertAction(db, r); } catch (e) { r.record_error = String(e.message || e); } } return r; };
  // In the browser, apply/dismiss additionally require a genuine user click on the matching button (USER_INTERACTION —
  // human gate only, NOT authority). A non-DOM host is trusted to call them (it owns that boundary).
  function _gate(action, opts) {
    if (!IS_DOM) return null;
    const c = callerOf(opts), via = action === 'APPLY' ? 'ui-click:#wizAdmApplyBtn' : 'ui-click:#wizAdmDismissBtn';
    return c.interaction === 'USER_INTERACTION' && c.interaction_via === via ? null : `${action} in the browser requires a genuine user click on its button (${via})`;
  }
  const _busy = (action, id, opts) => _public(_res(action, id, Date.now(), opts, 'REFUSED', 'BUSY', { problems: ['another apply/dismiss is in progress'] }));
  const _gated = (action, id, opts, why) => _public(_res(action, id, Date.now(), opts, 'REFUSED', 'USER_INTERACTION_REQUIRED', { problems: [why] }));

  // apply(db, reviewId, opts) — SQLite-atomic apply on the given database (no persistence; see applyPersisted)
  async function apply(db, reviewId, opts = {}) {
    if (!db) throw new Error('no database');
    const g = _gate('APPLY', opts); if (g) return _gated('APPLY', reviewId, opts, g);
    if (_actionLock) return _busy('APPLY', reviewId, opts);
    _actionLock = true;
    try { if (_hasTable(db)) initSchema(db); return _public(_recordFailure(db, await _applyTx(db, reviewId, opts))); }
    finally { _actionLock = false; }
  }
  function dismiss(db, reviewId, opts = {}) {
    if (!db) throw new Error('no database');
    const g = _gate('DISMISS', opts); if (g) return _gated('DISMISS', reviewId, opts, g);
    if (_actionLock) return _busy('DISMISS', reviewId, opts);
    _actionLock = true;
    try { if (_hasTable(db)) initSchema(db); return _public(_recordFailure(db, _dismissTx(db, reviewId, opts))); }
    finally { _actionLock = false; }
  }
  // DURABLE variants (APPLY / DISMISS + persistence). host = { getDb(), setDb(db), persist(), persistBytes(bytes, stillValid) }.
  // P1-S2-PERSIST-RACE (step 2 rev 1): the candidate database stays ISOLATED until it is durable, and it becomes live
  // only in a synchronous check-and-swap. Other app code keeps writing the live database the whole time:
  //   1. base = live.export(); work = copy(base); the action runs on work (async; live untouched).
  //   2. live changed meanwhile → discard work, REBASE (start again from the current live; the stale guard re-runs).
  //   3. host.persistBytes(work bytes, stillValid) writes the CANDIDATE to IndexedDB while live stays as it is; the host
  //      aborts the IndexedDB transaction if live changed before the write commits (stillValid() false).
  //   4. after the verified write: if live is still byte-identical to base → setDb(work) synchronously (no await
  //      between the check and the swap, so no write can land in between); the old object is closed so a stale
  //      reference fails loudly instead of writing into a detached database; then one more ordinary save of the
  //      new live (requested last → ordered last in IndexedDB) supersedes any save requested during the window.
  //      If live changed during/after the write → REBASE: the next candidate is built on top of the new live (it
  //      carries the concurrent write) and overwrites the stored candidate.
  //   5. persistence failure / too many concurrent writes → work discarded; live (with every concurrent write) is
  //      what gets saved again (host.persist exports the live database) together with the failure record.
  // So a concurrent write is never lost by admission and never left live-but-not-saved by admission: it lives in
  // the live database, which is either the database that is saved on failure, or the base the durable candidate
  // was built on. Limits (flagged in docs §17.4): writers that bypass window._wizDB-at-call-time; a durable
  // candidate + concurrent write + ALL later saves failing leaves durable_state UNKNOWN (reported, never hidden).
  const DURABLE_MAX_ATTEMPTS = 4;
  const _bytesEq = (a, b) => { if (!a || !b || a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  async function _durable(action, host, reviewId, opts, txFn) {
    const g = _gate(action, opts); if (g) return _gated(action, reviewId, opts, g);
    if (_actionLock) return _busy(action, reviewId, opts);
    _actionLock = true;
    try {
      const live = host.getDb(); if (!live) throw new Error('no database');
      if (typeof host.persistBytes !== 'function' || typeof host.persist !== 'function') throw new Error('durable host needs persist() and persistBytes()');
      if (!_hasTable(live)) return _public(_res(action, reviewId, Date.now(), opts, 'REFUSED', 'NOT_FOUND', { problems: ['no such review'] }));
      const pre = _loadRaw(live, reviewId);
      if (!pre || pre.review_state !== 'AWAITING_REVIEW') return _public(await txFn(live)); // refusal path: zero writes, nothing to persist
      const trail = []; let candidateMaybeDurable = false;
      // the failure is recorded on the LIVE database (which holds every concurrent write) and that database is saved
      const fail = async (res) => {
        const cur = host.getDb();
        _recordFailure(cur, res);
        try { await host.persist(); res.failure_recorded_persisted = true; res.durable_state = 'LIVE_SAVED'; }
        catch (e) { res.failure_recorded_persisted = false; res.durable_state = candidateMaybeDurable ? 'UNKNOWN_CANDIDATE_MAY_BE_DURABLE' : 'PREVIOUS_SAVED_STATE'; res.problems = (res.problems || []).concat(['saving the live database failed: ' + String((e && e.message) || e)]); }
        res.attempts = trail; res.reference_unchanged = res.reference_unchanged !== false;
        return _public(res);
      };
      for (let attempt = 1; attempt <= DURABLE_MAX_ATTEMPTS; attempt++) {
        if (host.getDb() !== live) return fail(_res(action, reviewId, Date.now(), opts, 'FAILED', 'DATABASE_REPLACED', { problems: ['the live database object was replaced during the action; nothing applied'] }));
        const base = live.export();
        const stillValid = () => host.getDb() === live && _bytesEq(live.export(), base);
        const work = new live.constructor(base);
        let r;
        try { r = await txFn(work); } catch (e) { r = _res(action, reviewId, Date.now(), opts, 'FAILED', 'ERROR', { problems: [String((e && e.message) || e)] }); }
        if (!r.ok) { work.close(); return fail(r); } // refused / stale / integrity / in-DB failure: nothing of the copy survives
        if (!stillValid()) { work.close(); trail.push({ attempt, event: 'CONCURRENT_WRITE_BEFORE_PERSIST', action: 'REBASE' }); continue; }
        const cand = work.export();
        let ack = null, perr = null;
        try { ack = await host.persistBytes(cand, stillValid); } catch (e) { perr = e; }
        if (!perr && stillValid()) {
          host.setDb(work); // synchronous with the check above: the candidate is durable AND nothing was written since base
          try { live.close(); } catch (e) {}
          const out = _public(r); out.persisted = true; out.persisted_sha256 = (ack && ack.sha256) || null;
          trail.push({ attempt, event: 'DURABLE_THEN_LIVE' });
          try { await host.persist(); out.post_swap_save = 'OK'; } catch (e) { out.post_swap_save = 'FAILED: ' + String((e && e.message) || e); }
          out.attempts = trail; out.durable_state = 'CANDIDATE_DURABLE_AND_LIVE';
          return out;
        }
        work.close();
        if (perr && perr.code === 'CONCURRENT_ABORT') { trail.push({ attempt, event: 'CONCURRENT_WRITE_DURING_PERSIST', stored: false, action: 'REBASE' }); continue; }
        if (perr) {
          candidateMaybeDurable = candidateMaybeDurable || perr.code === 'VERIFY_FAILED';
          trail.push({ attempt, event: 'PERSIST_FAILED', error: String((perr && perr.message) || perr) });
          return fail(_res(action, reviewId, r.requested_at, opts, 'FAILED', 'PERSIST_FAILED', { problems: ['persistence failed — nothing applied: ' + String((perr && perr.message) || perr)], proposed_outcome: r.proposed_outcome }));
        }
        candidateMaybeDurable = true; // stored, but live changed before the swap → the next candidate (or the live save) overwrites it
        trail.push({ attempt, event: 'CONCURRENT_WRITE_AFTER_PERSIST', stored: true, action: 'REBASE' });
      }
      return fail(_res(action, reviewId, Date.now(), opts, 'FAILED', 'CONCURRENT_WRITES', { problems: [`the database kept changing during ${DURABLE_MAX_ATTEMPTS} attempts; nothing applied — try again`] }));
    } finally { _actionLock = false; }
  }
  const applyPersisted = (host, reviewId, opts = {}) => _durable('APPLY', host, reviewId, opts, d => _applyTx(d, reviewId, opts));
  const dismissPersisted = (host, reviewId, opts = {}) => _durable('DISMISS', host, reviewId, opts, d => _dismissTx(d, reviewId, opts));

  function formatAction(r) {
    const j = v => JSON.stringify(v, null, 2);
    return [
      `${r.action} RESULT: ${r.result} (${r.code}) · review_state=${r.review_state}${r.reviewed_at ? ' · reviewed_at=' + new Date(r.reviewed_at).toISOString() : ''} · ${r.review_id}`,
      `USER CONTEXT: ${r.interaction === 'USER_INTERACTION' ? 'USER_INTERACTION (click) — executes the shown plan only; NOT authority, NOT USER_DECISION, NOT VERIFIED' : 'no user interaction'} · authority: ${r.authority && r.authority.trusted ? r.authority.kind + ' (host token)' : 'NONE'}`,
      r.result === 'APPLIED' ? `REFERENCE WRITES: ${r.reference_writes} record(s) via WizRef.importJSONL${r.persisted ? ' · persisted (IndexedDB verified)' : ''}\nAPPLIED: ${j(r.applied)}` : `REFERENCE WRITES: 0${r.reference_unchanged === false ? ' (⚠ reference state differs — see problems)' : ' — reference memory unchanged'}`,
      r.reason ? `DISMISS REASON: ${r.reason}` : '',
      r.durable_state ? `DURABILITY: ${r.durable_state}${r.attempts && r.attempts.length > 1 ? ' · attempts: ' + r.attempts.map(a => a.event).join(' → ') : ''}` : '',
      r.reprepare_required ? 'REPREPARE_REQUIRED — the plan no longer matches reference memory / the sealed packet; Apply never recomputes a plan.' : '',
      r.problems && r.problems.length ? 'PROBLEMS:' + r.problems.map(p => '\n  ⚠ ' + p).join('') : '',
    ].filter(Boolean).join('\n');
  }

  function _fromRow(r) {
    return { review_id: r.review_id, created_at: r.created_at, mode: r.mode, proposed_outcome: r.proposed_outcome, rationale: r.rationale, review_state: r.review_state, reviewed_at: r.reviewed_at,
      packet_sha256: r.packet_sha256 === undefined ? null : r.packet_sha256, packet: JSON.parse(r.packet_json) };
  }
  const SEL = `SELECT * FROM ${TABLE}`;
  function _hasTable(db) { return _rowsRaw(db, `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${TABLE}'`).length > 0; }
  // review = the immutable prepared packet (what was proposed THEN) + review_state/reviewed_at + the action history (NOW)
  function getReview(db, reviewId) {
    if (!db || !_hasTable(db)) return null;
    const r = _rowsObj(db, SEL + ' WHERE review_id=?', [reviewId])[0]; if (!r) return null;
    const out = _fromRow(r); out.actions = listActions(db, reviewId);
    out.last_action = out.actions.length ? out.actions[out.actions.length - 1] : null;
    return out;
  }
  function listPending(db) { if (!db || !_hasTable(db)) return []; return _rowsObj(db, SEL + " WHERE review_state='AWAITING_REVIEW' ORDER BY created_at, review_id").map(_fromRow); }

  function formatPacket(p) {
    const j = v => JSON.stringify(v, null, 2);
    return [
      `🧠 ADMISSION REVIEW · mode=${p.mode} · state at prepare=${p.state} · ${p.review_id}`,
      'LAB / NOT CANON / NOT RUNTIME AUTHORIZATION — proposal; nothing is written to reference memory unless you explicitly Apply.',
      `PROPOSED OUTCOME: ${p.proposed_outcome}   (basis: ${p.decision_basis})`,
      `REASON: ${p.reason}`,
      `INCOMING: ${p.incoming.WHAT}\n  type=${p.incoming.TYPE} · status=${p.incoming.STATUS} · scope=${p.incoming.SCOPE} · who=${p.incoming.WHO} · when=${p.incoming.WHEN}`,
      `CALLER CONTEXT: ${!p.caller ? '—' : (p.caller.interaction === 'USER_INTERACTION' ? 'USER_INTERACTION (review initiated by user click; NOT semantic authority) · ' : '')
        + 'semantic authority: ' + (p.caller.trusted ? p.caller.kind + ' (trusted host context via ' + p.caller.via + '; the module does not authenticate the host)' : 'NONE (untrusted — neither the passport nor a UI click can authorise)')}`,
      `REFERENCE MEMORY: ${p.reference_memory ? p.reference_memory.state + ' · read-only' + (p.reference_memory.issues.length ? ' · ' + p.reference_memory.issues.join('; ') : '') : '—'}`,
      `PROVENANCE: ${j(p.provenance)}`,
      `CANDIDATES (${p.candidate_matches.length}; similarity ranks only):`,
      ...p.candidate_matches.map(c => `  #${c.rank} ${c.version_id} [${c.item_type} / ${c.epistemic_state} / ${c.lifecycle}]${c.deterministic.identical_claim_text ? ' IDENTICAL-TEXT' : ''}${c.deterministic.same_logical_item ? ' SAME-ITEM_ID' : ''}\n    ${c.claim}\n    source: ${c.source.title} (${c.source.source_id}; ${c.source.surface}; authority=${c.source.authority_class || '—'})`),
      `AFFECTED RECORDS: ${j(p.affected_records)}`,
      `PROPOSED RELATIONS: ${j(p.proposed_relations)}`,
      `PROPOSED STATUS EFFECT: ${j(p.proposed_status_effect)}`,
      `WRITE PLAN (executed only by an explicit Apply, exactly as shown): ${j(p.write_plan)}`,
      `WARNINGS: ${p.warnings.length ? p.warnings.map(w => '\n  ⚠ ' + w).join('') : 'none'}`,
      `HARD RULES TRIGGERED: ${p.hard_rules_triggered.length ? p.hard_rules_triggered.join(' · ') : 'none'}`,
      'Awaiting explicit user decision — Apply executes exactly this write plan via WizRef.importJSONL after a stale-plan check (Apply ≠ USER_DECISION ≠ VERIFIED); Dismiss writes nothing to reference memory.',
    ].join('\n');
  }

  const IS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined' && root === window;
  const api = { VERSION, ADMISSION_MODE, OUTCOMES, REVIEW_STATES, PASSPORT_FIELDS, REQUIRED_FIELDS, TYPED_INPUTS,
    RELATED_ITEM_RELATION_TYPES, EVIDENCE_DIRECTIONS, VERIFIED_LIKE, FORBIDDEN_TRANSITIONS, EQUIVALENCE_DECLARERS, TRUSTED_CALLER_KINDS, INTERACTION_KINDS,
    DUPLICATE_MATCH_FIELDS, REF_SCHEMA_VERSION, TABLE, DDL, DDL_INDEX,
    ACTIONS_TABLE, ACTION_RESULTS, DDL_ACTIONS, IMPORT_SEED_ID,
    initSchema, normalizeIncoming, prepare, getReview, listPending, listActions, apply, dismiss, applyPersisted, dismissPersisted,
    refFingerprint, refSnapshot, refReadiness, formatPacket, formatAction };
  // Non-DOM host seam only (node tests / a future host integration). NOT exported in the browser. The module does
  // NOT authenticate the host: any code that can call hostCallerContext('USER') must already be trusted; a real
  // host owns the authority boundary (see the caller-context comment above and docs §5a).
  if (!IS_DOM) {
    api.hostCallerContext = kind => _mintAuthority(_s(kind).toUpperCase(), 'host');
    api.hostInteractionContext = () => _mintInteraction('host'); // test seam: interaction ≠ authority
  }
  Object.freeze(api);

  // ── Browser glue (explicit, user-initiated only; no agent tool, no context injection) ──
  if (IS_DOM) {
    const db = () => window._wizDB;
    const $ = id => document.getElementById(id);
    // persist the staging write through the VERIFIED awaitable path (oncomplete → exact read-back → SHA-256)
    const persist = async () => {
      if (typeof window._wizSaveDBAsync !== 'function') throw new Error('awaitable IndexedDB save unavailable');
      return window._wizSaveDBAsync();
    };
    // Prepare holds window._wizDB across awaits → it takes the same module lock as apply/dismiss, so a durable
    // apply/dismiss can never swap the database under an in-flight prepare (and vice versa).
    const prepareAndPersist = async (incoming, opts) => {
      if (_actionLock) return { ok: false, errors: ['an apply/dismiss/prepare is in progress — try again'], warnings: [], persisted: false };
      _actionLock = true;
      try {
        if (!db() && typeof window.wizInitSQLite === 'function') await window.wizInitSQLite();
        const r = await prepare(db(), incoming, opts);
        if (!r.ok) return Object.assign(r, { persisted: false });
        try { const ack = await persist(); r.persisted = true; r.persisted_sha256 = ack.sha256 || null; }
        catch (e) { r.persisted = false; r.persist_error = String((e && e.message) || e); }
        return r;
      } finally { _actionLock = false; }
    };
    // Candidate write for the durable apply/dismiss (P1-S2-PERSIST-RACE): stores the given bytes under the same
    // IndexedDB key as _wizSaveDB/_wizSaveDBAsync WITHOUT touching window._wizDB. The put's success callback runs
    // stillValid() (live still byte-identical to the candidate's base) and ABORTS the transaction otherwise, so a
    // candidate that raced a concurrent write is normally never stored (code CONCURRENT_ABORT). After oncomplete the
    // stored bytes are read back and compared byte-for-byte (code VERIFY_FAILED on mismatch: stored state unknown).
    const IDB_NAME = 'wiz_lab_mem_store', IDB_STORE = 'kv', IDB_KEY = 'wiz_lab_sqlite_db'; // same as index.html
    const persistBytes = (bytes, stillValid) => new Promise((resolve, reject) => {
      const err = (code, msg) => Object.assign(new Error(msg), { code });
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      let req;
      try { req = indexedDB.open(IDB_NAME, 1); } catch (e) { return reject(e); }
      req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
      req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
      req.onsuccess = e => {
        const idb = e.target.result; let tx, raced = false;
        try {
          tx = idb.transaction(IDB_STORE, 'readwrite');
          const put = tx.objectStore(IDB_STORE).put(buf, IDB_KEY);
          put.onsuccess = () => { let ok = false; try { ok = stillValid(); } catch (x) { ok = false; } if (!ok) { raced = true; try { tx.abort(); } catch (x) {} } };
        } catch (x) { idb.close(); return reject(x); }
        tx.onabort = () => { idb.close(); reject(raced ? err('CONCURRENT_ABORT', 'concurrent write during persistence — candidate not stored') : (tx.error || new Error('IndexedDB write aborted'))); };
        tx.oncomplete = () => {
          let rb;
          try { rb = idb.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(IDB_KEY); } catch (x) { idb.close(); return reject(err('VERIFY_FAILED', 'read-back failed: ' + x.message)); }
          rb.onsuccess = () => {
            idb.close();
            const res = rb.result, a = new Uint8Array(buf);
            const b = res ? new Uint8Array(res.buffer || res, res.byteOffset || 0, res.byteLength) : null;
            if (!_bytesEq(a, b)) return reject(err('VERIFY_FAILED', 'IndexedDB read-back mismatch'));
            resolve({ bytes: a.length, sha256: null, verified: true, method: 'byte-equality' });
          };
          rb.onerror = () => { idb.close(); reject(err('VERIFY_FAILED', 'read-back failed')); };
        };
      };
    });
    // Script-callable wrapper: ALWAYS untrusted, no interaction (any caller / interaction value passed in is dropped).
    window.wizAdmissionPrepare = async (incoming, opts) => {
      const o = Object.assign({}, opts || {}); delete o.caller; delete o.interaction;
      return prepareAndPersist(incoming, o);
    };
    // USER_INTERACTION context (NOT authority) only from a GENUINE user click on #wizAdmPrepareBtn. Brand-checked
    // getters captured at load time: a plain object {isTrusted:true} or a script-dispatched event never qualifies.
    const EP = typeof Event !== 'undefined' ? Event.prototype : null;
    const gType = EP && Object.getOwnPropertyDescriptor(EP, 'type').get;
    const gTarget = EP && Object.getOwnPropertyDescriptor(EP, 'target').get;
    let gTrusted = null;
    try { gTrusted = Object.getOwnPropertyDescriptor(new Event('x'), 'isTrusted').get; } catch (e) { gTrusted = null; }
    // A genuine click yields ONLY a USER_INTERACTION token (audit/UI + human gate), never semantic authority (P1-3b).
    // Step 2: the same applies to the Apply and Dismiss buttons — the token names the button that was clicked.
    const userClickInteraction = (ev, btnId = 'wizAdmPrepareBtn') => {
      try {
        if (!gTrusted || gTrusted.call(ev) !== true || gType.call(ev) !== 'click') return null;
        const t = gTarget.call(ev); const btn = document.getElementById(btnId);
        if (!btn || !(t === btn || (t && typeof btn.contains === 'function' && btn.contains(t)))) return null;
        return _mintInteraction('ui-click:#' + btnId);
      } catch (e) { return null; } // brand check failed → not a real Event
    };
    // durable host for apply/dismiss: the candidate copy is written to IndexedDB first (persistBytes) and becomes
    // window._wizDB only in the synchronous check-and-swap of _durable (see there)
    const host = { getDb: () => window._wizDB, setDb: d => { window._wizDB = d; }, persist, persistBytes };
    window.wizAdmissionGetReview = id => getReview(db(), id);
    window.wizAdmissionListPending = () => listPending(db());
    window.wizAdmUiRender = () => {
      const el = $('wizAdmPending'); if (!el) return;
      if (!db()) { el.textContent = 'SQLite unavailable'; return; }
      const p = listPending(db());
      el.dataset.count = String(p.length);
      el.textContent = `pending reviews (AWAITING_REVIEW): ${p.length}` + (p.length ? '\n' + p.map(x => `• ${x.review_id} → ${x.proposed_outcome}: ${String(x.packet.incoming.WHAT).slice(0, 90)}`).join('\n') : '');
      const sel = $('wizAdmPendingSelect');
      if (sel) {
        const cur = sel.value; sel.textContent = '';
        const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'show a pending review…'; sel.appendChild(o0);
        for (const x of p) { const o = document.createElement('option'); o.value = x.review_id; o.textContent = `${x.proposed_outcome} · ${x.review_id}`; sel.appendChild(o); }
        sel.value = p.some(x => x.review_id === cur) ? cur : '';
      }
    };
    // show a stored review (packet as prepared THEN + current state + action history); Apply/Dismiss act on THIS review
    window.wizAdmUiShow = (reviewId) => {
      const out = $('wizAdmResult'); if (!out || !db() || !reviewId) return;
      const g = getReview(db(), reviewId); if (!g) { out.textContent = '❌ no such review'; return; }
      out.dataset.reviewId = g.review_id; out.dataset.outcome = g.proposed_outcome; out.dataset.packetSha = g.packet_sha256 || '';
      out.dataset.reviewState = g.review_state;
      out.textContent = formatPacket(g.packet) + `\nCURRENT REVIEW STATE: ${g.review_state}${g.reviewed_at ? ' · reviewed_at ' + new Date(g.reviewed_at).toISOString() : ''}` +
        (g.actions.length ? '\nACTIONS:' + g.actions.map(a => `\n  • ${a.action} → ${a.result} (${a.detail.code})`).join('') : '');
    };
    const actOn = async (action, ev) => {
      const out = $('wizAdmResult'), res = $('wizAdmActionResult'); if (!out || !res) return;
      const btnId = action === 'APPLY' ? 'wizAdmApplyBtn' : 'wizAdmDismissBtn';
      const interaction = userClickInteraction(ev, btnId); // human gate + audit only — NEVER authority
      res.dataset.state = 'pending'; res.dataset.result = ''; res.dataset.reviewState = '';
      const reviewId = out.dataset.reviewId;
      if (!reviewId) { res.textContent = '❌ no review shown — prepare or select one first'; res.dataset.state = 'done'; return; }
      const opts = { expected_packet_sha256: out.dataset.packetSha || undefined }; // execute exactly the SHOWN packet
      if (interaction) opts.interaction = interaction; // no opts.caller is ever set in the browser
      if (action === 'DISMISS') { const rs = (($('wizAdmDismissReason') || {}).value || '').trim(); if (rs) opts.reason = rs; }
      let r;
      try { r = action === 'APPLY' ? await applyPersisted(host, reviewId, opts) : await dismissPersisted(host, reviewId, opts); }
      catch (e) { r = { action, result: 'FAILED', code: 'ERROR', review_state: '?', review_id: reviewId, problems: [e.message] }; }
      res.dataset.result = r.result; res.dataset.code = r.code; res.dataset.reviewState = r.review_state || '';
      res.dataset.persisted = r.persisted ? 'true' : 'false'; res.dataset.interaction = r.interaction || 'NONE';
      res.dataset.authority = r.authority && r.authority.trusted ? r.authority.kind : 'NONE';
      res.dataset.attempts = JSON.stringify((r.attempts || []).map(a => a.event)); res.dataset.durable = r.durable_state || '';
      res.textContent = formatAction(r);
      res.dataset.state = 'done';
      window.wizAdmUiRender();
      if (typeof window.wizRefUiRender === 'function') { try { await window.wizRefUiRender(); } catch (e) {} }
    };
    window.wizAdmUiApply = ev => actOn('APPLY', ev);
    window.wizAdmUiDismiss = ev => actOn('DISMISS', ev);
    window.wizAdmUiExample = () => {
      const ta = $('wizAdmIncoming'); if (!ta) return;
      ta.value = JSON.stringify({ WHAT: '[SYNTHETIC FIXTURE] demo claim for admission review', SOURCE: { source_id: 'fx:adm:src', title: '[SYNTHETIC FIXTURE] admission demo source', surface: 'fixture' },
        WHO: 'USER', WHEN: new Date().toISOString().slice(0, 10), SCOPE: 'demo-project-x', TYPE: 'HYPOTHESIS', STATUS: 'SOURCE_ASSERTION',
        PROVENANCE: { method: 'typed in Memory panel', captured_by: 'USER' } }, null, 2);
    };
    window.wizAdmUiPrepare = async (ev) => {
      const out = $('wizAdmResult'); if (!out) return;
      const interaction = userClickInteraction(ev);
      out.dataset.state = 'pending'; out.dataset.persisted = 'false'; out.dataset.outcome = '';
      let inc;
      try { inc = JSON.parse(($('wizAdmIncoming') || {}).value || ''); } catch (e) { out.textContent = '❌ incoming is not valid JSON: ' + e.message; out.dataset.state = 'done'; return; }
      const scopeTxt = (($('wizAdmScope') || {}).value || '').trim();
      const opts = scopeTxt ? { review_scope: { project_ids: scopeTxt.split(',').map(s => s.trim()).filter(Boolean) } } : {};
      if (interaction) opts.interaction = interaction; // audit/UI only — no opts.caller is ever set in the browser
      out.dataset.interaction = interaction ? 'USER_INTERACTION' : 'NONE';
      out.dataset.caller = 'UNTRUSTED'; // semantic authority: the browser has no path to a trusted authority token
      try {
        const r = await prepareAndPersist(inc, opts);
        if (!r.ok) out.textContent = '❌ passport rejected — nothing staged:\n' + r.errors.map(e => '  • ' + e).join('\n');
        else {
          out.dataset.outcome = r.packet.proposed_outcome; out.dataset.reviewId = r.review_id; out.dataset.packetSha = r.packet_sha256 || '';
          out.dataset.reviewState = 'AWAITING_REVIEW';
          out.dataset.persisted = r.persisted ? 'true' : 'false';
          out.textContent = formatPacket(r.packet) + '\n' + (r.persisted
            ? `REVIEW_PERSISTED = TRUE — staged review saved (IndexedDB write confirmed${r.persisted_sha256 ? ', sha256 ' + r.persisted_sha256 : ''}).`
            : `⚠ REVIEW_PERSISTED = FALSE — staged in memory only (${r.persist_error}).`);
        }
      } catch (e) { out.textContent = '❌ ' + e.message; }
      out.dataset.state = 'done';
      window.wizAdmUiRender();
    };
  }
  return api;
});
