// wiz-memory-admission.js — Memory Admission Controller v0.1 · REVIEW MODE ONLY (lab, step 1 of 2)
// ─────────────────────────────────────────────────────────────────────────────
// Status: RESEARCH/LAB · NOT CANON · NOT RUNTIME AUTHORIZATION · NOT A GLOBAL MEMORY OWNER ·
// NOT AN AUTOMATIC MEMORY WRITER · NOT AN E0-A REPLACEMENT. See docs/MEMORY_ADMISSION_REVIEW.md.
//
// An incoming information object ("memory passport") is validated, related wiz_ref_* records are
// retrieved through the existing WizRef API, deterministic hard rules are applied, and a transparent
// REVIEW PACKET is produced and staged in the lab-only table wiz_admission_reviews with
// review_state = 'AWAITING_REVIEW'. Nothing else happens until an explicit user decision.
//
//   LLM OUTPUT ≠ MEMORY DECISION · SIMILARITY ≠ IDENTITY ≠ DUPLICATE ≠ SUPERSESSION ·
//   NEW INFORMATION ≠ NEW MEMORY · RETRIEVED ≠ EVIDENCE · RELATION ≠ TRUTH
//
// ZERO-WRITE GUARANTEE: this file contains NO statement that writes wiz_ref_* tables. It only calls the
// read functions WizRef.search / WizRef.trace (and WizRef.sha256Hex). The only table it writes is
// wiz_admission_reviews. prepare() fingerprints every wiz_ref_* table (schema + rows) before and after
// and refuses to stage (ROLLBACK) if anything changed. apply()/dismiss() do NOT exist in step 1.
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

  const WizRefApi = () => (root && root.WizRef) || (typeof require === 'function' ? (() => { try { return require('./wiz-ref-memory.js'); } catch (e) { return null; } })() : null);

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
  function _rowsRaw(db, sql, p) { const st = db.prepare(sql); st.bind(p || []); const o = []; while (st.step()) o.push(st.get()); st.free(); return o; }
  function refInitialised(db) { return _rowsRaw(db, "SELECT 1 FROM sqlite_master WHERE type='table' AND name='wiz_ref_items'").length > 0; }

  // Fingerprint of ALL wiz_ref_* objects: schema rows of sqlite_master + every row of every wiz_ref* table
  // (incl. FTS shadow tables), order-independent. Read-only.
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
  async function refFingerprint(db) { const W = WizRefApi(); return W.sha256Hex(refSnapshot(db)); }

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
    for (const f of ['WHO', 'SCOPE', 'STATUS']) if (inc[f] !== undefined) inc[f] = _s(inc[f]);
    if (inc.RELATIONS !== undefined && !Array.isArray(inc.RELATIONS)) errors.push('RELATIONS must be an array of {relation_type, target_version_id}');
    return { errors, warnings, inc };
  }

  // exact content key (deterministic): normalized claim + type + scope + source + status
  const contentKey = (claim, type, scope, sourceId, status) => JSON.stringify([normText(claim), _s(type), _s(scope), _s(sourceId), _s(status) || 'SOURCE_ASSERTION']);
  const incKey = inc => contentKey(inc.WHAT, inc.TYPE, inc.SCOPE, inc.SOURCE && inc.SOURCE.source_id, inc.STATUS);
  const rowKey = r => contentKey(r.claim, r.item_type, r.project_id, r.source_id, r.epistemic_state);

  // ── candidate retrieval (thin wrapper over WizRef.search/trace; similarity only RANKS) ──
  function _candidate(W, db, b, rank, inc, mode) {
    const t = W.trace(db, b.version_id) || { relations: { outgoing: [], incoming: [] } };
    const rel = r => ({ relation_id: r.relation_id, relation_type: r.relation_type, from_version_id: r.from_version_id, to_version_id: r.to_version_id, epistemic_status: r.epistemic_status });
    return {
      rank, item_id: b.item_id, logical_item_id: b.logical_item_id, version_id: b.version_id, is_current_version: b.is_current_version,
      claim: b.claim, item_type: b.item_type, epistemic_state: b.epistemic_state, source_status: b.source_status, lifecycle: b.lifecycle || 'ACTIVE',
      project_id: b.project_id,
      source: { source_id: b.source_id, title: b.source_title, surface: b.source_surface, kind: b.source_kind, authority_class: b.authority_class, revision: b.source_revision, as_of: b.source_as_of },
      provenance: b.provenance, caveats: b.caveats, block: b.block,
      relations: { outgoing: t.relations.outgoing.map(rel), incoming: t.relations.incoming.map(rel) },
      similarity: { method: 'FTS5/BM25 via WizRef.search', match_mode: mode, note: 'RANK ONLY — similarity never sets the outcome' },
      deterministic: { exact_content_key: rowKey(b) === incKey(inc), same_logical_item: !!(inc.ITEM_ID && b.logical_item_id === _s(inc.ITEM_ID)) },
    };
  }
  function retrieveCandidates(db, inc, opts) {
    const W = WizRefApi(); const limit = Math.max(1, Math.min(Number((opts || {}).candidate_limit) || 8, 25));
    const rs = W.search(db, inc.WHAT, { project_id: inc.SCOPE, limit });
    return rs.map((b, i) => _candidate(W, db, b, i + 1, inc, b.match_mode));
  }
  // exact (non-similarity) lookup: every version (current + archived) of the same type in the same scope whose
  // normalized content key equals the incoming one. FTS is used only as an index over the claim terms (an exact
  // duplicate contains all of them); equality is decided by the content key, never by the score.
  function exactMatches(db, inc) {
    const W = WizRefApi(); const k = incKey(inc);
    const byTerms = W.search(db, inc.WHAT, { project_id: inc.SCOPE, item_type: inc.TYPE, include_superseded: true, limit: 100 });
    const byList = W.search(db, '', { project_id: inc.SCOPE, item_type: inc.TYPE, include_superseded: true, limit: 100 });
    const seen = new Set(), out = [];
    for (const b of byTerms.concat(byList)) if (!seen.has(b.version_id) && rowKey(b) === k) { seen.add(b.version_id); out.push(b); }
    return out;
  }
  function exactVersion(db, versionId) { // exact version lookup (no fuzzy resolution)
    const W = WizRefApi(); const t = _s(versionId) ? W.trace(db, _s(versionId)) : null;
    return t && t.version_id === _s(versionId) ? t : null;
  }

  // ── decision (deterministic; first matching rule wins) ──
  function decide(db, inc, candidates, opts) {
    const W = WizRefApi();
    const warnings = [], hard = [];
    const scope = (opts && opts.review_scope) || null;
    const res = (outcome, reason, extra) => Object.assign({ outcome, reason, warnings, hard_rules: hard, affected: [], relations: [], status_effect: { changes: [], note: 'no status change proposed' }, writes: [], basis: null }, extra || {});
    const ref = v => ({ version_id: v.version_id, logical_item_id: v.logical_item_id, item_id: v.item_id || (v.item && v.item.item_id), claim: v.claim || (v.item && v.item.claim), epistemic_state: v.epistemic_state || (v.item && v.item.epistemic_state), is_current_version: v.is_current_version });
    const newId = opts._newLogicalId;
    const addItem = () => ({ op: 'ADD_ITEM', logical_item_id: newId, item_type: inc.TYPE, claim: inc.WHAT, status: inc.STATUS, scope: inc.SCOPE, source_id: inc.SOURCE.source_id || null });

    // 1) scope
    if (scope && Array.isArray(scope.project_ids) && scope.project_ids.length && !scope.project_ids.includes(inc.SCOPE))
      return res('OUT_OF_SCOPE', `incoming SCOPE "${inc.SCOPE}" is outside the controller review scope [${scope.project_ids.join(', ')}] — no reference write is proposed`, { basis: 'SCOPE_MISMATCH' });
    if (!opts._refReady) { warnings.push('REFERENCE_MEMORY_NOT_INITIALISED — no candidates could be retrieved'); return res('UNCERTAIN', 'reference memory is not initialised; nothing to compare against — human review required'); }

    // 2) hard rules on the incoming status (apply regardless of candidates)
    const st = inc.STATUS.toUpperCase();
    if (VERIFIED_LIKE.includes(st)) { hard.push('CLAIM WITHOUT SOURCE ↛ VERIFIED / USER SAID X ≠ X IS TRUE'); warnings.push(`HARD_RULE_BLOCKED: incoming STATUS "${inc.STATUS}" is VERIFIED-like; admission never admits a claim as verified`); return res('UNCERTAIN', 'incoming asserts a VERIFIED-like status; blocked by hard rule — human review required'); }
    if (st === 'USER_DECISION' && isModel(inc.WHO)) { hard.push('MODEL_PROPOSAL ↛ USER_DECISION'); warnings.push('HARD_RULE_BLOCKED: model-originated incoming cannot carry STATUS USER_DECISION'); return res('UNCERTAIN', 'model output declared as USER_DECISION; blocked by hard rule'); }
    if (st === 'PROD_AUTH' && inc.TYPE === 'RESEARCH_RESULT') { hard.push('RESEARCH_RESULT ↛ PROD_AUTH'); return res('UNCERTAIN', 'RESEARCH_RESULT cannot carry PROD_AUTH; blocked by hard rule'); }

    // 3) deterministic DUPLICATE (hard identity only — never similarity)
    if (inc.EQUIVALENT_TO) {
      const eq = inc.EQUIVALENT_TO || {}; const by = _s(eq.declared_by).toUpperCase();
      const v = exactVersion(db, eq.version_id);
      if (!v) warnings.push(`EQUIVALENT_TO version "${eq.version_id}" not found — ignored`);
      else if (!EQUIVALENCE_DECLARERS.includes(by) || isModel(eq.declared_by)) { hard.push('LLM OUTPUT ≠ MEMORY DECISION'); warnings.push(`EQUIVALENT_TO declared_by "${eq.declared_by}" is not an accepted external declarer (${EQUIVALENCE_DECLARERS.join('/')}) — ignored`); }
      else if (!_s(eq.basis)) warnings.push('EQUIVALENT_TO without basis — ignored');
      else return res('DUPLICATE', `equivalence pre-declared by typed external input (declared_by=${by}, basis: ${_s(eq.basis)}) to exact version ${v.version_id}`, { basis: 'DECLARED_EQUIVALENCE', affected: [ref(Object.assign({}, v.item, v))], writes: [] });
    }
    const exact = exactMatches(db, inc);
    const exactCur = exact.filter(b => b.is_current_version), exactOld = exact.filter(b => !b.is_current_version);
    if (exactCur.length) {
      const idMatch = inc.ITEM_ID ? exactCur.find(b => b.logical_item_id === _s(inc.ITEM_ID)) : null;
      const hit = idMatch || exactCur[0];
      if (exactCur.length > 1) warnings.push(`${exactCur.length} current versions share the exact content key`);
      return res('DUPLICATE', `exact normalized content match (claim/type/scope/source/status) with current version ${hit.version_id}${idMatch ? ' and the same logical item_id' : ''}`, { basis: idMatch ? 'EXACT_IDENTITY_AND_CONTENT' : 'EXACT_CONTENT_KEY', affected: exactCur.map(ref) });
    }
    if (exactOld.length) { hard.push('SUPERSEDED ≠ ERASED'); warnings.push(`incoming equals ARCHIVED version(s) ${exactOld.map(b => b.version_id).join(', ')} — not a duplicate of the current state`); return res('UNCERTAIN', 'incoming matches only an archived (superseded) version; re-assertion vs. revert needs human review', { affected: exactOld.map(ref) }); }
    if (inc.ITEM_ID) { const cur = exactVersion(db, (W.trace(db, _s(inc.ITEM_ID)) || {}).version_id); if (cur) warnings.push(`ITEM_ID ${inc.ITEM_ID} exists with different content (current ${cur.version_id}); declare REFINES or PROPOSED_STATUS_CHANGE`); }

    // 4) explicit typed intents (never inferred from candidates: RETRIEVED ≠ EVIDENCE, SIMILAR ≠ SAME)
    const rels = Array.isArray(inc.RELATIONS) ? inc.RELATIONS : [];
    const intents = (inc.REFINES ? 1 : 0) + rels.length + (inc.PROPOSED_STATUS_CHANGE ? 1 : 0);
    if (inc.SUPERSEDES) { warnings.push('SUPERSEDES given — supersession is not an admission outcome in v0.1; reviewer decides'); }
    if (intents > 1) return res('UNCERTAIN', `ambiguous typed intent (${intents} declared: REFINES/RELATIONS/PROPOSED_STATUS_CHANGE) — human review required`, { affected: candidates.map(ref) });

    if (inc.PROPOSED_STATUS_CHANGE) {
      const sc = inc.PROPOSED_STATUS_CHANGE || {};
      const v = exactVersion(db, sc.target_version_id);
      const missing = ['target_version_id', 'from_status', 'to_status', 'authority', 'evidence', 'rationale'].filter(f => !_s(typeof sc[f] === 'object' ? JSON.stringify(sc[f]) : sc[f]));
      if (missing.length) return res('UNCERTAIN', `status change without basis (missing ${missing.join(', ')}) — not proposed`, { affected: v ? [ref(Object.assign({}, v.item, v))] : [] });
      if (!v) return res('UNCERTAIN', `status change target ${sc.target_version_id} is not an existing exact version`);
      const from = _s(sc.from_status).toUpperCase(), to = _s(sc.to_status).toUpperCase(), cur = _s(v.item.epistemic_state).toUpperCase();
      const aff = [ref(Object.assign({}, v.item, v))];
      if (from !== cur) return res('UNCERTAIN', `declared from_status ${from} ≠ current status ${cur} of ${v.version_id} (stale request)`, { affected: aff });
      const forb = FORBIDDEN_TRANSITIONS.find(([a, b]) => a === from && b === to)
        || (v.item.item_type === 'RESEARCH_RESULT' && to === 'PROD_AUTH' ? ['RESEARCH_RESULT', 'PROD_AUTH'] : null)
        || (to === 'USER_DECISION' && (isModel(inc.WHO) || isModel(sc.authority)) ? ['MODEL_PROPOSAL', 'USER_DECISION'] : null);
      if (forb) { hard.push(`${forb[0]} ↛ ${forb[1]}`); warnings.push(`HARD_RULE_BLOCKED: ${forb[0]} → ${forb[1]}`); return res('UNCERTAIN', `status transition ${from} → ${to} is forbidden by hard rule ${forb[0]} ↛ ${forb[1]}`, { affected: aff }); }
      if ((VERIFIED_LIKE.includes(to) || to === 'USER_DECISION') && isModel(sc.authority)) { hard.push('LLM OUTPUT ≠ MEMORY DECISION'); return res('UNCERTAIN', `promotion to ${to} with model authority "${sc.authority}" is blocked`, { affected: aff }); }
      return res('STATUS_CHANGE', `explicit status change request ${from} → ${to} on exact version ${v.version_id} (authority: ${_s(sc.authority)}; rationale: ${_s(sc.rationale)})`, {
        basis: 'TYPED_STATUS_CHANGE', affected: aff,
        status_effect: { changes: [{ target_version_id: v.version_id, from_status: from, proposed_to_status: to, source: inc.SOURCE, authority: sc.authority, evidence: sc.evidence, rationale: sc.rationale }], note: 'proposal only — applied (step 2) as a new immutable version; relations to the old version stay pinned' },
        writes: [{ op: 'ADD_ITEM_VERSION', logical_item_id: v.logical_item_id, base_version_id: v.version_id, change: 'epistemic_state', from_status: from, to_status: to }],
      });
    }
    if (inc.REFINES) {
      const v = exactVersion(db, inc.REFINES);
      if (!v) return res('UNCERTAIN', `REFINES target ${inc.REFINES} is not an existing exact version`);
      const aff = [ref(Object.assign({}, v.item, v))];
      if (!v.is_current_version) return res('UNCERTAIN', `REFINES target ${v.version_id} is an archived version; refinement applies to the current version only`, { affected: aff });
      if (v.item.item_type !== inc.TYPE || _s(v.item.project_id) !== inc.SCOPE) return res('UNCERTAIN', 'REFINES target differs in TYPE or SCOPE — not a refinement', { affected: aff });
      if (_s(v.item.epistemic_state).toUpperCase() !== st) return res('UNCERTAIN', `refinement cannot carry a status transition (${v.item.epistemic_state} → ${inc.STATUS}); use PROPOSED_STATUS_CHANGE`, { affected: aff });
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
      const aff = [ref(Object.assign({}, v.item, v))];
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

  // ── prepare(): build + stage a review packet. The ONLY write is one INSERT into wiz_admission_reviews. ──
  async function prepare(db, incoming, opts = {}) {
    if (!db) throw new Error('no database');
    const W = WizRefApi(); if (!W) throw new Error('WizRef (reference memory) not loaded');
    if (opts.mode !== undefined && _s(opts.mode).toUpperCase() !== ADMISSION_MODE) return { ok: false, errors: [`mode "${opts.mode}" rejected — ADMISSION_MODE = REVIEW is the only mode`], warnings: [] };
    const { errors, warnings, inc } = normalizeIncoming(incoming);
    if (errors.length) return { ok: false, errors, warnings }; // nothing staged, nothing written
    const refReady = refInitialised(db);
    const fpBefore = refReady ? await refFingerprint(db) : null;
    const key = incKey(inc);
    const newLogicalId = _s(inc.ITEM_ID) || ('adm:' + (await W.sha256Hex(key)).split(':')[1].slice(0, 16));
    const candidates = refReady && !(opts.review_scope && Array.isArray(opts.review_scope.project_ids) && opts.review_scope.project_ids.length && !opts.review_scope.project_ids.includes(inc.SCOPE))
      ? retrieveCandidates(db, inc, opts) : [];
    const d = decide(db, inc, candidates, Object.assign({}, opts, { _refReady: refReady, _newLogicalId: newLogicalId }));
    if (!OUTCOMES.includes(d.outcome)) throw new Error('internal: outcome outside the closed enum');
    const fpAfter = refReady ? await refFingerprint(db) : null;
    if (fpBefore !== fpAfter) throw new Error('ZERO-WRITE VIOLATION: wiz_ref_* changed during prepare — nothing staged');
    const createdAt = Date.now();
    const reviewId = 'adm-review:' + createdAt.toString(36) + ':' + (await W.sha256Hex(key + '|' + createdAt + '|' + Math.random())).split(':')[1].slice(0, 12);
    const packet = {
      mode: ADMISSION_MODE, admission_version: VERSION, review_id: reviewId, created_at: createdAt,
      incoming: inc,
      candidate_matches: candidates,
      proposed_outcome: d.outcome,
      reason: d.reason,
      decision_basis: d.basis || 'NONE (no deterministic basis)',
      affected_records: d.affected,
      proposed_relations: d.relations,
      proposed_status_effect: d.status_effect,
      provenance: { passport: inc.PROVENANCE, source: inc.SOURCE, who: inc.WHO, when: inc.WHEN, content_key_sha256: await W.sha256Hex(key) },
      hard_rules_triggered: d.hard_rules,
      warnings: warnings.concat(d.warnings),
      write_plan: { executes: false, note: 'PROPOSAL ONLY — nothing has been written to reference memory; apply is step 2 (via WizRef.importJSONL) and requires an explicit user decision', writes: d.writes },
      ref_fingerprint: { before: fpBefore, after: fpAfter, unchanged: fpBefore === fpAfter },
      state: 'AWAITING_REVIEW',
    };
    for (const f of ['reason', 'affected_records', 'provenance']) if (packet[f] === undefined || packet[f] === null) throw new Error('internal: mandatory packet field missing: ' + f);
    initSchema(db);
    db.run('BEGIN');
    try {
      db.run(`INSERT INTO ${TABLE}(review_id,created_at,mode,incoming_json,candidate_json,proposed_outcome,rationale,affected_records_json,write_plan_json,review_state,reviewed_at,packet_json)
        VALUES(?,?,?,?,?,?,?,?,?,?,NULL,?)`, [reviewId, createdAt, ADMISSION_MODE, JSON.stringify(inc), JSON.stringify(candidates), d.outcome, d.reason,
        JSON.stringify(d.affected), JSON.stringify(packet.write_plan), 'AWAITING_REVIEW', JSON.stringify(packet)]);
      if (refReady && (await refFingerprint(db)) !== fpBefore) throw new Error('ZERO-WRITE VIOLATION after staging');
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
      `PROVENANCE: ${j(p.provenance)}`,
      `CANDIDATES (${p.candidate_matches.length}; similarity ranks only):`,
      ...p.candidate_matches.map(c => `  #${c.rank} ${c.version_id} [${c.item_type} / ${c.epistemic_state} / ${c.lifecycle}]${c.deterministic.exact_content_key ? ' EXACT-CONTENT' : ''}\n    ${c.claim}\n    source: ${c.source.title} (${c.source.source_id}; ${c.source.surface}; authority=${c.source.authority_class || '—'})`),
      `AFFECTED RECORDS: ${j(p.affected_records)}`,
      `PROPOSED RELATIONS: ${j(p.proposed_relations)}`,
      `PROPOSED STATUS EFFECT: ${j(p.proposed_status_effect)}`,
      `WRITE PLAN (not executed): ${j(p.write_plan)}`,
      `WARNINGS: ${p.warnings.length ? p.warnings.map(w => '\n  ⚠ ' + w).join('') : 'none'}`,
      `HARD RULES TRIGGERED: ${p.hard_rules_triggered.length ? p.hard_rules_triggered.join(' · ') : 'none'}`,
      'Awaiting explicit user decision (apply/dismiss are step 2 — not available in this build).',
    ].join('\n');
  }

  const api = { VERSION, ADMISSION_MODE, OUTCOMES, REVIEW_STATES, PASSPORT_FIELDS, REQUIRED_FIELDS, TYPED_INPUTS,
    RELATED_ITEM_RELATION_TYPES, EVIDENCE_DIRECTIONS, VERIFIED_LIKE, FORBIDDEN_TRANSITIONS, TABLE, DDL, DDL_INDEX,
    initSchema, normalizeIncoming, prepare, getReview, listPending, refFingerprint, refSnapshot, formatPacket };
  Object.freeze(api);

  // ── Browser glue (explicit, user-initiated only; no agent tool, no context injection) ──
  if (typeof window !== 'undefined' && typeof document !== 'undefined' && root === window) {
    const db = () => window._wizDB;
    const $ = id => document.getElementById(id);
    // persist the staging write through the VERIFIED awaitable path (oncomplete → exact read-back → SHA-256)
    const persist = async () => {
      if (typeof window._wizSaveDBAsync !== 'function') throw new Error('awaitable IndexedDB save unavailable');
      return window._wizSaveDBAsync();
    };
    window.wizAdmissionPrepare = async (incoming, opts) => {
      if (!db() && typeof window.wizInitSQLite === 'function') await window.wizInitSQLite();
      const r = await prepare(db(), incoming, opts || {});
      if (!r.ok) return Object.assign(r, { persisted: false });
      try { const ack = await persist(); r.persisted = true; r.persisted_sha256 = ack.sha256 || null; }
      catch (e) { r.persisted = false; r.persist_error = String((e && e.message) || e); }
      return r;
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
    window.wizAdmUiPrepare = async () => {
      const out = $('wizAdmResult'); if (!out) return;
      out.dataset.state = 'pending'; out.dataset.persisted = 'false'; out.dataset.outcome = '';
      let inc;
      try { inc = JSON.parse(($('wizAdmIncoming') || {}).value || ''); } catch (e) { out.textContent = '❌ incoming is not valid JSON: ' + e.message; out.dataset.state = 'done'; return; }
      const scopeTxt = (($('wizAdmScope') || {}).value || '').trim();
      const opts = scopeTxt ? { review_scope: { project_ids: scopeTxt.split(',').map(s => s.trim()).filter(Boolean) } } : {};
      try {
        const r = await window.wizAdmissionPrepare(inc, opts);
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
