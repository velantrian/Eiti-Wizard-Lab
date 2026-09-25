// wiz-ref-memory.js — Velantrim REFERENCE MEMORY namespace for Eiti Wizard Lab
// ─────────────────────────────────────────────────────────────────────────────
// A separate, source-bound reference-knowledge namespace (wiz_ref_*) living in
// the SAME SQLite WASM database as personal memory (window._wizDB), persisted
// through the EXISTING SQLite→IndexedDB save path (_wizSaveDB →
// IndexedDB 'wiz_lab_mem_store' / key 'wiz_lab_sqlite_db').
//
// Epistemic contract (see docs/REFERENCE_MEMORY.md):
//   * reference items are NOT personal facts: never written to wiz_facts,
//     never decayed (wizDecayTick), never promoted by mem_validate;
//   * the importer preserves source_status / epistemic_state / currentness
//     VERBATIM and never qualifies anything (RETRIEVAL ≠ QUALIFICATION);
//   * supersession never deletes: old rows are kept with lifecycle=SUPERSEDED;
//   * every retrieved item carries provenance (source, kind, authority, as_of);
//   * no automatic context injection — explicit retrieval only.
//
// Pure functions take `db` (a sql.js Database) as the first argument, so the
// same code runs in the browser and in Node tests (tests/refmem/*).
(function (root) {
  'use strict';

  const SCHEMA_VERSION = '3'; // v2: capture provenance, relation record_hash · v3: immutable item versions + pinned relation endpoints
  const FORMAT = 'wiz-ref-jsonl/1';

  const ENUMS = {
    surface: ['github', 'notion', 'drive', 'book', 'upload', 'demo', 'fixture', 'local'],
    source_kind: ['IMPLEMENTATION', 'ARCHITECTURE', 'RESEARCH', 'HANDOFF', 'NAVIGATION',
      'HUMAN_REFERENCE', 'HISTORICAL_CHRONICLE', 'VALIDATION', 'BOOK_DONOR'],
    authority_class: ['IMPLEMENTATION_EVIDENCE', 'ARCHITECTURE_STATUS', 'RESEARCH_SYNTHESIS',
      'NAVIGATION_ONLY', 'HUMAN_REFERENCE_ONLY', 'HISTORICAL_ONLY', 'VALIDATION_EVIDENCE',
      'RESEARCH_DONOR', 'DEMO_ONLY'],
    currentness: ['CURRENT', 'DRAFT', 'RESEARCH', 'HISTORICAL', 'SUPERSEDED', 'UNKNOWN'],
    item_type: ['PROJECT_ROLE', 'PROJECT_BOUNDARY', 'INVARIANT', 'IMPLEMENTATION_FACT',
      'ARCHITECTURE_POSITION', 'RESEARCH_RESULT', 'HYPOTHESIS', 'OPEN_QUESTION', 'NEXT_ACTION',
      'DECISION', 'REJECTED_BRANCH', 'HISTORICAL_NOTE', 'VALIDATION_RESULT', 'ROUTE',
      'HUMAN_LENS', 'DONOR', 'UNKNOWN'],
    relation_type: ['OWNS', 'ROUTES_TO', 'DERIVED_FROM', 'SUPERSEDES', 'CONTRADICTS', 'SUPPORTS',
      'COUNTEREVIDENCE', 'RELATED_TO', 'TESTED_BY', 'IMPLEMENTED_IN', 'DOCUMENTED_IN'],
  };
  // Epistemic states that an importer must never INVENT. They are accepted only
  // verbatim from the record (with a warning) — the importer itself never sets them.
  const QUALIFYING_STATES = ['QUALIFIED', 'QUALIFIED_CLAIM', 'VERIFIED', 'VALIDATED', 'CANON', 'TRUE', 'FACT'];

  // ── Schema (additive, idempotent) ─────────────────────────────────────────
  // item column <f>_at_capture  ←  source column
  const CAPTURE_MAP = {
    source_title: 'title', source_surface: 'surface', source_kind: 'source_kind',
    source_authority_class: 'authority_class', source_revision: 'revision', source_as_of: 'as_of',
    source_currentness: 'currentness', source_content_hash: 'content_hash',
  };
  const CAPTURE_FIELDS = Object.keys(CAPTURE_MAP);
  const COLUMNS = {
    wiz_ref_sources: [
      ['source_id', 'TEXT PRIMARY KEY'], ['title', 'TEXT NOT NULL'], ['surface', 'TEXT NOT NULL'],
      ['source_kind', 'TEXT NOT NULL'], ['authority_class', 'TEXT'], ['project_id', 'TEXT'],
      ['locator', 'TEXT'], ['revision', 'TEXT'], ['as_of', 'TEXT'], ['currentness', 'TEXT'],
      ['privacy', "TEXT DEFAULT 'private'"], ['content_hash', 'TEXT'],
      ['seed_id', 'TEXT'], ['first_seed_version', 'TEXT'], ['last_seed_version', 'TEXT'],
      ['record_hash', 'TEXT'], ['imported_at', 'INTEGER'],
    ],
    wiz_ref_items: [
      ['item_id', 'TEXT PRIMARY KEY'], ['source_id', 'TEXT NOT NULL REFERENCES wiz_ref_sources(source_id)'],
      ['project_id', 'TEXT'], ['item_type', 'TEXT NOT NULL'], ['claim', 'TEXT NOT NULL'],
      ['source_section', 'TEXT'], ['source_status', 'TEXT'], ['epistemic_state', 'TEXT'],
      ['authority_scope', 'TEXT'], ['validity', 'TEXT'], ['confidence', 'REAL'], ['as_of', 'TEXT'],
      ['supersedes_item_id', 'TEXT'], ['created_at', 'INTEGER'],
      ['provenance', 'TEXT'], ['lifecycle', "TEXT DEFAULT 'ACTIVE'"], ['superseded_by', 'TEXT'],
      ['record_hash', 'TEXT'], ['seed_id', 'TEXT'], ['first_seed_version', 'TEXT'], ['last_seed_version', 'TEXT'],
      // v2: snapshot of the source record at the moment this item content was captured
      // (a later source revision never rewrites an older item's provenance)
      ...CAPTURE_FIELDS.map(f => [f + '_at_capture', 'TEXT']), ['capture_backfilled', 'INTEGER DEFAULT 0'],
      // v3: immutable version identity. version_id = '<logical_item_id>@<record_hash>'. The current row of a
      // logical item has item_id = logical_item_id; archived versions have item_id = version_id.
      ['logical_item_id', 'TEXT'], ['version_id', 'TEXT'],
    ],
    wiz_ref_relations: [
      ['relation_id', 'TEXT PRIMARY KEY'], ['from_item_id', 'TEXT NOT NULL'], ['to_item_id', 'TEXT NOT NULL'],
      ['relation_type', 'TEXT NOT NULL'], ['epistemic_status', 'TEXT NOT NULL'], ['source_id', 'TEXT'],
      ['scope', 'TEXT'], ['rationale', 'TEXT'], ['seed_id', 'TEXT'], ['created_at', 'INTEGER'],
      ['record_hash', 'TEXT'], // v2
      // v3: relations point to IMMUTABLE item versions (pinned when the relation is first stored)
      ['from_version_id', 'TEXT'], ['to_version_id', 'TEXT'], ['pin_backfilled', 'INTEGER DEFAULT 0'],
    ],
    wiz_ref_meta: [['key', 'TEXT PRIMARY KEY'], ['value', 'TEXT']],
  };
  const ITEM_CONTENT_FIELDS = ['source_id', 'project_id', 'item_type', 'claim', 'source_section',
    'source_status', 'epistemic_state', 'authority_scope', 'validity', 'confidence', 'as_of',
    'supersedes_item_id', 'provenance'];
  const REL_CONTENT_FIELDS = ['relation_type', 'from_item_id', 'to_item_id', 'epistemic_status', 'source_id', 'scope', 'rationale'];
  const SOURCE_CONTENT_FIELDS = ['title', 'surface', 'source_kind', 'authority_class', 'project_id',
    'locator', 'revision', 'as_of', 'currentness', 'privacy', 'content_hash'];

  function _colNames(db, table) {
    const r = db.exec(`PRAGMA table_info(${table})`);
    return r.length ? r[0].values.map(v => v[1]) : [];
  }

  function initSchema(db) {
    if (!db) return null;
    for (const [table, cols] of Object.entries(COLUMNS)) {
      db.run(`CREATE TABLE IF NOT EXISTS ${table} (${cols.map(c => c[0] + ' ' + c[1]).join(', ')})`);
      // additive migration for DBs created by an earlier wiz_ref schema
      const have = new Set(_colNames(db, table));
      for (const [name, decl] of cols) {
        if (have.has(name)) continue;
        const safeDecl = decl.replace(/PRIMARY KEY|NOT NULL|REFERENCES .*/g, '').trim() || 'TEXT';
        db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${safeDecl}`);
      }
    }
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS wiz_ref_items_fts
      USING fts5(item_id UNINDEXED, claim, project_id, item_type, tokenize='unicode61')`);
    db.run('CREATE INDEX IF NOT EXISTS wiz_ref_items_project ON wiz_ref_items(project_id)');
    db.run('CREATE INDEX IF NOT EXISTS wiz_ref_items_source ON wiz_ref_items(source_id)');
    db.run('CREATE INDEX IF NOT EXISTS wiz_ref_rel_from ON wiz_ref_relations(from_item_id)');
    db.run('CREATE INDEX IF NOT EXISTS wiz_ref_rel_to ON wiz_ref_relations(to_item_id)');
    db.run('CREATE INDEX IF NOT EXISTS wiz_ref_items_version ON wiz_ref_items(version_id)');
    db.run('CREATE INDEX IF NOT EXISTS wiz_ref_rel_from_v ON wiz_ref_relations(from_version_id)');
    db.run('CREATE INDEX IF NOT EXISTS wiz_ref_rel_to_v ON wiz_ref_relations(to_version_id)');
    // v2 backfill for rows written before capture provenance existed: capture := the source
    // record as it is at migration time, explicitly marked capture_backfilled=1.
    db.run(`UPDATE wiz_ref_items SET ${CAPTURE_FIELDS.map(f => `${f}_at_capture=(SELECT s.${CAPTURE_MAP[f]} FROM wiz_ref_sources s WHERE s.source_id=wiz_ref_items.source_id)`).join(', ')},
              capture_backfilled=1
            WHERE source_title_at_capture IS NULL AND COALESCE(capture_backfilled,0)=0`);
    const nBackfilled = db.getRowsModified();
    // FTS consistency: index any item row missing from wiz_ref_items_fts (e.g. rows from an older DB)
    db.run(`INSERT INTO wiz_ref_items_fts(item_id,claim,project_id,item_type)
            SELECT item_id, claim, COALESCE(project_id,''), item_type FROM wiz_ref_items
            WHERE item_id NOT IN (SELECT item_id FROM wiz_ref_items_fts)`);
    const relNoHash = _rowsRaw(db, 'SELECT * FROM wiz_ref_relations WHERE record_hash IS NULL');
    for (const r of relNoHash) db.run('UPDATE wiz_ref_relations SET record_hash=? WHERE relation_id=?', [_recordHash(r, REL_CONTENT_FIELDS), r.relation_id]);
    // v3 backfill (deterministic): every item row gets its immutable version id; archived rows
    // ('<logical>@<14-hex>', SUPERSEDED) are their own version; then every relation endpoint is pinned to the
    // version CURRENT AT MIGRATION TIME and marked pin_backfilled=1 (unresolvable endpoints stay NULL).
    const noVer = _rowsRaw(db, 'SELECT * FROM wiz_ref_items WHERE version_id IS NULL');
    for (const r of noVer) {
      const m = /^(.*)@([0-9a-f]{14})$/.exec(r.item_id);
      const archived = m && r.lifecycle === 'SUPERSEDED';
      const h = r.record_hash || _recordHash(r, ITEM_CONTENT_FIELDS);
      db.run('UPDATE wiz_ref_items SET logical_item_id=?, version_id=?, record_hash=COALESCE(record_hash,?) WHERE item_id=?',
        [archived ? m[1] : r.item_id, archived ? r.item_id : r.item_id + '@' + h, h, r.item_id]);
    }
    const noPin = _rowsRaw(db, 'SELECT * FROM wiz_ref_relations WHERE from_version_id IS NULL AND to_version_id IS NULL AND COALESCE(pin_backfilled,0)=0');
    for (const r of noPin) {
      const pin = id => { const x = _getItemRowRaw(db, id); return x ? x.version_id : null; };
      db.run('UPDATE wiz_ref_relations SET from_version_id=?, to_version_id=?, pin_backfilled=1 WHERE relation_id=?',
        [pin(r.from_item_id), pin(r.to_item_id), r.relation_id]);
    }
    const cur = getMeta(db, 'schema_version');
    if (cur == null) setMeta(db, 'schema_version', SCHEMA_VERSION);
    else if (Number(cur) < Number(SCHEMA_VERSION)) {
      setMeta(db, 'schema_version', SCHEMA_VERSION);
      setMeta(db, 'migrated_from_schema_' + cur, JSON.stringify({ at: Date.now(), items_capture_backfilled: nBackfilled,
        relations_hashed: relNoHash.length, items_versioned: noVer.length, relations_pinned: noPin.length }));
    }
    return getMeta(db, 'schema_version');
  }

  function _getItemRowRaw(db, id) {
    const st = db.prepare('SELECT * FROM wiz_ref_items WHERE item_id=?'); st.bind([id]);
    const r = st.step() ? st.getAsObject() : null; st.free(); return r;
  }
  // an immutable version → the row that holds it (archived row preferred; identical content either way)
  function _getVersionRow(db, versionId) {
    if (!versionId) return null;
    const st = db.prepare('SELECT * FROM wiz_ref_items WHERE version_id=? ORDER BY (item_id=version_id) DESC LIMIT 1'); st.bind([versionId]);
    const r = st.step() ? st.getAsObject() : null; st.free(); return r;
  }
  function _rowsRaw(db, sql, params) {
    const st = db.prepare(sql); st.bind(params || []);
    const out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out;
  }
  function getMeta(db, key) {
    const r = db.exec('SELECT value FROM wiz_ref_meta WHERE key=?', [key]);
    return r.length && r[0].values.length ? r[0].values[0][0] : null;
  }
  function setMeta(db, key, value) {
    db.run('INSERT INTO wiz_ref_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      [key, value == null ? null : String(value)]);
  }
  function allMeta(db) {
    const out = {};
    const r = db.exec('SELECT key,value FROM wiz_ref_meta ORDER BY key');
    if (r.length) for (const [k, v] of r[0].values) out[k] = v;
    return out;
  }

  // ── Hashing ───────────────────────────────────────────────────────────────
  // record hash: synchronous, deterministic (cyrb53, 53-bit) — only used for
  // change detection of individual records; seed_hash uses SHA-256 when available.
  function _cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
  }
  function _recordHash(obj, fields) {
    return _cyrb53(JSON.stringify(fields.map(f => (obj[f] === undefined ? null : obj[f]))));
  }
  async function sha256Hex(text) {
    const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
    if (c && c.subtle && typeof TextEncoder !== 'undefined') {
      const buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return 'sha256:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return 'cyrb53:' + _cyrb53(text);
  }

  // ── Importer ──────────────────────────────────────────────────────────────
  function _str(v) { return v === undefined || v === null || v === '' ? null : String(v); }
  function _num(v) { return v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v); }

  function _normSource(s) {
    return {
      source_id: _str(s.source_id), title: _str(s.title), surface: _str(s.surface),
      source_kind: _str(s.source_kind), authority_class: _str(s.authority_class),
      project_id: _str(s.project_id), locator: _str(s.locator), revision: _str(s.revision),
      as_of: _str(s.as_of), currentness: _str(s.currentness),
      privacy: _str(s.privacy) || 'private', content_hash: _str(s.content_hash),
    };
  }
  function _normItem(it, src) {
    return {
      item_id: _str(it.item_id), source_id: _str(it.source_id) || (src && src.source_id),
      project_id: _str(it.project_id) || (src && src.project_id) || null,
      item_type: _str(it.item_type), claim: _str(it.claim),
      source_section: _str(it.source_section), source_status: _str(it.source_status),
      // default is the WEAKEST reading: the source asserts it. Never stronger.
      epistemic_state: _str(it.epistemic_state) || 'SOURCE_ASSERTION',
      authority_scope: _str(it.authority_scope), validity: _str(it.validity),
      confidence: _num(it.confidence), as_of: _str(it.as_of) || (src && src.as_of) || null,
      supersedes_item_id: _str(it.supersedes_item_id), provenance: _str(it.provenance),
      created_at: _num(it.created_at),
      lifecycle: it.lifecycle === 'SUPERSEDED' ? 'SUPERSEDED' : null, superseded_by: _str(it.superseded_by),
      seed_id: _str(it.seed_id), first_seed_version: _str(it.first_seed_version),
      last_seed_version: _str(it.last_seed_version),
      // capture provenance carried by a record (e.g. restoring an export); otherwise taken from the source at import
      capture: CAPTURE_FIELDS.some(f => it[f + '_at_capture'] != null)
        ? Object.fromEntries(CAPTURE_FIELDS.map(f => [f, _str(it[f + '_at_capture'])])) : null,
      capture_backfilled: it.capture_backfilled ? 1 : 0,
      logical_item_id: _str(it.logical_item_id), version_id: _str(it.version_id),
    };
  }
  function _captureFromSource(src) {
    return Object.fromEntries(CAPTURE_FIELDS.map(f => [f, src ? _str(src[CAPTURE_MAP[f]]) : null]));
  }
  function _validateSource(s, errs, warns, line) {
    if (!s.source_id || !s.title || !s.surface || !s.source_kind) { errs.push({ line, msg: 'source requires source_id,title,surface,source_kind' }); return false; }
    if (!ENUMS.source_kind.includes(s.source_kind)) { errs.push({ line, msg: 'unknown source_kind ' + s.source_kind }); return false; }
    if (s.authority_class && !ENUMS.authority_class.includes(s.authority_class)) { errs.push({ line, msg: 'unknown authority_class ' + s.authority_class }); return false; }
    if (!ENUMS.surface.includes(s.surface)) warns.push({ line, msg: 'non-standard surface ' + s.surface });
    if (s.currentness && !ENUMS.currentness.includes(s.currentness)) warns.push({ line, msg: 'non-standard currentness kept verbatim: ' + s.currentness });
    if (s.source_kind === 'HUMAN_REFERENCE' && s.authority_class !== 'HUMAN_REFERENCE_ONLY') { errs.push({ line, msg: 'HUMAN_REFERENCE source must have authority_class HUMAN_REFERENCE_ONLY' }); return false; }
    if (s.source_kind === 'BOOK_DONOR' && s.authority_class !== 'RESEARCH_DONOR') { errs.push({ line, msg: 'BOOK_DONOR source must have authority_class RESEARCH_DONOR' }); return false; }
    return true;
  }
  function _validateItem(it, src, errs, warns, line) {
    if (!it.item_id || !it.source_id || !it.item_type || !it.claim) { errs.push({ line, msg: 'item requires item_id,source_id,item_type,claim' }); return false; }
    if (!ENUMS.item_type.includes(it.item_type)) { errs.push({ line, msg: 'unknown item_type ' + it.item_type }); return false; }
    const human = src && src.authority_class === 'HUMAN_REFERENCE_ONLY';
    if (human && it.item_type !== 'HUMAN_LENS') { errs.push({ line, msg: 'items of HUMAN_REFERENCE_ONLY sources must be HUMAN_LENS' }); return false; }
    if (it.item_type === 'HUMAN_LENS' && !human) { errs.push({ line, msg: 'HUMAN_LENS items require a HUMAN_REFERENCE_ONLY source' }); return false; }
    if (QUALIFYING_STATES.includes(String(it.epistemic_state).toUpperCase()))
      warns.push({ line, msg: `epistemic_state "${it.epistemic_state}" kept VERBATIM as the source's own assertion; importer does not qualify` });
    return true;
  }

  function _getSource(db, id) {
    const st = db.prepare('SELECT * FROM wiz_ref_sources WHERE source_id=?'); st.bind([id]);
    const r = st.step() ? st.getAsObject() : null; st.free(); return r;
  }
  function _getItemRow(db, id) {
    const st = db.prepare('SELECT * FROM wiz_ref_items WHERE item_id=?'); st.bind([id]);
    const r = st.step() ? st.getAsObject() : null; st.free(); return r;
  }
  const ITEM_COLS = COLUMNS.wiz_ref_items.map(c => c[0]);
  function _insertItemRow(db, row) {
    db.run(`INSERT INTO wiz_ref_items(${ITEM_COLS.join(',')}) VALUES(${ITEM_COLS.map(() => '?').join(',')})`,
      ITEM_COLS.map(c => (row[c] === undefined ? null : row[c])));
    db.run('INSERT INTO wiz_ref_items_fts(item_id,claim,project_id,item_type) VALUES(?,?,?,?)',
      [row.item_id, row.claim, row.project_id || '', row.item_type]);
  }
  function _getRelRow(db, id) {
    const st = db.prepare('SELECT * FROM wiz_ref_relations WHERE relation_id=?'); st.bind([id]);
    const r = st.step() ? st.getAsObject() : null; st.free(); return r;
  }
  function _insertRelation(db, rel, h, seedId, createdAt) {
    db.run(`INSERT INTO wiz_ref_relations(relation_id,from_item_id,to_item_id,relation_type,epistemic_status,source_id,scope,rationale,seed_id,created_at,record_hash,from_version_id,to_version_id,pin_backfilled)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [rel.relation_id, rel.from_item_id, rel.to_item_id, rel.relation_type, rel.epistemic_status, rel.source_id,
        rel.scope, rel.rationale, seedId, createdAt, h, rel.from_version_id, rel.to_version_id, rel.pin_backfilled ? 1 : 0]);
  }
  function _markSuperseded(db, oldId, byId) {
    const row = _getItemRow(db, oldId);
    if (!row) return false;
    if (row.lifecycle === 'SUPERSEDED' && row.superseded_by) return false;
    db.run("UPDATE wiz_ref_items SET lifecycle='SUPERSEDED', superseded_by=? WHERE item_id=?", [byId, oldId]);
    return true;
  }

  /**
   * Import a JSONL bundle. Lines:
   *   {"manifest":{"format":"wiz-ref-jsonl/1","seed_id":"…","seed_version":"…","seed_as_of":"…"}}   (optional, first)
   *   {"source":{…},"item":{…}}      item bound to its source
   *   {"source":{…}}                 source only
   *   {"relation":{…}}               explicit relation
   *
   * TWO-PHASE (audit rev 1):
   *   phase 1 — parse, normalise and validate EVERYTHING read-only (records, intra-bundle
   *             conflicts, relation endpoints, relation revisions against the DB);
   *   phase 2 — only if phase 1 produced zero errors: BEGIN … COMMIT (ROLLBACK on exception).
   * Invariant: res.errors.length > 0  ⇒  res.committed === false and the DB is untouched.
   * Idempotent: identical records are counted as unchanged. Nothing is deleted.
   */
  async function importJSONL(db, text, opts = {}) {
    if (!db) throw new Error('SQLite not initialised');
    initSchema(db);
    const res = {
      ok: false, committed: false, seed_id: null, seed_version: null, seed_as_of: null, seed_hash: null,
      already_imported: false, lines: 0,
      sources_inserted: 0, sources_updated: 0, sources_unchanged: 0,
      items_inserted: 0, items_unchanged: 0, items_revised: 0, items_superseded: 0,
      relations_inserted: 0, relations_unchanged: 0, not_in_this_seed: 0,
      errors: [], warnings: [],
    };
    const errs = res.errors, warns = res.warnings;
    const seedHash = await sha256Hex(String(text));
    res.seed_hash = seedHash;
    let manifest = null;
    const recs = [];
    String(text).split(/\r?\n/).forEach((ln, i) => {
      const t = ln.trim(); if (!t || t.startsWith('//')) return;
      let o; try { o = JSON.parse(t); } catch (e) { errs.push({ line: i + 1, msg: 'invalid JSON' }); return; }
      if (o && o.manifest && !manifest && !recs.length) { manifest = o.manifest; return; }
      recs.push({ line: i + 1, o });
    });
    res.lines = recs.length;
    manifest = manifest || {};
    if (manifest.format && manifest.format !== FORMAT) warns.push({ line: 1, msg: 'unexpected format ' + manifest.format });
    const isExport = manifest.kind === 'export';
    const seedId = _str(opts.seed_id) || _str(manifest.seed_id) || 'unnamed-seed';
    const seedVersion = _str(opts.seed_version) || _str(manifest.seed_version) || seedHash.slice(0, 19);
    const seedAsOf = _str(manifest.seed_as_of) || null;
    Object.assign(res, { seed_id: seedId, seed_version: seedVersion, seed_as_of: seedAsOf });
    const prevSeed = getMeta(db, 'seed.' + seedId);
    if (prevSeed) { try { res.already_imported = JSON.parse(prevSeed).hash === seedHash; } catch (e) {} }

    // ── Phase 1: normalise + validate (read-only) ──────────────────────────
    const bSources = new Map();   // source_id → { src, h, raw }
    const bItems = new Map();     // item_id → { it, h, line }
    const bRels = new Map();      // relation_id → { rel, h, line, raw }
    for (const { line, o } of recs) {
      if (!o || typeof o !== 'object' || (!o.source && !o.item && !o.relation)) { errs.push({ line, msg: 'unrecognised record (expected source/item/relation)' }); continue; }
      let src = null, srcOk = true;
      if (o.source) {
        const s = _normSource(o.source);
        if (!_validateSource(s, errs, warns, line)) srcOk = false;
        else {
          const h = _recordHash(s, SOURCE_CONTENT_FIELDS);
          const prev = bSources.get(s.source_id);
          if (prev && prev.h !== h) { errs.push({ line, msg: `conflicting records for source ${s.source_id} within one bundle` }); srcOk = false; }
          else { if (!prev) bSources.set(s.source_id, { src: s, h, raw: o.source }); src = s; }
        }
      }
      if (o.item) {
        if (!srcOk) { errs.push({ line, msg: 'item skipped: its source record is invalid' }); }
        else {
          const srcRow = src || (bSources.get(o.item.source_id) || {}).src || _getSource(db, o.item.source_id);
          const it = _normItem(o.item, srcRow);
          if (!srcRow || srcRow.source_id !== it.source_id) errs.push({ line, msg: 'item source_id missing or not matching its source' });
          else if (_validateItem(it, srcRow, errs, warns, line)) {
            const h = _recordHash(it, ITEM_CONTENT_FIELDS);
            const prev = bItems.get(it.item_id);
            // immutable version identity of this record: '<logical>@<content hash>'
            const logical = it.logical_item_id || it.item_id;
            const version = logical + '@' + h;
            if (it.version_id && it.version_id !== version) errs.push({ line, msg: `item ${it.item_id}: version_id "${it.version_id}" does not match its content (expected ${version})` });
            else if (prev && prev.h !== h) errs.push({ line, msg: `conflicting records for item ${it.item_id} within one bundle` });
            else if (!prev) {
              it.capture = it.capture || _captureFromSource(srcRow);
              it.logical_item_id = logical; it.version_id = version;
              bItems.set(it.item_id, { it, h, line });
            }
          }
        }
      }
      if (o.relation) {
        const r = o.relation;
        const rel = {
          relation_id: _str(r.relation_id), from_item_id: _str(r.from_item_id), to_item_id: _str(r.to_item_id),
          relation_type: _str(r.relation_type), epistemic_status: _str(r.epistemic_status) || 'SOURCE_ASSERTION',
          source_id: _str(r.source_id), scope: _str(r.scope), rationale: _str(r.rationale),
          // optional explicit version pins (e.g. from an export); otherwise resolved below
          from_version_id: _str(r.from_version_id), to_version_id: _str(r.to_version_id), pin_backfilled: r.pin_backfilled ? 1 : 0,
        };
        rel.explicit_from = !!rel.from_version_id; rel.explicit_to = !!rel.to_version_id;
        if (!rel.from_item_id || !rel.to_item_id || !rel.relation_type) { errs.push({ line, msg: 'relation requires from_item_id,to_item_id,relation_type' }); continue; }
        if (!ENUMS.relation_type.includes(rel.relation_type)) { errs.push({ line, msg: 'unknown relation_type ' + rel.relation_type }); continue; }
        rel.relation_id = rel.relation_id || `rel:${rel.relation_type}:${rel.from_item_id}->${rel.to_item_id}`;
        const h = _recordHash(rel, REL_CONTENT_FIELDS);
        const prev = bRels.get(rel.relation_id);
        if (prev && prev.h !== h) { errs.push({ line, msg: `conflicting records for relation ${rel.relation_id} within one bundle` }); continue; }
        if (!prev) bRels.set(rel.relation_id, { rel, h, line, raw: r });
      }
    }
    // relation integrity + VERSION PINNING.
    // Endpoint expression: from_item_id/to_item_id name an item (logical id → the version current after this
    // bundle's items are applied; an archived id '<logical>@<hash>' → exactly that version). Optional
    // from_version_id/to_version_id pin an explicit version, which must exist in the DB or be produced by this bundle.
    // Existing relation_id: same content → unchanged and KEEPS ITS ORIGINAL PINS (never rebound to a newer version);
    // different content or different explicit pins → rejected.
    const bundleVersions = new Set([...bItems.values()].map(x => x.it.version_id));
    const resolveEnd = (ref) => {
      if (bItems.has(ref)) return bItems.get(ref).it.version_id;
      const row = _getItemRowRaw(db, ref);
      return row ? (row.version_id || null) : null;
    };
    for (const { rel, h, line } of bRels.values()) {
      for (const [end, vkey, explicit] of [['from_item_id', 'from_version_id', rel.explicit_from], ['to_item_id', 'to_version_id', rel.explicit_to]]) {
        if (explicit) {
          if (!bundleVersions.has(rel[vkey]) && !_getVersionRow(db, rel[vkey]))
            errs.push({ line, msg: `relation ${rel.relation_id}: ${vkey} "${rel[vkey]}" is not a known item version (DB or bundle)` });
        } else {
          const v = resolveEnd(rel[end]);
          if (!v) errs.push({ line, msg: `relation ${rel.relation_id}: ${end} "${rel[end]}" not found in DB or bundle (external references are not supported)` });
          rel[vkey] = v;
        }
      }
      const ex = _getRelRow(db, rel.relation_id);
      if (ex && ex.record_hash !== h)
        errs.push({ line, msg: `relation ${rel.relation_id} already exists with different content — relation revisions are rejected; use a new relation_id` });
      else if (ex && ((rel.explicit_from && rel.from_version_id !== ex.from_version_id) || (rel.explicit_to && rel.to_version_id !== ex.to_version_id)))
        errs.push({ line, msg: `relation ${rel.relation_id} already exists pinned to other item versions — re-pinning is rejected; use a new relation_id` });
    }
    if (errs.length) { res.ok = false; res.committed = false; return res; } // NO WRITE

    // ── Phase 2: write (single transaction) ────────────────────────────────
    const now = Date.now();
    const pendingSupersede = [];
    db.run('BEGIN');
    try {
      for (const { src, h, raw } of bSources.values()) {
        const ex = _getSource(db, src.source_id);
        if (!ex) {
          db.run(`INSERT INTO wiz_ref_sources(source_id,title,surface,source_kind,authority_class,project_id,locator,revision,as_of,currentness,privacy,content_hash,seed_id,first_seed_version,last_seed_version,record_hash,imported_at)
                  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [src.source_id, src.title, src.surface, src.source_kind, src.authority_class, src.project_id, src.locator,
              src.revision, src.as_of, src.currentness, src.privacy, src.content_hash,
              _str(raw.seed_id) || seedId, _str(raw.first_seed_version) || seedVersion,
              _str(raw.last_seed_version) || seedVersion, h, now]);
          res.sources_inserted++;
        } else if (ex.record_hash === h) {
          if (!isExport) db.run('UPDATE wiz_ref_sources SET last_seed_version=? WHERE source_id=?', [seedVersion, src.source_id]);
          res.sources_unchanged++;
        } else {
          // newer source revision: the source row holds the CURRENT record; items keep the
          // provenance they were captured with (<field>_at_capture) — nothing is rewritten retroactively.
          db.run(`UPDATE wiz_ref_sources SET title=?,surface=?,source_kind=?,authority_class=?,project_id=?,locator=?,revision=?,as_of=?,currentness=?,privacy=?,content_hash=?,last_seed_version=?,record_hash=?,imported_at=? WHERE source_id=?`,
            [src.title, src.surface, src.source_kind, src.authority_class, src.project_id, src.locator, src.revision,
              src.as_of, src.currentness, src.privacy, src.content_hash, seedVersion, h, now, src.source_id]);
          res.sources_updated++;
        }
      }
      const capCols = it => Object.fromEntries(CAPTURE_FIELDS.map(f => [f + '_at_capture', it.capture ? it.capture[f] : null]));
      for (const { it, h } of bItems.values()) {
        const ex = _getItemRow(db, it.item_id);
        if (!ex) {
          _insertItemRow(db, Object.assign({}, it, capCols(it), {
            created_at: it.created_at || now, lifecycle: it.lifecycle || 'ACTIVE', record_hash: h,
            seed_id: it.seed_id || seedId, first_seed_version: it.first_seed_version || seedVersion,
            last_seed_version: it.last_seed_version || seedVersion, capture_backfilled: it.capture_backfilled || 0,
          }));
          res.items_inserted++;
        } else if (ex.record_hash === h) {
          // same content re-asserted: keep the ORIGINAL capture provenance
          if (!isExport) db.run('UPDATE wiz_ref_items SET last_seed_version=? WHERE item_id=?', [seedVersion, it.item_id]);
          res.items_unchanged++;
        } else {
          // Same item_id, different content → explicit version lineage: keep the old
          // version as '<item_id>@<old_hash>' (SUPERSEDED, with its own capture provenance), then update.
          // the old row BECOMES the immutable archived version (item_id = its version_id); relations pinned to that
          // version keep resolving to the OLD content — ITEM REVISION ≠ RETROACTIVE RELATION REBINDING.
          const archId = ex.version_id || (it.item_id + '@' + ex.record_hash);
          if (!_getItemRow(db, archId))
            _insertItemRow(db, Object.assign({}, ex, { item_id: archId, version_id: archId, logical_item_id: ex.logical_item_id || it.item_id,
              lifecycle: 'SUPERSEDED', superseded_by: it.item_id }));
          const keepLifecycle = ex.lifecycle === 'SUPERSEDED' ? 'SUPERSEDED' : (it.lifecycle || 'ACTIVE'); // never un-supersede
          const cc = capCols(it);
          const sets = ITEM_CONTENT_FIELDS.map(f => f + '=?').concat(Object.keys(cc).map(k => k + '=?')).join(',');
          db.run(`UPDATE wiz_ref_items SET ${sets},capture_backfilled=?,record_hash=?,lifecycle=?,last_seed_version=?,version_id=?,logical_item_id=? WHERE item_id=?`,
            [...ITEM_CONTENT_FIELDS.map(f => (it[f] === undefined ? null : it[f])), ...Object.values(cc),
              it.capture_backfilled || 0, h, keepLifecycle, seedVersion, it.version_id, it.logical_item_id, it.item_id]);
          db.run('DELETE FROM wiz_ref_items_fts WHERE item_id=?', [it.item_id]);
          db.run('INSERT INTO wiz_ref_items_fts(item_id,claim,project_id,item_type) VALUES(?,?,?,?)',
            [it.item_id, it.claim, it.project_id || '', it.item_type]);
          res.items_revised++;
        }
        if (it.lifecycle === 'SUPERSEDED') { // e.g. restoring an export: keep SUPERSEDED, never promote
          const cur = _getItemRow(db, it.item_id);
          if (cur.lifecycle !== 'SUPERSEDED' || (!cur.superseded_by && it.superseded_by))
            db.run("UPDATE wiz_ref_items SET lifecycle='SUPERSEDED', superseded_by=COALESCE(superseded_by,?) WHERE item_id=?", [it.superseded_by, it.item_id]);
        }
        if (it.supersedes_item_id) pendingSupersede.push([it.supersedes_item_id, it.item_id, it.source_id]);
      }
      for (const { rel, h, raw } of bRels.values()) {
        if (_getRelRow(db, rel.relation_id)) { res.relations_unchanged++; continue; } // same content (checked in phase 1)
        _insertRelation(db, rel, h, _str(raw.seed_id) || seedId, _num(raw.created_at) || now);
        res.relations_inserted++;
      }
      // explicit supersession (after all items exist) — marks, never deletes
      for (const [oldId, newId, srcId] of pendingSupersede) {
        if (!_getItemRow(db, oldId)) { warns.push({ line: 0, msg: `supersedes_item_id ${oldId} not present (kept as reference only)` }); continue; }
        if (_markSuperseded(db, oldId, newId)) res.items_superseded++;
        const rel = { relation_id: `rel:auto:SUPERSEDES:${newId}->${oldId}`, from_item_id: newId, to_item_id: oldId,
          relation_type: 'SUPERSEDES', epistemic_status: 'SOURCE_ASSERTION', source_id: srcId, scope: null, rationale: 'declared via supersedes_item_id',
          from_version_id: (_getItemRow(db, newId) || {}).version_id || null, to_version_id: (_getItemRow(db, oldId) || {}).version_id || null };
        if (!_getRelRow(db, rel.relation_id)) _insertRelation(db, rel, _recordHash(rel, REL_CONTENT_FIELDS), seedId, now);
      }
      // items of the same seed that this revision no longer contains: counted, NOT deleted
      if (!isExport && prevSeed) {
        const r = db.exec("SELECT item_id FROM wiz_ref_items WHERE seed_id=? AND item_id NOT LIKE '%@%'", [seedId]);
        if (r.length) res.not_in_this_seed = r[0].values.filter(v => !bItems.has(v[0])).length;
      }
      if (isExport && manifest.meta && typeof manifest.meta === 'object') {
        for (const [k, v] of Object.entries(manifest.meta)) {
          if (k === 'schema_version') continue;
          if (getMeta(db, k) == null) setMeta(db, k, v);
        }
      } else {
        setMeta(db, 'seed_id', seedId);
        setMeta(db, 'seed_version', seedVersion);
        setMeta(db, 'seed_as_of', seedAsOf);
        setMeta(db, 'seed_hash', seedHash);
        setMeta(db, 'seed.' + seedId, JSON.stringify({ version: seedVersion, as_of: seedAsOf, hash: seedHash, imported_at: now }));
      }
      setMeta(db, 'last_import_at', now);
      db.run('COMMIT');
      res.committed = true;
    } catch (e) {
      try { db.run('ROLLBACK'); } catch (e2) {}
      errs.push({ line: 0, msg: 'import aborted: ' + e.message });
      res.committed = false;
      return res;
    }
    res.ok = true;
    return res;
  }

  // ── Retrieval (provenance-bearing blocks) ────────────────────────────────
  // Current source record is exposed as cur_*; the item's own provenance is <field>_at_capture.
  const JOIN_SQL = `SELECT i.*, s.title AS cur_title, s.surface AS cur_surface, s.source_kind AS cur_source_kind,
      s.authority_class AS cur_authority_class, s.locator AS source_locator, s.revision AS cur_revision,
      s.as_of AS cur_as_of, s.currentness AS cur_currentness, s.content_hash AS cur_content_hash,
      s.privacy AS source_privacy
    FROM wiz_ref_items i JOIN wiz_ref_sources s ON s.source_id = i.source_id`;
  // effective (capture-time) classification used for filtering — never the later source record
  const EFF = {
    authority_class: 'COALESCE(i.source_authority_class_at_capture, s.authority_class)',
    source_kind: 'COALESCE(i.source_kind_at_capture, s.source_kind)',
    surface: 'COALESCE(i.source_surface_at_capture, s.surface)',
  };
  const IMPL_TYPES = ['IMPLEMENTATION_FACT', 'VALIDATION_RESULT'];

  function _isDraft(r) {
    const hay = [r.source_status, r.source_currentness, r.validity, r.authority_scope].filter(Boolean).join(' ');
    return r.source_currentness === 'DRAFT' || /\bDRAFT\b|\bbranch\b|\bunmerged\b|\bopen pr\b/i.test(hay);
  }

  function toBlock(row) {
    // capture provenance = the item's source identity; fall back to the current record only if absent
    const capOr = (f, cur) => (row[f + '_at_capture'] != null ? row[f + '_at_capture'] : row[cur]);
    const r = Object.assign({}, row, {
      source_title: capOr('source_title', 'cur_title'), source_surface: capOr('source_surface', 'cur_surface'),
      source_kind: capOr('source_kind', 'cur_source_kind'), authority_class: capOr('source_authority_class', 'cur_authority_class'),
      source_revision: capOr('source_revision', 'cur_revision'), source_as_of: capOr('source_as_of', 'cur_as_of'),
      source_currentness: capOr('source_currentness', 'cur_currentness'), source_content_hash: capOr('source_content_hash', 'cur_content_hash'),
    });
    const changed = [['title', 'source_title', 'cur_title'], ['surface', 'source_surface', 'cur_surface'],
      ['source_kind', 'source_kind', 'cur_source_kind'], ['authority_class', 'authority_class', 'cur_authority_class'],
      ['revision', 'source_revision', 'cur_revision'], ['as_of', 'source_as_of', 'cur_as_of'],
      ['currentness', 'source_currentness', 'cur_currentness'], ['content_hash', 'source_content_hash', 'cur_content_hash']]
      .filter(([, a, b]) => (r[a] == null ? null : String(r[a])) !== (row[b] == null ? null : String(row[b]))).map(x => x[0]);
    const revised = changed.length > 0;
    const isImplEvidence = r.source_surface === 'github' && r.authority_class === 'IMPLEMENTATION_EVIDENCE';
    const asOf = r.as_of || r.source_as_of || 'UNKNOWN';
    const caveats = [];
    if (r.source_surface === 'demo' || r.authority_class === 'DEMO_ONLY') caveats.push('DEMO/EXAMPLE DATA — not Velantrim corpus, not a source fact');
    if (r.source_surface === 'fixture') caveats.push('SYNTHETIC TEST FIXTURE — not Velantrim corpus');
    if (r.authority_class === 'NAVIGATION_ONLY') caveats.push('ROUTE ONLY — navigation source is not a truth owner, not canon root, not runtime authority');
    if (r.authority_class === 'HUMAN_REFERENCE_ONLY' || r.item_type === 'HUMAN_LENS') caveats.push('HUMAN LENS ≠ SYSTEM PRIMITIVE — may suggest a question, never creates a mechanism/module/owner');
    if (r.authority_class === 'HISTORICAL_ONLY' || r.source_currentness === 'HISTORICAL' || r.item_type === 'HISTORICAL_NOTE') caveats.push('HISTORICAL NOTE ≠ CURRENT PROJECT TRUTH');
    if (r.authority_class === 'RESEARCH_DONOR') caveats.push('BOOK ≠ VELANTRIM CANON');
    if (!isImplEvidence && (IMPL_TYPES.includes(r.item_type) || r.item_type === 'ARCHITECTURE_POSITION' || ['notion', 'drive'].includes(r.source_surface)))
      caveats.push('NOT IMPLEMENTATION EVIDENCE — document/architecture claim; runtime existence must be verified in GitHub at exact repo+commit');
    if (IMPL_TYPES.includes(r.item_type) || r.source_kind === 'IMPLEMENTATION')
      caveats.push(`CACHED STATE as-of ${asOf} — not live repo state; verify live on GitHub (IMPLEMENTED ≠ ACTIVATED)`);
    const draft = _isDraft(r);
    if (draft) caveats.push('DRAFT/BRANCH STATE — not a main-branch fact');
    if (r.lifecycle === 'SUPERSEDED') caveats.push('SUPERSEDED' + (r.superseded_by ? ' by ' + r.superseded_by : ''));
    if (revised) caveats.push(`SOURCE CHANGED SINCE CAPTURE (${changed.join(', ')}) — item captured from rev=${r.source_revision || '—'} (as_of ${r.source_as_of || '—'}); current source record is rev=${row.cur_revision || '—'} (as_of ${row.cur_as_of || '—'}); item NOT re-verified against the current revision`);
    if (row.capture_backfilled) caveats.push('CAPTURE PROVENANCE BACKFILLED at schema migration (= source record at migration time, not at original capture)');
    const status = [r.epistemic_state || 'SOURCE_ASSERTION', r.source_status ? 'source_status=' + r.source_status : null,
      r.source_currentness ? 'currentness=' + r.source_currentness : null].filter(Boolean).join(' / ');
    const text = [
      `[REFERENCE MEMORY] ${r.project_id || '—'} / ${r.item_type} / ${status}`,
      `source (at capture): ${r.source_title} (${r.source_id}; ${r.source_surface}/${r.source_kind}; authority=${r.authority_class || 'UNSPECIFIED'}${r.source_revision ? '; rev=' + r.source_revision : ''})`,
      ...(revised ? [`source (current record): rev=${row.cur_revision || '—'} · as_of ${row.cur_as_of || '—'} · currentness=${row.cur_currentness || '—'} · authority=${row.cur_authority_class || '—'}`] : []),
      `as_of: ${asOf}${r.authority_scope ? ' · scope: ' + r.authority_scope : ''}${r.source_section ? ' · section: ' + r.source_section : ''}${r.provenance ? ' · provenance: ' + r.provenance : ''}`,
      `version: ${row.version_id || '—'}${row.item_id === row.logical_item_id ? ' (current)' : ' (archived version of ' + (row.logical_item_id || '—') + ')'}`,
      `claim (source-bound, not verified truth): ${r.claim}`,
      ...caveats.map(c => '⚠ ' + c),
    ].join('\n');
    return {
      namespace: 'reference', item_id: r.item_id, claim: r.claim, project_id: r.project_id, item_type: r.item_type,
      epistemic_state: r.epistemic_state, source_status: r.source_status, validity: r.validity,
      authority_scope: r.authority_scope, confidence: r.confidence, source_section: r.source_section,
      as_of: r.as_of, provenance: r.provenance, lifecycle: r.lifecycle, superseded_by: r.superseded_by,
      supersedes_item_id: r.supersedes_item_id,
      logical_item_id: row.logical_item_id, version_id: row.version_id, is_current_version: row.item_id === row.logical_item_id,
      // source identity AT CAPTURE
      source_id: r.source_id, source_title: r.source_title, source_surface: r.source_surface,
      source_kind: r.source_kind, authority_class: r.authority_class, source_revision: r.source_revision,
      source_as_of: r.source_as_of, source_currentness: r.source_currentness, source_content_hash: r.source_content_hash,
      source_privacy: r.source_privacy, capture_backfilled: !!row.capture_backfilled,
      // CURRENT source record (separately labelled)
      source_current_title: row.cur_title, source_current_revision: row.cur_revision, source_current_as_of: row.cur_as_of,
      source_current_currentness: row.cur_currentness, source_current_authority_class: row.cur_authority_class,
      source_current_content_hash: row.cur_content_hash,
      source_changed_since_capture: revised, source_changed_fields: changed,
      seed_id: r.seed_id, last_seed_version: r.last_seed_version,
      is_implementation_evidence: isImplEvidence, is_live_state: false, is_main_state: false,
      is_draft_or_branch: draft, is_system_primitive: false, is_verified_truth: false,
      caveats, block: text,
    };
  }

  function _rows(db, sql, params) {
    const st = db.prepare(sql); st.bind(params || []);
    const out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out;
  }
  function _filterSql(f, w, p) {
    if (f.project_id) { w.push('i.project_id=?'); p.push(f.project_id); }
    if (f.item_type) { w.push('i.item_type=?'); p.push(f.item_type); }
    if (f.authority_class) { w.push(EFF.authority_class + '=?'); p.push(f.authority_class); }
    if (f.source_kind) { w.push(EFF.source_kind + '=?'); p.push(f.source_kind); }
    if (f.surface) { w.push(EFF.surface + '=?'); p.push(f.surface); }
    if (f.source_id) { w.push('i.source_id=?'); p.push(f.source_id); }
    if (!f.include_superseded) w.push("COALESCE(i.lifecycle,'ACTIVE')!='SUPERSEDED'");
    if (f.implementation_evidence_only) w.push(`${EFF.surface}='github' AND ${EFF.authority_class}='IMPLEMENTATION_EVIDENCE'`);
  }

  function search(db, query, filters = {}) {
    if (!db) return [];
    initSchema(db);
    const f = filters || {};
    const limit = Math.max(1, Math.min(Number(f.limit) || 10, 100));
    const terms = (String(query || '').match(/[\p{L}\p{N}_]{2,}/gu) || []).map(t => '"' + t.replace(/"/g, '') + '"*');
    const run = (match) => {
      const w = [], p = [];
      let sql;
      if (match) {
        sql = JOIN_SQL.replace('FROM wiz_ref_items i', 'FROM wiz_ref_items_fts JOIN wiz_ref_items i ON i.item_id = wiz_ref_items_fts.item_id')
          .replace('SELECT i.*,', 'SELECT i.*, bm25(wiz_ref_items_fts) AS score,');
        w.push('wiz_ref_items_fts MATCH ?'); p.push(match);
      } else sql = JOIN_SQL;
      _filterSql(f, w, p);
      sql += (w.length ? ' WHERE ' + w.join(' AND ') : '') + (match ? ' ORDER BY score' : ' ORDER BY i.project_id, i.item_type, i.item_id') + ' LIMIT ?';
      p.push(limit);
      try { return _rows(db, sql, p); } catch (e) { return []; }
    };
    let rows, mode = 'all';
    if (!terms.length) rows = run(null);
    else {
      rows = run(terms.join(' '));
      if (!rows.length && terms.length > 1) { rows = run(terms.join(' OR ')); mode = 'any'; }
    }
    return rows.map(r => Object.assign(toBlock(r), { match_mode: terms.length ? mode : 'list' }));
  }

  function getSource(db, sourceId) {
    if (!db) return null;
    initSchema(db);
    const s = _getSource(db, sourceId);
    if (!s) return null;
    const items = _rows(db, JOIN_SQL + ' WHERE i.source_id=? ORDER BY i.item_type, i.item_id', [sourceId]).map(toBlock);
    delete s.record_hash;
    return { source: s, item_count: items.length, items };
  }

  function project(db, projectId, filters = {}) {
    if (!db) return null;
    initSchema(db);
    const w = ['(i.project_id=? OR s.project_id=?)'], p = [projectId, projectId];
    _filterSql(Object.assign({}, filters, { project_id: null }), w, p);
    const items = _rows(db, JOIN_SQL + ' WHERE ' + w.join(' AND ') + ' ORDER BY i.item_type, i.item_id', p).map(toBlock);
    const by_type = {};
    for (const it of items) (by_type[it.item_type] = by_type[it.item_type] || []).push(it);
    const sources = _rows(db, 'SELECT source_id,title,surface,source_kind,authority_class,revision,as_of,currentness FROM wiz_ref_sources WHERE project_id=? ORDER BY source_id', [projectId]);
    return { project_id: projectId, item_count: items.length, sources, by_type, items };
  }

  // Resolve a relation's pinned endpoints to the immutable versions they refer to.
  function _resolveRelation(db, r) {
    const end = v => { const x = _getVersionRow(db, v);
      return x ? { version_id: x.version_id, logical_item_id: x.logical_item_id, row_item_id: x.item_id, claim: x.claim,
        lifecycle: x.lifecycle, is_current_version: x.item_id === x.logical_item_id } : { version_id: v, unresolved: true }; };
    const o = Object.assign({}, r); delete o.record_hash;
    return Object.assign(o, { from: end(r.from_version_id), to: end(r.to_version_id) });
  }
  function resolveRelation(db, relationId) {
    if (!db) return null;
    initSchema(db);
    const r = _getRelRow(db, relationId);
    return r ? _resolveRelation(db, r) : null;
  }

  // trace(ref): ref = logical item id (→ its CURRENT version) or a version id / archived id (→ that version).
  // Relations are those pinned to exactly this version — a current version never inherits relations of older versions.
  function trace(db, ref) {
    if (!db) return null;
    initSchema(db);
    const row = _rows(db, JOIN_SQL + ' WHERE i.item_id=?', [ref])[0]
      || _rows(db, JOIN_SQL + ' WHERE i.version_id=? ORDER BY (i.item_id=i.version_id) DESC LIMIT 1', [ref])[0];
    if (!row) return null;
    const item = toBlock(row);
    const source = _getSource(db, row.source_id); if (source) delete source.record_hash;
    const v = row.version_id;
    const outgoing = _rows(db, 'SELECT * FROM wiz_ref_relations WHERE from_version_id=? ORDER BY relation_type, relation_id', [v]).map(r => _resolveRelation(db, r));
    const incoming = _rows(db, 'SELECT * FROM wiz_ref_relations WHERE to_version_id=? ORDER BY relation_type, relation_id', [v]).map(r => _resolveRelation(db, r));
    const unpinned = _rows(db, 'SELECT * FROM wiz_ref_relations WHERE (from_version_id IS NULL AND from_item_id=?) OR (to_version_id IS NULL AND to_item_id=?) ORDER BY relation_id', [row.item_id, row.item_id]).map(r => _resolveRelation(db, r));
    // supersession lineage (logical) in both directions (bounded)
    const newer = [], older = [];
    let cur = row, guard = 0;
    while (cur && cur.superseded_by && guard++ < 50) { cur = _getItemRow(db, cur.superseded_by); if (cur) newer.push({ item_id: cur.item_id, version_id: cur.version_id, lifecycle: cur.lifecycle, as_of: cur.as_of }); }
    older.push(..._rows(db, 'SELECT item_id,version_id,lifecycle,as_of FROM wiz_ref_items WHERE superseded_by=? ORDER BY item_id', [row.item_id]));
    const versions = _rows(db, 'SELECT item_id,version_id,lifecycle,as_of,claim FROM wiz_ref_items WHERE logical_item_id=? ORDER BY (item_id=logical_item_id), item_id', [row.logical_item_id || row.item_id])
      .map(x => Object.assign(x, { is_current_version: x.item_id === (row.logical_item_id || row.item_id) }));
    // item.source_* = provenance AT CAPTURE; source_current = the source row as it is now
    return { item, version_id: v, logical_item_id: row.logical_item_id, is_current_version: row.item_id === row.logical_item_id,
      source_current: source, relations: { outgoing, incoming, unpinned }, versions, lineage: { newer, older } };
  }

  function stats(db) {
    if (!db) return null;
    initSchema(db);
    const c = t => db.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
    return { sources: c('wiz_ref_sources'), items: c('wiz_ref_items'), relations: c('wiz_ref_relations'), meta: allMeta(db) };
  }

  // Lossless JSONL backup of the reference namespace (statuses exported verbatim).
  function exportJSONL(db) {
    initSchema(db);
    const meta = allMeta(db);
    const lines = [JSON.stringify({ manifest: { format: FORMAT, kind: 'export', seed_id: 'wiz-ref-export', schema_version: meta.schema_version, exported_at: new Date().toISOString(), meta } })];
    const sources = {};
    for (const s of _rows(db, 'SELECT * FROM wiz_ref_sources ORDER BY source_id', [])) {
      const o = {}; for (const k of SOURCE_CONTENT_FIELDS.concat(['source_id', 'seed_id', 'first_seed_version', 'last_seed_version'])) if (s[k] != null) o[k] = s[k];
      sources[s.source_id] = o;
    }
    const used = new Set();
    for (const it of _rows(db, 'SELECT * FROM wiz_ref_items ORDER BY source_id, item_id', [])) {
      const o = {}; for (const k of ITEM_COLS) if (it[k] != null && k !== 'record_hash') o[k] = it[k];
      lines.push(JSON.stringify({ source: sources[it.source_id], item: o }));
      used.add(it.source_id);
    }
    for (const [id, s] of Object.entries(sources)) if (!used.has(id)) lines.push(JSON.stringify({ source: s }));
    for (const r of _rows(db, 'SELECT * FROM wiz_ref_relations ORDER BY relation_id', [])) {
      const o = {}; for (const k of Object.keys(r)) if (r[k] != null && k !== 'record_hash') o[k] = r[k];
      lines.push(JSON.stringify({ relation: o }));
    }
    return lines.join('\n') + '\n';
  }

  // Explicit, user-initiated removal of the whole reference namespace (never automatic).
  function clearAll(db) {
    initSchema(db);
    db.run('DELETE FROM wiz_ref_items_fts'); db.run('DELETE FROM wiz_ref_relations');
    db.run('DELETE FROM wiz_ref_items'); db.run('DELETE FROM wiz_ref_sources');
    db.run("DELETE FROM wiz_ref_meta WHERE key!='schema_version'");
  }

  // Plain-text rendering for agent tools (always with provenance, never bare claims).
  const HEADER = '[REFERENCE MEMORY — explicit retrieval · separate from personal memory (mem_*) · source-bound, not verified truth]';
  function formatBlocks(blocks) {
    if (!blocks || !blocks.length) return HEADER + '\n(no reference items found)';
    return HEADER + '\n\n' + blocks.map(b => b.block).join('\n\n');
  }

  const WizRef = { SCHEMA_VERSION, FORMAT, ENUMS, initSchema, importJSONL, search, getSource, project, trace, resolveRelation,
    stats, exportJSONL, clearAll, toBlock, formatBlocks, getMeta, sha256Hex, HEADER };

  if (typeof module !== 'undefined' && module.exports) module.exports = WizRef;

  // ── Browser glue: global API over window._wizDB + minimal UI helpers ─────
  if (typeof window !== 'undefined' && root === window) {
    window.WizRef = WizRef;
    const db = () => window._wizDB;
    // Awaitable persistence (audit rev 1): resolves only after the IndexedDB transaction completed and
    // the stored bytes were read back (index.html _wizSaveDBAsync). Used by reference import/clear/restore only.
    const persist = async () => {
      if (typeof window._wizSaveDBAsync !== 'function') throw new Error('awaitable IndexedDB save unavailable');
      return window._wizSaveDBAsync();
    };
    window.wizRefPersist = persist;
    const ensure = async () => { if (!window._wizDB && typeof window.wizInitSQLite === 'function') await window.wizInitSQLite(); return window._wizDB; };
    window.wizRefSearch = (query, filters) => search(db(), query, filters);
    window.wizRefGetSource = (sourceId) => getSource(db(), sourceId);
    window.wizRefProject = (projectId, filters) => project(db(), projectId, filters);
    window.wizRefTrace = (itemId) => trace(db(), itemId);
    // r.persisted === true only after the IndexedDB write is CONFIRMED (IMPORT_PERSISTED = TRUE)
    window.wizRefImportJSONL = async (text, opts) => {
      if (!(await ensure())) throw new Error('SQLite not initialised');
      const r = await importJSONL(db(), text, opts);
      r.persisted = false;
      if (r.committed) {
        try { const ack = await persist(); r.persisted = true; r.persisted_bytes = ack.bytes; r.persisted_sha256 = ack.sha256 || null; }
        catch (e) { r.persisted = false; r.persist_error = String((e && e.message) || e); }
      }
      return r;
    };
    window.wizRefExportJSONL = () => exportJSONL(db());
    window.wizRefClearAll = async () => {
      if (!db()) return { cleared: false, persisted: false };
      clearAll(db());
      try { await persist(); return { cleared: true, persisted: true }; }
      catch (e) { return { cleared: true, persisted: false, persist_error: String((e && e.message) || e) }; }
    };

    // UI helpers (Memory panel → "Reference memory" card)
    const $ = id => document.getElementById(id);
    const toast = m => { if (typeof window.showToast === 'function') window.showToast(m); };
    window.wizRefUiRender = async () => {
      const el = $('wizRefStats'); if (!el) return;
      if (!(await ensure())) { el.textContent = 'SQLite unavailable'; return; }
      const s = stats(db());
      el.textContent = `sources: ${s.sources} · items: ${s.items} · relations: ${s.relations} · schema v${s.meta.schema_version || '?'}` +
        (s.meta.seed_id ? ` · last seed: ${s.meta.seed_id} ${s.meta.seed_version || ''} (as_of ${s.meta.seed_as_of || '?'})` : '');
    };
    window.wizRefUiImportFile = async (input) => {
      const file = input && input.files && input.files[0]; if (!file) return;
      const out = $('wizRefResult');
      if (out) { out.dataset.state = 'pending'; out.dataset.persisted = 'false'; }
      window.WIZ_REF_IMPORT_PERSISTED = false;
      try {
        const r = await window.wizRefImportJSONL(await file.text());
        let msg = `Import ${r.committed ? 'committed' : 'REJECTED'} — seed ${r.seed_id} ${r.seed_version}: ` +
          `+${r.items_inserted} items, ${r.items_unchanged} unchanged, ${r.items_revised} revised, ${r.items_superseded} superseded, ` +
          `+${r.sources_inserted} sources, +${r.relations_inserted} relations; errors ${r.errors.length}, warnings ${r.warnings.length}` +
          (r.errors.length ? '\n' + r.errors.slice(0, 5).map(e => `line ${e.line}: ${e.msg}`).join('\n') : '');
        if (!r.committed) msg += '\nNOTHING WRITTEN — the whole bundle was rejected. Fix the errors and import again.';
        else if (r.persisted) {
          window.WIZ_REF_IMPORT_PERSISTED = true;
          msg += `\nIMPORT_PERSISTED = TRUE — IndexedDB write confirmed (${r.persisted_bytes} bytes read back, byte-identical${r.persisted_sha256 ? `, sha256 ${r.persisted_sha256}` : ''}). The local file can be deleted now.`;
        } else msg += `\n⚠ IMPORT_PERSISTED = FALSE — IndexedDB write NOT confirmed (${r.persist_error}). KEEP your local file; a reload may lose this import.`;
        if (out) { out.textContent = msg; out.dataset.persisted = r.persisted ? 'true' : 'false'; }
        toast(!r.committed ? '⚠️ Reference import rejected' : r.persisted ? '📚 Reference import saved' : '⚠️ Reference import NOT persisted');
      } catch (e) { if (out) out.textContent = '❌ ' + e.message; }
      if (out) out.dataset.state = 'done';
      input.value = '';
      window.wizRefUiRender();
    };
    window.wizRefUiExport = async () => {
      if (!(await ensure())) return;
      const blob = new Blob([exportJSONL(db())], { type: 'application/x-ndjson' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'wiz-reference-backup-' + new Date().toISOString().slice(0, 10) + '.private.jsonl';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    window.wizRefUiSearch = async () => {
      const out = $('wizRefResult'); if (!out) return;
      if (!(await ensure())) return;
      const q = ($('wizRefQuery') || {}).value || '';
      out.textContent = formatBlocks(search(db(), q, { limit: 20 }));
    };
    window.wizRefUiClear = async () => {
      if (!(await ensure())) return;
      if (!window.confirm('Delete the whole REFERENCE namespace (wiz_ref_*)? Personal memory is not touched.')) return;
      const r = await window.wizRefClearAll(); window.wizRefUiRender();
      const out = $('wizRefResult');
      if (out) out.textContent = r.persisted ? 'Reference namespace cleared (IndexedDB write confirmed).'
        : `⚠ Reference namespace cleared in memory, but the IndexedDB write was NOT confirmed (${r.persist_error || 'unknown'}).`;
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
