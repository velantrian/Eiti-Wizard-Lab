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

  const SCHEMA_VERSION = '1';
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
    ],
    wiz_ref_relations: [
      ['relation_id', 'TEXT PRIMARY KEY'], ['from_item_id', 'TEXT NOT NULL'], ['to_item_id', 'TEXT NOT NULL'],
      ['relation_type', 'TEXT NOT NULL'], ['epistemic_status', 'TEXT NOT NULL'], ['source_id', 'TEXT'],
      ['scope', 'TEXT'], ['rationale', 'TEXT'], ['seed_id', 'TEXT'], ['created_at', 'INTEGER'],
    ],
    wiz_ref_meta: [['key', 'TEXT PRIMARY KEY'], ['value', 'TEXT']],
  };
  const ITEM_CONTENT_FIELDS = ['source_id', 'project_id', 'item_type', 'claim', 'source_section',
    'source_status', 'epistemic_state', 'authority_scope', 'validity', 'confidence', 'as_of',
    'supersedes_item_id', 'provenance'];
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
    const cur = getMeta(db, 'schema_version');
    if (cur == null) setMeta(db, 'schema_version', SCHEMA_VERSION);
    else if (Number(cur) < Number(SCHEMA_VERSION)) setMeta(db, 'schema_version', SCHEMA_VERSION);
    return getMeta(db, 'schema_version');
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
    };
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
    const seedHash = await sha256Hex(String(text));
    res.seed_hash = seedHash;
    const lines = String(text).split(/\r?\n/);
    let manifest = null;
    const recs = [];
    lines.forEach((ln, i) => {
      const t = ln.trim(); if (!t || t.startsWith('//')) return;
      let o; try { o = JSON.parse(t); } catch (e) { res.errors.push({ line: i + 1, msg: 'invalid JSON' }); return; }
      if (o && o.manifest && !manifest && !recs.length) { manifest = o.manifest; return; }
      recs.push({ line: i + 1, o });
    });
    res.lines = recs.length;
    manifest = manifest || {};
    if (manifest.format && manifest.format !== FORMAT) res.warnings.push({ line: 1, msg: 'unexpected format ' + manifest.format });
    const isExport = manifest.kind === 'export';
    const seedId = _str(opts.seed_id) || _str(manifest.seed_id) || 'unnamed-seed';
    const seedVersion = _str(opts.seed_version) || _str(manifest.seed_version) || seedHash.slice(0, 19);
    const seedAsOf = _str(manifest.seed_as_of) || null;
    Object.assign(res, { seed_id: seedId, seed_version: seedVersion, seed_as_of: seedAsOf });
    const prevSeed = getMeta(db, 'seed.' + seedId);
    if (prevSeed) { try { res.already_imported = JSON.parse(prevSeed).hash === seedHash; } catch (e) {} }

    const now = Date.now();
    const seenItems = new Set();
    const pendingSupersede = [];
    db.run('BEGIN');
    try {
      const srcCache = {};
      for (const { line, o } of recs) {
        let src = null;
        if (o.source) {
          src = _normSource(o.source);
          if (!_validateSource(src, res.errors, res.warnings, line)) continue;
          const h = _recordHash(src, SOURCE_CONTENT_FIELDS);
          if (!srcCache[src.source_id]) {
            const ex = _getSource(db, src.source_id);
            if (!ex) {
              db.run(`INSERT INTO wiz_ref_sources(source_id,title,surface,source_kind,authority_class,project_id,locator,revision,as_of,currentness,privacy,content_hash,seed_id,first_seed_version,last_seed_version,record_hash,imported_at)
                      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [src.source_id, src.title, src.surface, src.source_kind, src.authority_class, src.project_id, src.locator,
                  src.revision, src.as_of, src.currentness, src.privacy, src.content_hash,
                  _str(o.source.seed_id) || seedId, _str(o.source.first_seed_version) || seedVersion,
                  _str(o.source.last_seed_version) || seedVersion, h, now]);
              res.sources_inserted++;
            } else if (ex.record_hash === h) {
              if (!isExport) db.run('UPDATE wiz_ref_sources SET last_seed_version=? WHERE source_id=?', [seedVersion, src.source_id]);
              res.sources_unchanged++;
            } else {
              // source metadata revised by a newer seed (e.g. new revision/as_of): update in place,
              // items keep their own as_of/provenance; nothing is deleted.
              db.run(`UPDATE wiz_ref_sources SET title=?,surface=?,source_kind=?,authority_class=?,project_id=?,locator=?,revision=?,as_of=?,currentness=?,privacy=?,content_hash=?,last_seed_version=?,record_hash=?,imported_at=? WHERE source_id=?`,
                [src.title, src.surface, src.source_kind, src.authority_class, src.project_id, src.locator, src.revision,
                  src.as_of, src.currentness, src.privacy, src.content_hash, seedVersion, h, now, src.source_id]);
              res.sources_updated++;
            }
            srcCache[src.source_id] = src;
          }
        }
        if (o.item) {
          const srcRow = src || srcCache[o.item.source_id] || _getSource(db, o.item.source_id);
          const it = _normItem(o.item, srcRow);
          if (!srcRow || srcRow.source_id !== it.source_id) { res.errors.push({ line, msg: 'item source_id missing or not matching its source' }); continue; }
          if (!_validateItem(it, srcRow, res.errors, res.warnings, line)) continue;
          const h = _recordHash(it, ITEM_CONTENT_FIELDS);
          seenItems.add(it.item_id);
          const ex = _getItemRow(db, it.item_id);
          if (!ex) {
            _insertItemRow(db, Object.assign({}, it, {
              created_at: it.created_at || now, lifecycle: it.lifecycle || 'ACTIVE', record_hash: h,
              seed_id: it.seed_id || seedId, first_seed_version: it.first_seed_version || seedVersion,
              last_seed_version: it.last_seed_version || seedVersion,
            }));
            res.items_inserted++;
          } else if (ex.record_hash === h) {
            if (!isExport) db.run('UPDATE wiz_ref_items SET last_seed_version=? WHERE item_id=?', [seedVersion, it.item_id]);
            res.items_unchanged++;
          } else {
            // Same item_id, different content → explicit version lineage: keep the old
            // version as '<item_id>@<old_hash>' (SUPERSEDED), then update the current row.
            const archId = it.item_id + '@' + ex.record_hash;
            if (!_getItemRow(db, archId)) {
              _insertItemRow(db, Object.assign({}, ex, { item_id: archId, lifecycle: 'SUPERSEDED', superseded_by: it.item_id }));
            }
            const keepLifecycle = ex.lifecycle === 'SUPERSEDED' ? 'SUPERSEDED' : (it.lifecycle || 'ACTIVE'); // never un-supersede
            const sets = ITEM_CONTENT_FIELDS.map(f => f + '=?').join(',');
            db.run(`UPDATE wiz_ref_items SET ${sets},record_hash=?,lifecycle=?,last_seed_version=? WHERE item_id=?`,
              [...ITEM_CONTENT_FIELDS.map(f => (it[f] === undefined ? null : it[f])), h, keepLifecycle, seedVersion, it.item_id]);
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
          if (it.supersedes_item_id) pendingSupersede.push([it.supersedes_item_id, it.item_id, it.source_id, line]);
        }
        if (o.relation) {
          const r = o.relation;
          const rel = {
            relation_id: _str(r.relation_id), from_item_id: _str(r.from_item_id), to_item_id: _str(r.to_item_id),
            relation_type: _str(r.relation_type), epistemic_status: _str(r.epistemic_status) || 'SOURCE_ASSERTION',
            source_id: _str(r.source_id), scope: _str(r.scope), rationale: _str(r.rationale),
          };
          if (!rel.from_item_id || !rel.to_item_id || !rel.relation_type) { res.errors.push({ line, msg: 'relation requires from_item_id,to_item_id,relation_type' }); continue; }
          if (!ENUMS.relation_type.includes(rel.relation_type)) { res.errors.push({ line, msg: 'unknown relation_type ' + rel.relation_type }); continue; }
          rel.relation_id = rel.relation_id || `rel:${rel.relation_type}:${rel.from_item_id}->${rel.to_item_id}`;
          const ex = db.exec('SELECT 1 FROM wiz_ref_relations WHERE relation_id=?', [rel.relation_id]);
          if (ex.length) { res.relations_unchanged++; continue; }
          db.run(`INSERT INTO wiz_ref_relations(relation_id,from_item_id,to_item_id,relation_type,epistemic_status,source_id,scope,rationale,seed_id,created_at)
                  VALUES(?,?,?,?,?,?,?,?,?,?)`,
            [rel.relation_id, rel.from_item_id, rel.to_item_id, rel.relation_type, rel.epistemic_status, rel.source_id,
              rel.scope, rel.rationale, _str(r.seed_id) || seedId, _num(r.created_at) || now]);
          res.relations_inserted++;
        }
      }
      // explicit supersession (after all items exist) — marks, never deletes
      for (const [oldId, newId, srcId, line] of pendingSupersede) {
        if (!_getItemRow(db, oldId)) { res.warnings.push({ line, msg: `supersedes_item_id ${oldId} not present (kept as reference only)` }); continue; }
        if (_markSuperseded(db, oldId, newId)) res.items_superseded++;
        const relId = `rel:auto:SUPERSEDES:${newId}->${oldId}`;
        if (!db.exec('SELECT 1 FROM wiz_ref_relations WHERE relation_id=?', [relId]).length)
          db.run(`INSERT INTO wiz_ref_relations(relation_id,from_item_id,to_item_id,relation_type,epistemic_status,source_id,scope,rationale,seed_id,created_at)
                  VALUES(?,?,?,?,?,?,?,?,?,?)`,
            [relId, newId, oldId, 'SUPERSEDES', 'SOURCE_ASSERTION', srcId, null, 'declared via supersedes_item_id', seedId, now]);
      }
      // items of the same seed that this revision no longer contains: counted, NOT deleted
      if (!isExport && prevSeed) {
        const r = db.exec("SELECT item_id FROM wiz_ref_items WHERE seed_id=? AND item_id NOT LIKE '%@%'", [seedId]);
        if (r.length) res.not_in_this_seed = r[0].values.filter(v => !seenItems.has(v[0])).length;
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
      res.errors.push({ line: 0, msg: 'import aborted: ' + e.message });
      return res;
    }
    res.ok = res.errors.length === 0;
    return res;
  }

  // ── Retrieval (provenance-bearing blocks) ────────────────────────────────
  const JOIN_SQL = `SELECT i.*, s.title AS source_title, s.surface AS source_surface, s.source_kind,
      s.authority_class, s.locator AS source_locator, s.revision AS source_revision, s.as_of AS source_as_of,
      s.currentness AS source_currentness, s.privacy AS source_privacy
    FROM wiz_ref_items i JOIN wiz_ref_sources s ON s.source_id = i.source_id`;
  const IMPL_TYPES = ['IMPLEMENTATION_FACT', 'VALIDATION_RESULT'];

  function _isDraft(r) {
    const hay = [r.source_status, r.source_currentness, r.validity, r.authority_scope].filter(Boolean).join(' ');
    return r.source_currentness === 'DRAFT' || /\bDRAFT\b|\bbranch\b|\bunmerged\b|\bopen pr\b/i.test(hay);
  }

  function toBlock(r) {
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
    const status = [r.epistemic_state || 'SOURCE_ASSERTION', r.source_status ? 'source_status=' + r.source_status : null,
      r.source_currentness ? 'currentness=' + r.source_currentness : null].filter(Boolean).join(' / ');
    const text = [
      `[REFERENCE MEMORY] ${r.project_id || '—'} / ${r.item_type} / ${status}`,
      `source: ${r.source_title} (${r.source_id}; ${r.source_surface}/${r.source_kind}; authority=${r.authority_class || 'UNSPECIFIED'}${r.source_revision ? '; rev=' + r.source_revision : ''})`,
      `as_of: ${asOf}${r.authority_scope ? ' · scope: ' + r.authority_scope : ''}${r.source_section ? ' · section: ' + r.source_section : ''}${r.provenance ? ' · provenance: ' + r.provenance : ''}`,
      `claim (source-bound, not verified truth): ${r.claim}`,
      ...caveats.map(c => '⚠ ' + c),
    ].join('\n');
    return {
      namespace: 'reference', item_id: r.item_id, claim: r.claim, project_id: r.project_id, item_type: r.item_type,
      epistemic_state: r.epistemic_state, source_status: r.source_status, validity: r.validity,
      authority_scope: r.authority_scope, confidence: r.confidence, source_section: r.source_section,
      as_of: r.as_of, provenance: r.provenance, lifecycle: r.lifecycle, superseded_by: r.superseded_by,
      supersedes_item_id: r.supersedes_item_id,
      source_id: r.source_id, source_title: r.source_title, source_surface: r.source_surface,
      source_kind: r.source_kind, authority_class: r.authority_class, source_revision: r.source_revision,
      source_as_of: r.source_as_of, source_currentness: r.source_currentness, source_privacy: r.source_privacy,
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
    if (f.authority_class) { w.push('s.authority_class=?'); p.push(f.authority_class); }
    if (f.source_kind) { w.push('s.source_kind=?'); p.push(f.source_kind); }
    if (f.surface) { w.push('s.surface=?'); p.push(f.surface); }
    if (f.source_id) { w.push('i.source_id=?'); p.push(f.source_id); }
    if (!f.include_superseded) w.push("COALESCE(i.lifecycle,'ACTIVE')!='SUPERSEDED'");
    if (f.implementation_evidence_only) w.push("s.surface='github' AND s.authority_class='IMPLEMENTATION_EVIDENCE'");
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

  function trace(db, itemId) {
    if (!db) return null;
    initSchema(db);
    const row = _rows(db, JOIN_SQL + ' WHERE i.item_id=?', [itemId])[0];
    if (!row) return null;
    const item = toBlock(row);
    const source = _getSource(db, row.source_id); if (source) delete source.record_hash;
    const outgoing = _rows(db, 'SELECT * FROM wiz_ref_relations WHERE from_item_id=? ORDER BY relation_type, to_item_id', [itemId]);
    const incoming = _rows(db, 'SELECT * FROM wiz_ref_relations WHERE to_item_id=? ORDER BY relation_type, from_item_id', [itemId]);
    // supersession lineage in both directions (bounded)
    const newer = [], older = [];
    let cur = row, guard = 0;
    while (cur && cur.superseded_by && guard++ < 50) { cur = _getItemRow(db, cur.superseded_by); if (cur) newer.push({ item_id: cur.item_id, lifecycle: cur.lifecycle, as_of: cur.as_of }); }
    const olderRows = _rows(db, 'SELECT item_id,lifecycle,as_of FROM wiz_ref_items WHERE superseded_by=? ORDER BY item_id', [itemId]);
    older.push(...olderRows);
    return { item, source, relations: { outgoing, incoming }, lineage: { newer, older } };
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
      const o = {}; for (const k of Object.keys(r)) if (r[k] != null) o[k] = r[k];
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

  const WizRef = { SCHEMA_VERSION, FORMAT, ENUMS, initSchema, importJSONL, search, getSource, project, trace,
    stats, exportJSONL, clearAll, toBlock, formatBlocks, getMeta, sha256Hex, HEADER };

  if (typeof module !== 'undefined' && module.exports) module.exports = WizRef;

  // ── Browser glue: global API over window._wizDB + minimal UI helpers ─────
  if (typeof window !== 'undefined' && root === window) {
    window.WizRef = WizRef;
    const db = () => window._wizDB;
    const save = () => { if (typeof window._wizSaveDB === 'function') window._wizSaveDB(); else if (typeof _wizSaveDB === 'function') _wizSaveDB(); };
    const ensure = async () => { if (!window._wizDB && typeof window.wizInitSQLite === 'function') await window.wizInitSQLite(); return window._wizDB; };
    window.wizRefSearch = (query, filters) => search(db(), query, filters);
    window.wizRefGetSource = (sourceId) => getSource(db(), sourceId);
    window.wizRefProject = (projectId, filters) => project(db(), projectId, filters);
    window.wizRefTrace = (itemId) => trace(db(), itemId);
    window.wizRefImportJSONL = async (text, opts) => {
      if (!(await ensure())) throw new Error('SQLite not initialised');
      const r = await importJSONL(db(), text, opts);
      if (r.committed) save();
      return r;
    };
    window.wizRefExportJSONL = () => exportJSONL(db());
    window.wizRefClearAll = () => { if (!db()) return false; clearAll(db()); save(); return true; };

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
      try {
        const r = await window.wizRefImportJSONL(await file.text());
        if (out) out.textContent = `Import ${r.committed ? 'committed' : 'FAILED'} — seed ${r.seed_id} ${r.seed_version}: ` +
          `+${r.items_inserted} items, ${r.items_unchanged} unchanged, ${r.items_revised} revised, ${r.items_superseded} superseded, ` +
          `+${r.sources_inserted} sources, +${r.relations_inserted} relations; errors ${r.errors.length}, warnings ${r.warnings.length}` +
          (r.errors.length ? '\n' + r.errors.slice(0, 5).map(e => `line ${e.line}: ${e.msg}`).join('\n') : '') +
          '\nThe local file can be deleted now — the SQLite copy persists in IndexedDB.';
        toast(r.committed ? '📚 Reference import done' : '⚠️ Reference import failed');
      } catch (e) { if (out) out.textContent = '❌ ' + e.message; }
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
      window.wizRefClearAll(); window.wizRefUiRender();
      const out = $('wizRefResult'); if (out) out.textContent = 'Reference namespace cleared.';
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
