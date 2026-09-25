// wiz-memory-admission.js — Memory Admission Controller v0.1 · REVIEW MODE ONLY (lab, step 1 of 2)
// ─────────────────────────────────────────────────────────────────────────────
// Status: RESEARCH/LAB · NOT CANON · NOT RUNTIME AUTHORIZATION · NOT A GLOBAL MEMORY OWNER ·
// NOT AN AUTOMATIC MEMORY WRITER · NOT AN E0-A REPLACEMENT. See docs/MEMORY_ADMISSION_REVIEW.md.
//
// An incoming information object ("memory passport") is validated, related wiz_ref_* records are
// retrieved READ-ONLY from wiz_ref_*, deterministic hard rules are applied, and a transparent
// REVIEW PACKET is produced and staged in the lab-only table wiz_admission_reviews with
// review_state = 'AWAITING_REVIEW'. Nothing else happens until an explicit user decision.
//
//   LLM OUTPUT ≠ MEMORY DECISION · SIMILARITY ≠ IDENTITY ≠ DUPLICATE ≠ SUPERSESSION ·
//   NEW INFORMATION ≠ NEW MEMORY · RETRIEVED ≠ EVIDENCE · RELATION ≠ TRUTH
//
// ZERO-WRITE GUARANTEE (audit rev 1): this file contains NO statement that writes wiz_ref_* tables and calls
// NO WizRef function that takes a db (WizRef.search/trace/… run WizRef.initSchema, which can migrate/backfill/
// repair wiz_ref_*). Retrieval is this file's own SELECT-only SQL, executed under PRAGMA query_only=ON inside a
// SAVEPOINT that is always rolled back; wiz_ref_* is snapshotted (schema + every row, incl. meta/pins/FTS shadow
// tables) before, after and at staging time — any difference aborts with nothing staged. A legacy or repair-needing
// reference DB is never migrated or repaired here → UNCERTAIN with a warning. The only table written is
// wiz_admission_reviews. apply()/dismiss() do NOT exist in step 1.
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.WizAdmission = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  const VERSION = '0.1-step1';
  // The ONLY admission mode. There is no AUTO / AUTONOMOUS / BACKGROUND_ADMIT / AUTO_PROMOTE / AUTO_MERGE.
  const ADMISSION_MODE = 'REVIEW';
  // CLOSED outcome enum — exactly these 8 values, frozen.
  const OUTCOMES = Object.freeze(['DUPLICATE', 'REFINEMENT', 'NEW_EVIDENCE', 'CONTRADICTION',
    'NEW_RELATED_ITEM', 'STATUS_CHANGE', 'OUT_OF_SCOPE', 'UNCERTAIN']);
  // Review WORKFLOW state (not an epistemic status). Step 1 only ever writes AWAITING_REVIEW.
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
    packet_json TEXT NOT NULL
  )`;
  const DDL_INDEX = `CREATE INDEX IF NOT EXISTS idx_wiz_admission_reviews_state ON ${TABLE}(review_state, created_at)`;

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

  // ── schema (additive: one new lab table + one index; never touches wiz_ref_* or personal memory) ──
  function initSchema(db) {
    if (!db) return false;
    db.run(DDL); db.run(DDL_INDEX);
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

  // ── trusted caller context (audit rev 1, P1-3) ──
  // Authority can never come from the incoming JSON. A trusted caller context is an unforgeable token minted
  // inside this module: in the browser ONLY from a genuine user click on the Prepare button (Event.isTrusted,
  // brand-checked), in a non-DOM host (node tests / future host integration) via hostCallerContext(). Any other
  // opts.caller value (plain object, string, token from elsewhere) is ignored → UNTRUSTED. Default = UNTRUSTED.
  const TRUSTED_CALLER_KINDS = Object.freeze(['USER', 'EXTERNAL_SYSTEM']);
  const _tokens = new WeakSet();
  function _mintCaller(kind, via) {
    if (!TRUSTED_CALLER_KINDS.includes(kind)) throw new Error('caller kind must be one of ' + TRUSTED_CALLER_KINDS.join('/'));
    const t = Object.freeze({ kind, via: String(via || 'host') }); _tokens.add(t); return t;
  }
  function callerOf(opts) {
    const c = opts && opts.caller;
    if (c && typeof c === 'object' && _tokens.has(c)) return { kind: c.kind, via: c.via, trusted: true };
    return { kind: 'UNTRUSTED', via: c === undefined || c === null ? 'none' : 'unverified caller value ignored', trusted: false };
  }

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
    if (st === 'USER_DECISION' && !trustedAs('USER')) { hard.push('LLM OUTPUT ≠ MEMORY DECISION'); warnings.push(`HARD_RULE_BLOCKED: STATUS USER_DECISION requires a trusted USER caller context (caller: ${caller.kind})`); return res('UNCERTAIN', 'STATUS USER_DECISION claimed without trusted USER caller context; the string in the passport is not proof'); }
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
        warnings.push(`EQUIVALENT_TO declared_by "${eq.declared_by}" not accepted: requires declared_by ∈ ${EQUIVALENCE_DECLARERS.join('/')} with a matching TRUSTED caller context (caller: ${caller.kind}${caller.trusted ? '' : ', untrusted'}) and a non-model WHO (WHO: ${inc.WHO})`);
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
        warnings.push(`AUTHORITY_NOT_PROVEN: authority "${sc.authority}" in the passport is not backed by a matching trusted caller context (caller: ${caller.kind}${caller.trusted ? '' : ', untrusted'}; WHO: ${inc.WHO})`);
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
      return { snapBefore, readiness, candidates, d, snapAfter: refSnapshot(db) };
    });
    const snapRestored = refSnapshot(db);
    if (ph.snapAfter !== ph.snapBefore || snapRestored !== ph.snapBefore) throw new Error('ZERO-WRITE VIOLATION: wiz_ref_* changed during prepare — nothing staged');
    const { readiness, candidates, d } = ph;
    if (!OUTCOMES.includes(d.outcome)) throw new Error('internal: outcome outside the closed enum');
    const fp = ph.snapBefore === JSON.stringify({ schema: [], tables: {} }) ? null : await W.sha256Hex(ph.snapBefore);
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
      write_plan: { executes: false, note: 'PROPOSAL ONLY — nothing has been written to reference memory; apply is step 2 (via WizRef.importJSONL) and requires an explicit user decision', proposed_new_logical_item_id: d.writes.some(w => w.op === 'ADD_ITEM') ? newLogicalId : null, writes: d.writes },
      ref_fingerprint: { before: fp, after: fp, unchanged: true },
      state: 'AWAITING_REVIEW',
    };
    for (const f of ['reason', 'affected_records', 'provenance']) if (packet[f] === undefined || packet[f] === null) throw new Error('internal: mandatory packet field missing: ' + f);
    // Phase 2 — STAGING (sync): one INSERT into wiz_admission_reviews; wiz_ref_* re-verified before COMMIT
    initSchema(db);
    db.run('BEGIN');
    try {
      db.run(`INSERT INTO ${TABLE}(review_id,created_at,mode,incoming_json,candidate_json,proposed_outcome,rationale,affected_records_json,write_plan_json,review_state,reviewed_at,packet_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,NULL,?)`, [reviewId, createdAt, ADMISSION_MODE, JSON.stringify(inc), JSON.stringify(candidates), d.outcome, d.reason,
        JSON.stringify(d.affected), JSON.stringify(packet.write_plan), 'AWAITING_REVIEW', JSON.stringify(packet)]);
      if (refSnapshot(db) !== ph.snapBefore) throw new Error('ZERO-WRITE VIOLATION: wiz_ref_* changed between retrieval and staging — nothing staged');
      db.run('COMMIT');
    } catch (e) { try { db.run('ROLLBACK'); } catch (_) {} throw e; }
    return { ok: true, errors: [], warnings: packet.warnings, review_id: reviewId, packet };
  }

  function _fromRow(r) {
    return { review_id: r[0], created_at: r[1], mode: r[2], proposed_outcome: r[3], rationale: r[4], review_state: r[5], reviewed_at: r[6], packet: JSON.parse(r[7]) };
  }
  const SEL = `SELECT review_id,created_at,mode,proposed_outcome,rationale,review_state,reviewed_at,packet_json FROM ${TABLE}`;
  function _hasTable(db) { return _rowsRaw(db, `SELECT 1 FROM sqlite_master WHERE type='table' AND name='${TABLE}'`).length > 0; }
  function getReview(db, reviewId) { if (!db || !_hasTable(db)) return null; const r = _rowsRaw(db, SEL + ' WHERE review_id=?', [reviewId])[0]; return r ? _fromRow(r) : null; }
  function listPending(db) { if (!db || !_hasTable(db)) return []; return _rowsRaw(db, SEL + " WHERE review_state='AWAITING_REVIEW' ORDER BY created_at, review_id").map(_fromRow); }

  function formatPacket(p) {
    const j = v => JSON.stringify(v, null, 2);
    return [
      `🧠 ADMISSION REVIEW · mode=${p.mode} · state=${p.state} · ${p.review_id}`,
      'LAB / NOT CANON / NOT RUNTIME AUTHORIZATION — proposal only; nothing written to reference memory.',
      `PROPOSED OUTCOME: ${p.proposed_outcome}   (basis: ${p.decision_basis})`,
      `REASON: ${p.reason}`,
      `INCOMING: ${p.incoming.WHAT}\n  type=${p.incoming.TYPE} · status=${p.incoming.STATUS} · scope=${p.incoming.SCOPE} · who=${p.incoming.WHO} · when=${p.incoming.WHEN}`,
      `CALLER CONTEXT: ${p.caller ? p.caller.kind + (p.caller.trusted ? ' (trusted, via ' + p.caller.via + ')' : ' (untrusted — passport cannot authorise itself)') : '—'}`,
      `REFERENCE MEMORY: ${p.reference_memory ? p.reference_memory.state + ' · read-only' + (p.reference_memory.issues.length ? ' · ' + p.reference_memory.issues.join('; ') : '') : '—'}`,
      `PROVENANCE: ${j(p.provenance)}`,
      `CANDIDATES (${p.candidate_matches.length}; similarity ranks only):`,
      ...p.candidate_matches.map(c => `  #${c.rank} ${c.version_id} [${c.item_type} / ${c.epistemic_state} / ${c.lifecycle}]${c.deterministic.identical_claim_text ? ' IDENTICAL-TEXT' : ''}${c.deterministic.same_logical_item ? ' SAME-ITEM_ID' : ''}\n    ${c.claim}\n    source: ${c.source.title} (${c.source.source_id}; ${c.source.surface}; authority=${c.source.authority_class || '—'})`),
      `AFFECTED RECORDS: ${j(p.affected_records)}`,
      `PROPOSED RELATIONS: ${j(p.proposed_relations)}`,
      `PROPOSED STATUS EFFECT: ${j(p.proposed_status_effect)}`,
      `WRITE PLAN (not executed): ${j(p.write_plan)}`,
      `WARNINGS: ${p.warnings.length ? p.warnings.map(w => '\n  ⚠ ' + w).join('') : 'none'}`,
      `HARD RULES TRIGGERED: ${p.hard_rules_triggered.length ? p.hard_rules_triggered.join(' · ') : 'none'}`,
      'Awaiting explicit user decision (apply/dismiss are step 2 — not available in this build).',
    ].join('\n');
  }

  const IS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined' && root === window;
  const api = { VERSION, ADMISSION_MODE, OUTCOMES, REVIEW_STATES, PASSPORT_FIELDS, REQUIRED_FIELDS, TYPED_INPUTS,
    RELATED_ITEM_RELATION_TYPES, EVIDENCE_DIRECTIONS, VERIFIED_LIKE, FORBIDDEN_TRANSITIONS, EQUIVALENCE_DECLARERS, TRUSTED_CALLER_KINDS,
    DUPLICATE_MATCH_FIELDS, REF_SCHEMA_VERSION, TABLE, DDL, DDL_INDEX,
    initSchema, normalizeIncoming, prepare, getReview, listPending, refFingerprint, refSnapshot, refReadiness, formatPacket };
  // Non-DOM host only (node tests / a future host integration): mint a trusted caller context. NOT exported in the
  // browser — there the only trusted context is a genuine user click on the Prepare button (see glue below).
  if (!IS_DOM) api.hostCallerContext = kind => _mintCaller(_s(kind).toUpperCase(), 'host');
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
    const prepareAndPersist = async (incoming, opts) => {
      if (!db() && typeof window.wizInitSQLite === 'function') await window.wizInitSQLite();
      const r = await prepare(db(), incoming, opts);
      if (!r.ok) return Object.assign(r, { persisted: false });
      try { const ack = await persist(); r.persisted = true; r.persisted_sha256 = ack.sha256 || null; }
      catch (e) { r.persisted = false; r.persist_error = String((e && e.message) || e); }
      return r;
    };
    // Script-callable wrapper: ALWAYS untrusted (any caller value passed in is dropped).
    window.wizAdmissionPrepare = async (incoming, opts) => {
      const o = Object.assign({}, opts || {}); delete o.caller;
      return prepareAndPersist(incoming, o);
    };
    // Trusted USER context only from a GENUINE user click on #wizAdmPrepareBtn. Brand-checked getters captured at
    // load time: a plain object {isTrusted:true} or a script-dispatched event (isTrusted=false) never qualifies.
    const EP = typeof Event !== 'undefined' ? Event.prototype : null;
    const gType = EP && Object.getOwnPropertyDescriptor(EP, 'type').get;
    const gTarget = EP && Object.getOwnPropertyDescriptor(EP, 'target').get;
    let gTrusted = null;
    try { gTrusted = Object.getOwnPropertyDescriptor(new Event('x'), 'isTrusted').get; } catch (e) { gTrusted = null; }
    const userClickCaller = ev => {
      try {
        if (!gTrusted || gTrusted.call(ev) !== true || gType.call(ev) !== 'click') return null;
        const t = gTarget.call(ev); const btn = document.getElementById('wizAdmPrepareBtn');
        if (!btn || !(t === btn || (t && typeof btn.contains === 'function' && btn.contains(t)))) return null;
        return _mintCaller('USER', 'ui-click:#wizAdmPrepareBtn');
      } catch (e) { return null; } // brand check failed → not a real Event
    };
    window.wizAdmissionGetReview = id => getReview(db(), id);
    window.wizAdmissionListPending = () => listPending(db());
    window.wizAdmUiRender = () => {
      const el = $('wizAdmPending'); if (!el) return;
      if (!db()) { el.textContent = 'SQLite unavailable'; return; }
      const p = listPending(db());
      el.dataset.count = String(p.length);
      el.textContent = `pending reviews (AWAITING_REVIEW): ${p.length}` + (p.length ? '\n' + p.map(x => `• ${x.review_id} → ${x.proposed_outcome}: ${String(x.packet.incoming.WHAT).slice(0, 90)}`).join('\n') : '');
    };
    window.wizAdmUiExample = () => {
      const ta = $('wizAdmIncoming'); if (!ta) return;
      ta.value = JSON.stringify({ WHAT: '[SYNTHETIC FIXTURE] demo claim for admission review', SOURCE: { source_id: 'fx:adm:src', title: '[SYNTHETIC FIXTURE] admission demo source', surface: 'fixture' },
        WHO: 'USER', WHEN: new Date().toISOString().slice(0, 10), SCOPE: 'demo-project-x', TYPE: 'HYPOTHESIS', STATUS: 'SOURCE_ASSERTION',
        PROVENANCE: { method: 'typed in Memory panel', captured_by: 'USER' } }, null, 2);
    };
    window.wizAdmUiPrepare = async (ev) => {
      const out = $('wizAdmResult'); if (!out) return;
      const caller = userClickCaller(ev);
      out.dataset.state = 'pending'; out.dataset.persisted = 'false'; out.dataset.outcome = '';
      let inc;
      try { inc = JSON.parse(($('wizAdmIncoming') || {}).value || ''); } catch (e) { out.textContent = '❌ incoming is not valid JSON: ' + e.message; out.dataset.state = 'done'; return; }
      const scopeTxt = (($('wizAdmScope') || {}).value || '').trim();
      const opts = scopeTxt ? { review_scope: { project_ids: scopeTxt.split(',').map(s => s.trim()).filter(Boolean) } } : {};
      if (caller) opts.caller = caller;
      out.dataset.caller = caller ? 'USER' : 'UNTRUSTED';
      try {
        const r = await prepareAndPersist(inc, opts);
        if (!r.ok) out.textContent = '❌ passport rejected — nothing staged:\n' + r.errors.map(e => '  • ' + e).join('\n');
        else {
          out.dataset.outcome = r.packet.proposed_outcome; out.dataset.reviewId = r.review_id;
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
