// working-memory.js — isolated Working Memory data layer for Eiti Wizard Lab.
//
// This is NOT Canon and never writes to wiz_facts, ledger, wiz_ref_*, or any
// other memory namespace. Mutations must be created through create(db, {persist})
// so the SQLite transaction is followed by an awaited, verified durable save.
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WorkingMemory = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  const EXPORT_FORMAT = 'eiti-working-memory-export/1';
  const MULTI_TAB_WRITES = 'NOT_SUPPORTED_IN_V0_1';
  const ENUMS = Object.freeze({
    type: Object.freeze(['NOTE', 'QUOTE', 'VALUE', 'QUESTION', 'HYPOTHESIS', 'DECISION', 'MODEL_PROPOSAL', 'DONOR_CANDIDATE', 'EXPERIMENT', 'FINDING', 'SYSTEM', 'TASK', 'SOURCE_POINTER']),
    status: Object.freeze(['CURRENT', 'OPEN', 'IN_PROGRESS', 'BLOCKED', 'UNKNOWN', 'RESOLVED', 'COMPLETED', 'REJECTED', 'SUPERSEDED']),
    priority: Object.freeze(['P0', 'P1', 'P2', 'P3', 'TAIL']),
    provenance_class: Object.freeze(['USER_NOTE', 'USER_DECISION', 'USER_QUOTE', 'MODEL_PROPOSAL', 'MODEL_SUMMARY', 'PROJECT_SOURCE', 'EXTERNAL_SOURCE', 'EXPERIMENT_RESULT']),
    surface: Object.freeze(['GITHUB', 'NOTION', 'DRIVE', 'LOCAL', 'WEB', 'CHAT', 'OTHER']),
    role: Object.freeze(['PRIMARY', 'EVIDENCE', 'CONTEXT', 'NAVIGATION', 'REFERENCE']),
    relation_type: Object.freeze(['RELATED_TO', 'BLOCKED_BY', 'DEPENDS_ON', 'DERIVED_FROM', 'SUPERSEDES']),
  });
  const UNRESOLVED_STATUSES = Object.freeze(['OPEN', 'IN_PROGRESS', 'BLOCKED', 'UNKNOWN']);
  const ITEM_COLUMNS = Object.freeze([
    'work_id', 'project_id', 'thread', 'type', 'status', 'priority', 'title', 'summary', 'body_md',
    'current_question', 'status_note', 'next_action', 'provenance_class', 'tags_json', 'non_canon',
    'created_at', 'updated_at', 'resolved_at', 'archived_at',
  ]);
  const TABLE_COLUMNS = Object.freeze({
    wm_projects: Object.freeze(['project_id', 'code', 'name', 'summary', 'created_at', 'updated_at']),
    wm_sources: Object.freeze(['source_id', 'project_id', 'surface', 'role', 'title', 'locator', 'revision', 'note', 'created_at', 'updated_at']),
    wm_items: ITEM_COLUMNS,
    wm_item_sources: Object.freeze(['work_id', 'source_id', 'is_primary']),
    wm_relations: Object.freeze(['relation_id', 'from_work_id', 'to_work_id', 'relation_type', 'created_at']),
    wm_changes: Object.freeze(['change_id', 'work_id', 'change_type', 'actor_class', 'changed_fields_json', 'before_json', 'after_json', 'created_at']),
  });
  const TABLE_KEYS = Object.freeze({
    wm_projects: ['project_id'], wm_sources: ['source_id'], wm_items: ['work_id'],
    wm_item_sources: ['work_id', 'source_id'], wm_relations: ['relation_id'], wm_changes: ['change_id'],
  });
  const WRITE_QUEUES = new WeakMap();
  const NOOP = Object.freeze({ __workingMemoryNoop: true });

  function fail(message, code) {
    const error = new Error(message);
    if (code) error.code = code;
    return error;
  }
  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function plainObject(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function requiredText(value, label) {
    if (typeof value !== 'string' || !value.trim()) throw fail(label + ' must be non-empty text', 'VALIDATION');
    return value.trim();
  }
  function nullableText(value, label) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw fail(label + ' must be text or null', 'VALIDATION');
    return value;
  }
  function timestamp(value, label) {
    const out = requiredText(value, label);
    if (!Number.isFinite(Date.parse(out))) throw fail(label + ' must be a valid timestamp', 'VALIDATION');
    return out;
  }
  function nowIso(clock) {
    const value = clock();
    return timestamp(typeof value === 'string' ? value : new Date(value).toISOString(), 'timestamp');
  }
  function enumValue(value, name, defaultValue) {
    const selected = value == null || value === '' ? defaultValue : value;
    if (!ENUMS[name] || !ENUMS[name].includes(selected)) throw fail('Invalid ' + name + ': ' + String(selected), 'INVALID_ENUM');
    return selected;
  }
  function generateId(prefix) {
    const c = (root && root.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (c && typeof c.randomUUID === 'function') return prefix + c.randomUUID().toLowerCase();
    if (c && typeof c.getRandomValues === 'function') {
      const bytes = new Uint8Array(16); c.getRandomValues(bytes);
      return prefix + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    throw fail('Secure random ID generation is unavailable', 'ID_GENERATION');
  }
  function normalizeTags(value) {
    let tags = value;
    if (tags === undefined || tags === null) tags = [];
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch (_) { throw fail('tags_json must contain a JSON array', 'VALIDATION'); }
    }
    if (!Array.isArray(tags) || tags.some(tag => typeof tag !== 'string' || !tag.trim()))
      throw fail('tags_json must be an array of non-empty strings', 'VALIDATION');
    return JSON.stringify(tags.map(tag => tag.trim()));
  }
  function normalizeMetadata(value) {
    if (value === undefined || value === null) return '{}';
    let parsed = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch (_) { throw fail('metadata_json must be valid JSON', 'VALIDATION'); }
    }
    if (!plainObject(parsed)) throw fail('metadata_json must be a JSON object', 'VALIDATION');
    return typeof value === 'string' ? value : JSON.stringify(parsed);
  }
  function dbRows(db, sql, params) {
    const statement = db.prepare(sql);
    try {
      statement.bind(params || []);
      const out = [];
      while (statement.step()) out.push(statement.getAsObject());
      return out;
    } finally { statement.free(); }
  }
  function one(db, sql, params) { return dbRows(db, sql, params)[0] || null; }
  function tableExists(db, name) {
    return !!one(db, "SELECT name FROM sqlite_master WHERE name=?", [name]);
  }
  function initSchema(db) {
    if (!db) throw fail('SQLite database is required', 'DB_REQUIRED');
    for (const [table, expected] of Object.entries(TABLE_COLUMNS)) {
      if (!tableExists(db, table)) continue;
      const actual = dbRows(db, 'PRAGMA table_info(' + table + ')').map(row => row.name);
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw fail('Existing Working Memory table does not match corrected contract: ' + table, 'WM_SCHEMA_MISMATCH');
    }
    db.run(`CREATE TABLE IF NOT EXISTS wm_projects (
      project_id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE CHECK(code GLOB '[A-Z]*' AND code NOT GLOB '*[^A-Z0-9-]*' AND substr(code,-1,1) <> '-'),
      name TEXT NOT NULL CHECK(length(trim(name)) > 0), summary TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wm_sources (
      source_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, surface TEXT NOT NULL CHECK(surface IN ('GITHUB','NOTION','DRIVE','LOCAL','WEB','CHAT','OTHER')),
      role TEXT NOT NULL CHECK(role IN ('PRIMARY','EVIDENCE','CONTEXT','NAVIGATION','REFERENCE')),
      title TEXT NOT NULL CHECK(length(trim(title)) > 0), locator TEXT NOT NULL CHECK(length(trim(locator)) > 0),
      revision TEXT, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY(project_id) REFERENCES wm_projects(project_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wm_items (
      work_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, thread TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK(type IN ('NOTE','QUOTE','VALUE','QUESTION','HYPOTHESIS','DECISION','MODEL_PROPOSAL','DONOR_CANDIDATE','EXPERIMENT','FINDING','SYSTEM','TASK','SOURCE_POINTER')),
      status TEXT NOT NULL CHECK(status IN ('CURRENT','OPEN','IN_PROGRESS','BLOCKED','UNKNOWN','RESOLVED','COMPLETED','REJECTED','SUPERSEDED')),
      priority TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3','TAIL')),
      title TEXT NOT NULL CHECK(length(trim(title)) > 0), summary TEXT, body_md TEXT,
      current_question TEXT, status_note TEXT, next_action TEXT,
      provenance_class TEXT NOT NULL CHECK(provenance_class IN ('USER_NOTE','USER_DECISION','USER_QUOTE','MODEL_PROPOSAL','MODEL_SUMMARY','PROJECT_SOURCE','EXTERNAL_SOURCE','EXPERIMENT_RESULT')),
      tags_json TEXT NOT NULL DEFAULT '[]', non_canon INTEGER NOT NULL DEFAULT 1 CHECK(non_canon=1),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT, archived_at TEXT,
      CHECK(status <> 'BLOCKED' OR length(trim(COALESCE(status_note,''))) > 0),
      CHECK(status <> 'RESOLVED' OR (length(trim(COALESCE(status_note,''))) > 0 AND resolved_at IS NOT NULL)),
      CHECK(status <> 'REJECTED' OR length(trim(COALESCE(status_note,''))) > 0),
      FOREIGN KEY(project_id) REFERENCES wm_projects(project_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wm_item_sources (
      work_id TEXT NOT NULL, source_id TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
      PRIMARY KEY(work_id, source_id),
      FOREIGN KEY(work_id) REFERENCES wm_items(work_id), FOREIGN KEY(source_id) REFERENCES wm_sources(source_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wm_relations (
      relation_id TEXT PRIMARY KEY, from_work_id TEXT NOT NULL, to_work_id TEXT NOT NULL,
      relation_type TEXT NOT NULL CHECK(relation_type IN ('RELATED_TO','BLOCKED_BY','DEPENDS_ON','DERIVED_FROM','SUPERSEDES')),
      created_at TEXT NOT NULL, CHECK(from_work_id <> to_work_id),
      FOREIGN KEY(from_work_id) REFERENCES wm_items(work_id), FOREIGN KEY(to_work_id) REFERENCES wm_items(work_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS wm_changes (
      change_id TEXT PRIMARY KEY, work_id TEXT, change_type TEXT NOT NULL,
      actor_class TEXT NOT NULL CHECK(length(trim(actor_class)) > 0), changed_fields_json TEXT NOT NULL CHECK(json_valid(changed_fields_json)),
      before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
    )`);
    db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS wm_items_fts
      USING fts5(work_id UNINDEXED, title, summary, body_md, tags_json, tokenize='unicode61')`);
    db.run('CREATE INDEX IF NOT EXISTS wm_items_project ON wm_items(project_id)');
    db.run('CREATE INDEX IF NOT EXISTS wm_items_status ON wm_items(status, archived_at)');
    db.run('CREATE INDEX IF NOT EXISTS wm_sources_project ON wm_sources(project_id)');
    db.run('CREATE INDEX IF NOT EXISTS wm_relations_from ON wm_relations(from_work_id)');
    db.run('CREATE INDEX IF NOT EXISTS wm_relations_to ON wm_relations(to_work_id)');
    db.run('CREATE UNIQUE INDEX IF NOT EXISTS wm_item_sources_one_primary ON wm_item_sources(work_id) WHERE is_primary=1');
    db.run(`CREATE TRIGGER IF NOT EXISTS wm_items_fts_insert AFTER INSERT ON wm_items BEGIN
      INSERT INTO wm_items_fts(rowid,work_id,title,summary,body_md,tags_json)
      VALUES(new.rowid,new.work_id,new.title,COALESCE(new.summary,''),COALESCE(new.body_md,''),new.tags_json);
    END`);
    db.run(`CREATE TRIGGER IF NOT EXISTS wm_items_fts_update AFTER UPDATE ON wm_items BEGIN
      DELETE FROM wm_items_fts WHERE rowid=old.rowid;
      INSERT INTO wm_items_fts(rowid,work_id,title,summary,body_md,tags_json)
      VALUES(new.rowid,new.work_id,new.title,COALESCE(new.summary,''),COALESCE(new.body_md,''),new.tags_json);
    END`);
    db.run(`CREATE TRIGGER IF NOT EXISTS wm_items_no_hard_delete BEFORE DELETE ON wm_items BEGIN
      SELECT RAISE(ABORT, 'Working Memory items are archived, not deleted');
    END`);
    db.run(`CREATE TRIGGER IF NOT EXISTS wm_items_work_id_immutable BEFORE UPDATE OF work_id ON wm_items
      WHEN new.work_id <> old.work_id BEGIN
      SELECT RAISE(ABORT, 'Working Memory work_id is immutable');
    END`);
    db.run(`CREATE TRIGGER IF NOT EXISTS wm_items_project_id_immutable BEFORE UPDATE OF project_id ON wm_items
      WHEN new.project_id <> old.project_id BEGIN
      SELECT RAISE(ABORT, 'Working Memory project_id is immutable');
    END`);
    db.run(`CREATE TRIGGER IF NOT EXISTS wm_changes_no_update BEFORE UPDATE ON wm_changes BEGIN
      SELECT RAISE(ABORT, 'Working Memory change log is append-only');
    END`);
    db.run(`CREATE TRIGGER IF NOT EXISTS wm_changes_no_delete BEFORE DELETE ON wm_changes BEGIN
      SELECT RAISE(ABORT, 'Working Memory change log is append-only');
    END`);
    db.run(`INSERT INTO wm_items_fts(work_id,title,summary,body_md,tags_json)
      SELECT i.work_id,i.title,COALESCE(i.summary,''),COALESCE(i.body_md,''),i.tags_json
      FROM wm_items i WHERE NOT EXISTS (SELECT 1 FROM wm_items_fts f WHERE f.work_id=i.work_id)`);
    for (const [table, expected] of Object.entries(TABLE_COLUMNS)) {
      const actual = dbRows(db, 'PRAGMA table_info(' + table + ')').map(row => row.name);
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw fail('Existing Working Memory table does not match corrected contract: ' + table, 'WM_SCHEMA_MISMATCH');
    }
    const sourceProjectColumn = dbRows(db, 'PRAGMA table_info(wm_sources)').find(row => row.name === 'project_id');
    if (!sourceProjectColumn || sourceProjectColumn.notnull !== 1)
      throw fail('Existing Working Memory source table must require project_id', 'WM_SCHEMA_MISMATCH');
    return true;
  }
  function assertId(value, label) { return requiredText(value, label); }
  function projectRow(input, clock, idFactory) {
    if (!plainObject(input)) throw fail('Project must be an object', 'VALIDATION');
    const at = nowIso(clock);
    const code = requiredText(input.code, 'code').toUpperCase();
    if (!/^[A-Z][A-Z0-9-]*[A-Z0-9]$/.test(code) && !/^[A-Z]$/.test(code))
      throw fail('code must be uppercase alphanumeric with optional internal hyphens', 'VALIDATION');
    return {
      project_id: input.project_id == null ? idFactory('wmp_') : assertId(input.project_id, 'project_id'),
      code, name: requiredText(input.name, 'name'), summary: nullableText(input.summary, 'summary'),
      created_at: input.created_at == null ? at : timestamp(input.created_at, 'created_at'),
      updated_at: input.updated_at == null ? at : timestamp(input.updated_at, 'updated_at'),
    };
  }
  function sourceRow(input, clock, idFactory) {
    if (!plainObject(input)) throw fail('Source must be an object', 'VALIDATION');
    const at = nowIso(clock);
    const projectId = assertId(input.project_id, 'project_id');
    return {
      source_id: input.source_id == null ? idFactory('wms_') : assertId(input.source_id, 'source_id'),
      project_id: projectId, surface: enumValue(input.surface, 'surface'), role: enumValue(input.role, 'role'),
      title: requiredText(input.title, 'title'), locator: requiredText(input.locator, 'locator'),
      revision: nullableText(input.revision, 'revision'), note: nullableText(input.note, 'note'),
      created_at: input.created_at == null ? at : timestamp(input.created_at, 'created_at'),
      updated_at: input.updated_at == null ? at : timestamp(input.updated_at, 'updated_at'),
    };
  }
  function validateWorkId(value) {
    const workId = assertId(value, 'work_id');
    const match = /^WRK-([A-Z][A-Z0-9-]*[A-Z0-9]|[A-Z])-(\d{8})-(\d{3,})$/.exec(workId);
    if (!match || Number(match[3]) < 1) throw fail('work_id must match WRK-<PROJECT_CODE>-<YYYYMMDD>-<NNN>', 'INVALID_WORK_ID');
    const day = match[2];
    const normalized = new Date(Date.UTC(Number(day.slice(0,4)), Number(day.slice(4,6)) - 1, Number(day.slice(6,8)))).toISOString().slice(0,10).replace(/-/g, '');
    if (normalized !== day) throw fail('work_id contains an invalid calendar date', 'INVALID_WORK_ID');
    return { work_id: workId, project_code: match[1], date: day, sequence: Number(match[3]) };
  }
  function nextWorkId(db, projectCode, at) {
    const day = new Date(at).toISOString().slice(0,10).replace(/-/g, '');
    const prefix = 'WRK-' + projectCode + '-' + day + '-';
    const pattern = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d{3,})$');
    let largest = 0;
    for (const row of dbRows(db, 'SELECT work_id FROM wm_items WHERE work_id LIKE ?', [prefix + '%'])) {
      const match = pattern.exec(row.work_id);
      if (match) largest = Math.max(largest, Number(match[1]));
    }
    return prefix + String(largest + 1).padStart(3, '0');
  }
  function itemRow(input, clock, idFactory, generatedWorkId) {
    if (!plainObject(input)) throw fail('Item must be an object', 'VALIDATION');
    if (own(input, 'non_canon') && input.non_canon !== true && input.non_canon !== 1)
      throw fail('non_canon is an invariant and must remain true', 'NON_CANON_INVARIANT');
    const at = nowIso(clock);
    const status = enumValue(input.status, 'status', 'OPEN');
    const resolved = input.resolved_at == null || input.resolved_at === '' ? null : timestamp(input.resolved_at, 'resolved_at');
    const projectId = requiredText(input.project_id, 'project_id');
    const out = {
      work_id: generatedWorkId || validateWorkId(input.work_id).work_id,
      project_id: projectId, thread: input.thread == null || input.thread === '' ? '' : requiredText(input.thread, 'thread'),
      type: enumValue(input.type, 'type', 'NOTE'), status,
      priority: enumValue(input.priority, 'priority', 'P2'), title: requiredText(input.title, 'title'),
      summary: nullableText(input.summary, 'summary'), body_md: nullableText(input.body_md, 'body_md'),
      current_question: nullableText(input.current_question, 'current_question'),
      status_note: nullableText(input.status_note, 'status_note'), next_action: nullableText(input.next_action, 'next_action'),
      provenance_class: enumValue(input.provenance_class, 'provenance_class'),
      tags_json: normalizeTags(own(input, 'tags_json') ? input.tags_json : input.tags), non_canon: 1,
      created_at: input.created_at == null ? at : timestamp(input.created_at, 'created_at'),
      updated_at: input.updated_at == null ? at : timestamp(input.updated_at, 'updated_at'),
      resolved_at: resolved || (status === 'RESOLVED' && generatedWorkId ? at : null),
      archived_at: input.archived_at == null || input.archived_at === '' ? null : timestamp(input.archived_at, 'archived_at'),
    };
    assertItemRules(out);
    return out;
  }
  function assertItemRules(item) {
    if (['BLOCKED', 'RESOLVED', 'REJECTED'].includes(item.status) && !(item.status_note && item.status_note.trim()))
      throw fail(item.status + ' requires a non-empty status_note', 'STATUS_NOTE_REQUIRED');
    if (item.status === 'RESOLVED' && !item.resolved_at) throw fail('RESOLVED requires resolved_at', 'RESOLVED_AT_REQUIRED');
  }
  function assertProjectExists(db, projectId) {
    if (projectId && !one(db, 'SELECT project_id FROM wm_projects WHERE project_id=?', [projectId]))
      throw fail('Unknown project_id: ' + projectId, 'NOT_FOUND');
  }
  function assertItemExists(db, workId) {
    if (!one(db, 'SELECT work_id FROM wm_items WHERE work_id=?', [workId])) throw fail('Unknown work_id: ' + workId, 'NOT_FOUND');
  }
  function assertSourceExists(db, sourceId) {
    if (!one(db, 'SELECT source_id FROM wm_sources WHERE source_id=?', [sourceId])) throw fail('Unknown source_id: ' + sourceId, 'NOT_FOUND');
  }
  function getById(db, table, idColumn, id) {
    return one(db, 'SELECT * FROM ' + table + ' WHERE ' + idColumn + '=?', [id]);
  }
  function changedFields(before, after) {
    if (before == null) return Object.keys(after || {}).sort();
    const keys = Array.from(new Set(Object.keys(before || {}).concat(Object.keys(after || {})))).sort();
    return keys.filter(key => JSON.stringify(before[key] == null ? null : before[key]) !== JSON.stringify(after[key] == null ? null : after[key]));
  }
  function normalizeChangedFields(value, label) {
    let fields = value;
    if (fields == null) fields = [];
    if (typeof fields === 'string') {
      try { fields = JSON.parse(fields); } catch (_) { throw fail(label + ' must contain a JSON array', 'VALIDATION'); }
    }
    if (!Array.isArray(fields) || fields.some(field => typeof field !== 'string' || !field.trim()))
      throw fail(label + ' must be an array of non-empty field names', 'VALIDATION');
    return JSON.stringify(Array.from(new Set(fields.map(field => field.trim()))).sort());
  }
  function changeRow(db, clock, idFactory, workId, type, before, after, actorClass, fields) {
    const row = {
      change_id: idFactory('wmc_'), work_id: workId || null, change_type: requiredText(type, 'change_type'),
      actor_class: requiredText(actorClass, 'actor_class'),
      changed_fields_json: normalizeChangedFields(fields === undefined ? changedFields(before, after) : fields, 'changed_fields_json'),
      before_json: before == null ? null : JSON.stringify(before),
      after_json: after == null ? null : JSON.stringify(after), created_at: nowIso(clock),
    };
    db.run('INSERT INTO wm_changes(change_id,work_id,change_type,actor_class,changed_fields_json,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?)',
      TABLE_COLUMNS.wm_changes.map(key => row[key]));
    return row;
  }
  function result(ok, fields) { return Object.assign({ ok: !!ok, saved: !!ok }, fields || {}); }
  function rowFromExec(db, sql, params) { return dbRows(db, sql, params); }
  function itemSourceRow(input) {
    if (!plainObject(input)) throw fail('Item-source link must be an object', 'VALIDATION');
    const isPrimary = input.is_primary === true || input.is_primary === 1 ? 1 : input.is_primary === false || input.is_primary === 0 || input.is_primary == null ? 0 : null;
    if (isPrimary === null) throw fail('is_primary must be boolean', 'VALIDATION');
    return { work_id: assertId(input.work_id, 'work_id'), source_id: assertId(input.source_id, 'source_id'), is_primary: isPrimary };
  }
  function relationRow(input, clock, idFactory) {
    if (!plainObject(input)) throw fail('Relation must be an object', 'VALIDATION');
    const from = assertId(input.from_work_id, 'from_work_id'), to = assertId(input.to_work_id, 'to_work_id');
    if (from === to) throw fail('Self-relations are not allowed', 'SELF_RELATION');
    return { relation_id: input.relation_id == null ? idFactory('wmr_') : assertId(input.relation_id, 'relation_id'),
      from_work_id: from, to_work_id: to, relation_type: enumValue(input.relation_type, 'relation_type'),
      created_at: input.created_at == null ? nowIso(clock) : timestamp(input.created_at, 'created_at') };
  }
  function parseJsonOrThrow(value, label) {
    if (value == null) return null;
    if (typeof value !== 'string') throw fail(label + ' must be JSON text or null', 'VALIDATION');
    try { JSON.parse(value); } catch (_) { throw fail(label + ' must be valid JSON', 'VALIDATION'); }
    return value;
  }
  function changeInputRow(input, clock, idFactory, defaultActorClass) {
    if (!plainObject(input)) throw fail('Change must be an object', 'VALIDATION');
    const jsonText = (field, alias) => {
      const value = own(input, field) ? input[field] : input[alias];
      if (value == null) return null;
      if (typeof value === 'string') return parseJsonOrThrow(value, field);
      let encoded;
      try { encoded = JSON.stringify(value); } catch (_) { throw fail(field + ' cannot be serialized as JSON', 'VALIDATION'); }
      if (encoded === undefined) throw fail(field + ' cannot be serialized as JSON', 'VALIDATION');
      return encoded;
    };
    return { change_id: input.change_id == null ? idFactory('wmc_') : assertId(input.change_id, 'change_id'),
      work_id: input.work_id == null ? null : validateWorkId(input.work_id).work_id,
      change_type: requiredText(input.change_type, 'change_type'),
      actor_class: requiredText(own(input, 'actor_class') ? input.actor_class : defaultActorClass, 'actor_class'),
      changed_fields_json: normalizeChangedFields(input.changed_fields_json, 'changed_fields_json'),
      before_json: jsonText('before_json', 'before'), after_json: jsonText('after_json', 'after'),
      created_at: input.created_at == null ? nowIso(clock) : timestamp(input.created_at, 'created_at') };
  }
  function dataSnapshot(db) {
    const output = { format: EXPORT_FORMAT };
    for (const table of Object.keys(TABLE_COLUMNS)) {
      const rows = dbRows(db, 'SELECT * FROM ' + table + ' ORDER BY ' + TABLE_KEYS[table].join(', '));
      if (table === 'wm_items') for (const row of rows) {
        row.thread = row.thread == null ? '' : row.thread;
        for (const key of ['summary', 'body_md']) if (row[key] === '') row[key] = null;
      }
      if (table === 'wm_changes') for (const row of rows)
        row.changed_fields_json = normalizeChangedFields(row.changed_fields_json, 'changed_fields_json');
      output[table.replace(/^wm_/, '')] = rows;
    }
    return output;
  }
  function namespaceSnapshot(db) {
    const snapshot = {};
    for (const table of Object.keys(TABLE_COLUMNS)) snapshot[table] = dbRows(db, 'SELECT * FROM ' + table + ' ORDER BY ' + TABLE_KEYS[table].join(', '));
    return snapshot;
  }
  function restoreNamespace(db, snapshot) {
    db.run('DROP TRIGGER IF EXISTS wm_items_no_hard_delete');
    db.run('DROP TRIGGER IF EXISTS wm_changes_no_update');
    db.run('DROP TRIGGER IF EXISTS wm_changes_no_delete');
    try {
      db.run('BEGIN IMMEDIATE');
      db.run('DELETE FROM wm_item_sources'); db.run('DELETE FROM wm_relations'); db.run('DELETE FROM wm_changes');
      db.run('DELETE FROM wm_items'); db.run('DELETE FROM wm_sources'); db.run('DELETE FROM wm_projects');
      db.run('DELETE FROM wm_items_fts');
      for (const table of ['wm_projects', 'wm_sources', 'wm_items', 'wm_item_sources', 'wm_relations', 'wm_changes']) {
        const columns = TABLE_COLUMNS[table];
        const sql = 'INSERT INTO ' + table + '(' + columns.join(',') + ') VALUES(' + columns.map(() => '?').join(',') + ')';
        for (const row of snapshot[table]) db.run(sql, columns.map(key => row[key] == null ? null : row[key]));
      }
      db.run('COMMIT');
    } catch (error) {
      try { db.run('ROLLBACK'); } catch (_) {}
      throw error;
    } finally {
      db.run(`CREATE TRIGGER IF NOT EXISTS wm_items_no_hard_delete BEFORE DELETE ON wm_items BEGIN
        SELECT RAISE(ABORT, 'Working Memory items are archived, not deleted'); END`);
      db.run(`CREATE TRIGGER IF NOT EXISTS wm_changes_no_update BEFORE UPDATE ON wm_changes BEGIN
        SELECT RAISE(ABORT, 'Working Memory change log is append-only'); END`);
      db.run(`CREATE TRIGGER IF NOT EXISTS wm_changes_no_delete BEFORE DELETE ON wm_changes BEGIN
        SELECT RAISE(ABORT, 'Working Memory change log is append-only'); END`);
    }
  }
  function exactKeys(row, columns, label) {
    if (!plainObject(row)) throw fail(label + ' entry must be an object', 'INVALID_EXPORT');
    const keys = Object.keys(row);
    if (keys.length !== columns.length || columns.some(key => !own(row, key)) || keys.some(key => !columns.includes(key)))
      throw fail(label + ' entry has missing or unknown fields', 'INVALID_EXPORT');
  }
  function strictProject(row, clock, idFactory) {
    exactKeys(row, TABLE_COLUMNS.wm_projects, 'project');
    assertId(row.project_id, 'project_id'); timestamp(row.created_at, 'created_at'); timestamp(row.updated_at, 'updated_at');
    const normalized = projectRow(row, clock, idFactory);
    if (normalized.code !== row.code) throw fail('Imported project code must be canonical uppercase', 'INVALID_EXPORT');
    return normalized;
  }
  function strictSource(row, clock, idFactory) {
    exactKeys(row, TABLE_COLUMNS.wm_sources, 'source');
    assertId(row.source_id, 'source_id'); timestamp(row.created_at, 'created_at'); timestamp(row.updated_at, 'updated_at');
    return sourceRow(row, clock, idFactory);
  }
  function strictItem(row, clock, idFactory) {
    exactKeys(row, ITEM_COLUMNS, 'item');
    timestamp(row.created_at, 'created_at'); timestamp(row.updated_at, 'updated_at');
    const workId = validateWorkId(row.work_id);
    if (row.status === 'RESOLVED' && (row.resolved_at == null || row.resolved_at === ''))
      throw fail('Imported RESOLVED item must preserve resolved_at', 'RESOLVED_AT_REQUIRED');
    const normalized = itemRow(row, clock, idFactory);
    if (row.non_canon !== 1 && row.non_canon !== true) throw fail('Imported item violates non_canon invariant', 'NON_CANON_INVARIANT');
    if (normalized.work_id !== workId.work_id) throw fail('Imported work_id changed during normalization', 'INVALID_WORK_ID');
    return normalized;
  }
  function strictLink(row) {
    exactKeys(row, TABLE_COLUMNS.wm_item_sources, 'item_source');
    if (row.is_primary !== 0 && row.is_primary !== 1 && row.is_primary !== true && row.is_primary !== false)
      throw fail('Imported item_source is_primary must be boolean', 'INVALID_EXPORT');
    return itemSourceRow(row);
  }
  function strictRelation(row, clock, idFactory) {
    exactKeys(row, TABLE_COLUMNS.wm_relations, 'relation');
    assertId(row.relation_id, 'relation_id'); timestamp(row.created_at, 'created_at');
    return relationRow(row, clock, idFactory);
  }
  function strictChange(row, clock, idFactory) {
    exactKeys(row, TABLE_COLUMNS.wm_changes, 'change');
    assertId(row.change_id, 'change_id'); timestamp(row.created_at, 'created_at');
    if (typeof row.actor_class !== 'string' || !row.actor_class.trim())
      throw fail('Imported change must preserve a non-empty actor_class', 'INVALID_EXPORT');
    if (typeof row.changed_fields_json !== 'string')
      throw fail('Imported change must preserve changed_fields_json', 'INVALID_EXPORT');
    let changed;
    try { changed = JSON.parse(row.changed_fields_json); } catch (_) { throw fail('Imported changed_fields_json must be valid JSON', 'INVALID_EXPORT'); }
    if (!Array.isArray(changed) || changed.some(field => typeof field !== 'string' || !field.trim()))
      throw fail('Imported changed_fields_json must be an array of field names', 'INVALID_EXPORT');
    parseJsonOrThrow(row.before_json, 'before_json'); parseJsonOrThrow(row.after_json, 'after_json');
    return changeInputRow(row, clock, idFactory, 'SYSTEM');
  }
  function rowsEqual(table, left, right) {
    return JSON.stringify(TABLE_COLUMNS[table].map(key => left[key] == null ? null : left[key])) ===
      JSON.stringify(TABLE_COLUMNS[table].map(key => right[key] == null ? null : right[key]));
  }
  function importPayload(db, input, clock, idFactory) {
    let payload = input;
    if (typeof input === 'string') { try { payload = JSON.parse(input); } catch (_) { throw fail('Import is not valid JSON', 'INVALID_EXPORT'); } }
    if (!plainObject(payload) || payload.format !== EXPORT_FORMAT) throw fail('Unsupported Working Memory export format', 'INVALID_EXPORT');
    const names = ['projects', 'sources', 'items', 'item_sources', 'relations', 'changes'];
    if (Object.keys(payload).length !== names.length + 1 || names.some(name => !Array.isArray(payload[name])) ||
        Object.keys(payload).some(key => key !== 'format' && !names.includes(key)))
      throw fail('Export must contain exactly the six Working Memory arrays', 'INVALID_EXPORT');
    const rows = {
      wm_projects: payload.projects.map(row => strictProject(row, clock, idFactory)),
      wm_sources: payload.sources.map(row => strictSource(row, clock, idFactory)),
      wm_items: payload.items.map(row => strictItem(row, clock, idFactory)),
      wm_item_sources: payload.item_sources.map(strictLink),
      wm_relations: payload.relations.map(row => strictRelation(row, clock, idFactory)),
      wm_changes: payload.changes.map(row => strictChange(row, clock, idFactory)),
    };
    const projectCodes = new Map();
    for (const project of dbRows(db, 'SELECT project_id,code FROM wm_projects')) projectCodes.set(project.project_id, project.code);
    const codesSeen = new Map();
    for (const project of rows.wm_projects) {
      const priorProject = getById(db, 'wm_projects', 'project_id', project.project_id);
      if (priorProject && priorProject.code !== project.code) throw fail('Import cannot change project code for existing project_id', 'IMPORT_CONFLICT');
      const owner = codesSeen.get(project.code);
      if (owner && owner !== project.project_id) throw fail('Duplicate project code in import: ' + project.code, 'PROJECT_CODE_CONFLICT');
      codesSeen.set(project.code, project.project_id);
      projectCodes.set(project.project_id, project.code);
    }
    const allCodes = new Map();
    for (const project of dbRows(db, 'SELECT project_id,code FROM wm_projects')) allCodes.set(project.code, project.project_id);
    for (const project of rows.wm_projects) {
      const owner = allCodes.get(project.code);
      if (owner && owner !== project.project_id) throw fail('project code already belongs to another project: ' + project.code, 'PROJECT_CODE_CONFLICT');
      allCodes.set(project.code, project.project_id);
    }
    for (const source of rows.wm_sources) {
      if (!projectCodes.has(source.project_id))
        throw fail('Source project_id does not reference an existing project: ' + source.project_id, 'INVALID_EXPORT');
    }
    for (const item of rows.wm_items) {
      const parsed = validateWorkId(item.work_id), code = projectCodes.get(item.project_id) || (getById(db, 'wm_projects', 'project_id', item.project_id) || {}).code;
      if (!code || parsed.project_code !== code) throw fail('work_id project code does not match project_id for ' + item.work_id, 'INVALID_WORK_ID');
    }
    for (const table of Object.keys(rows)) {
      const keysSeen = new Set();
      for (const row of rows[table]) {
        const key = TABLE_KEYS[table].map(k => row[k]).join('\u0000');
        if (keysSeen.has(key)) throw fail('Duplicate key inside export for ' + table, 'INVALID_EXPORT');
        keysSeen.add(key);
      }
    }
    return rows;
  }
  function existingByKey(db, table, row) {
    const keys = TABLE_KEYS[table];
    return one(db, 'SELECT * FROM ' + table + ' WHERE ' + keys.map(key => key + '=?').join(' AND '), keys.map(key => row[key]));
  }
  function insertRow(db, table, row) {
    const columns = TABLE_COLUMNS[table];
    db.run('INSERT INTO ' + table + '(' + columns.join(',') + ') VALUES(' + columns.map(() => '?').join(',') + ')', columns.map(key => row[key] == null ? null : row[key]));
  }
  function errorResult(error, extra) {
    return result(false, Object.assign({ saved: false, code: error && error.code || 'WM_WRITE_FAILED', error: error && error.message || String(error) }, extra || {}));
  }

  function create(db, options) {
    options = options || {};
    initSchema(db);
    const clock = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
    const idFactory = typeof options.idFactory === 'function' ? options.idFactory : generateId;
    const actorClass = requiredText(options.actorClass == null ? 'SYSTEM' : options.actorClass, 'actorClass');
    const persist = typeof options.persist === 'function' ? options.persist :
      (root && typeof root._wizSaveDBAsync === 'function' ? () => root._wizSaveDBAsync() : null);
    let poisoned = false;

    function durableMutation(operation) {
      const run = async () => {
        if (poisoned) return errorResult(fail('Working Memory persistence is uncertain; reload before writing', 'PERSISTENCE_UNCERTAIN'));
        const before = namespaceSnapshot(db);
        try { db.run('BEGIN IMMEDIATE'); }
        catch (error) { return errorResult(error); }
        let value;
        try {
          value = operation();
          db.run('COMMIT');
        } catch (error) {
          try { db.run('ROLLBACK'); } catch (_) {}
          return errorResult(error);
        }
        if (value && value.__workingMemoryNoop) return result(true, { noOp: true, data: value.data });
        try {
          if (typeof persist !== 'function') throw fail('Durable persistence callback is required', 'PERSISTENCE_UNAVAILABLE');
          const acknowledgement = await persist();
          if (!acknowledgement || acknowledgement.verified !== true) throw fail('Durable save was not verified by read-back', 'PERSISTENCE_UNVERIFIED');
          return result(true, { data: value, persistence: acknowledgement });
        } catch (error) {
          let rollbackDurable = false;
          try {
            restoreNamespace(db, before);
            if (typeof persist === 'function') {
              const rollbackAck = await persist();
              rollbackDurable = !!rollbackAck && rollbackAck.verified === true;
            }
          } catch (_) { rollbackDurable = false; }
          if (!rollbackDurable) poisoned = true;
          return errorResult(error, { rolledBack: true, rollbackDurable, persistenceState: rollbackDurable ? 'RESTORED' : 'UNKNOWN' });
        }
      };
      const prior = WRITE_QUEUES.get(db) || Promise.resolve();
      const next = prior.then(run, run);
      WRITE_QUEUES.set(db, next.then(() => undefined, () => undefined));
      return next;
    }

    function createProject(input) {
      return durableMutation(() => {
        const row = projectRow(input, clock, idFactory);
        if (getById(db, 'wm_projects', 'project_id', row.project_id)) throw fail('project_id already exists: ' + row.project_id, 'ID_CONFLICT');
        if (one(db, 'SELECT project_id FROM wm_projects WHERE code=?', [row.code])) throw fail('code already exists: ' + row.code, 'PROJECT_CODE_CONFLICT');
        insertRow(db, 'wm_projects', row); changeRow(db, clock, idFactory, null, 'CREATE_PROJECT', null, row, actorClass);
        return row;
      });
    }
    function createSource(input) {
      return durableMutation(() => {
        const row = sourceRow(input, clock, idFactory); assertProjectExists(db, row.project_id);
        if (getById(db, 'wm_sources', 'source_id', row.source_id)) throw fail('source_id already exists: ' + row.source_id, 'ID_CONFLICT');
        insertRow(db, 'wm_sources', row); changeRow(db, clock, idFactory, null, 'CREATE_SOURCE', null, row, actorClass);
        return row;
      });
    }
    function createItem(input) {
      return durableMutation(() => {
        if (!plainObject(input)) throw fail('Item must be an object', 'VALIDATION');
        if (own(input, 'work_id')) throw fail('work_id is generated automatically and immutable', 'WORK_ID_IMMUTABLE');
        const projectId = requiredText(input.project_id, 'project_id'); assertProjectExists(db, projectId);
        const project = getById(db, 'wm_projects', 'project_id', projectId);
        const row = itemRow(input, clock, idFactory, nextWorkId(db, project.code, nowIso(clock)));
        if (getById(db, 'wm_items', 'work_id', row.work_id)) throw fail('generated work_id already exists: ' + row.work_id, 'ID_CONFLICT');
        insertRow(db, 'wm_items', row); changeRow(db, clock, idFactory, row.work_id, 'CREATE_ITEM', null, row, actorClass);
        return row;
      });
    }
    function updateItem(workId, patch) {
      return durableMutation(() => {
        const id = assertId(workId, 'work_id');
        if (!plainObject(patch)) throw fail('Item patch must be an object', 'VALIDATION');
        if (own(patch, 'project_id')) throw fail('project_id is immutable after Work Item creation', 'PROJECT_ID_IMMUTABLE');
        for (const key of ['work_id', 'created_at', 'non_canon', 'archived_at']) if (own(patch, key))
          throw fail(key + ' is immutable through updateItem', key === 'non_canon' ? 'NON_CANON_INVARIANT' : 'VALIDATION');
        const mutableFields = new Set(['thread','type','status','priority','title','summary','body_md',
          'current_question','status_note','next_action','provenance_class','tags_json','tags','resolved_at']);
        for (const key of Object.keys(patch)) if (!mutableFields.has(key)) throw fail('Unknown item field: ' + key, 'VALIDATION');
        const before = getById(db, 'wm_items', 'work_id', id);
        if (!before) throw fail('Unknown work_id: ' + id, 'NOT_FOUND');
        const merged = Object.assign({}, before, patch, { work_id: id, created_at: before.created_at, non_canon: 1 });
        if (own(patch, 'tags')) merged.tags_json = patch.tags;
        if (patch.status === 'RESOLVED' && !patch.resolved_at && !before.resolved_at) merged.resolved_at = nowIso(clock);
        const after = itemRow(merged, clock, idFactory); after.updated_at = nowIso(clock);
        assertProjectExists(db, after.project_id);
        if (rowsEqual('wm_items', before, after)) return { __workingMemoryNoop: true, data: before };
        const columns = ITEM_COLUMNS.filter(key => key !== 'work_id');
        db.run('UPDATE wm_items SET ' + columns.map(key => key + '=?').join(',') + ' WHERE work_id=?', columns.map(key => after[key]).concat([id]));
        changeRow(db, clock, idFactory, id, 'UPDATE_ITEM', before, after, actorClass);
        return after;
      });
    }
    function archiveItem(workId) {
      return durableMutation(() => {
        const id = assertId(workId, 'work_id'), before = getById(db, 'wm_items', 'work_id', id);
        if (!before) throw fail('Unknown work_id: ' + id, 'NOT_FOUND');
        if (before.archived_at) return { __workingMemoryNoop: true, data: before };
        const after = Object.assign({}, before, { archived_at: nowIso(clock) });
        db.run('UPDATE wm_items SET archived_at=? WHERE work_id=?', [after.archived_at, id]);
        changeRow(db, clock, idFactory, id, 'ARCHIVE_ITEM', before, after, actorClass, ['archived_at']);
        return after;
      });
    }
    function addItemSource(input) {
      return durableMutation(() => {
        const link = itemSourceRow(input); assertItemExists(db, link.work_id); assertSourceExists(db, link.source_id);
        const before = one(db, 'SELECT * FROM wm_item_sources WHERE work_id=? AND source_id=?', [link.work_id, link.source_id]);
        if (before && before.is_primary === link.is_primary) return { __workingMemoryNoop: true, data: before };
        if (link.is_primary) db.run('UPDATE wm_item_sources SET is_primary=0 WHERE work_id=? AND is_primary=1', [link.work_id]);
        if (before) db.run('UPDATE wm_item_sources SET is_primary=? WHERE work_id=? AND source_id=?', [link.is_primary, link.work_id, link.source_id]);
        else insertRow(db, 'wm_item_sources', link);
        const after = one(db, 'SELECT * FROM wm_item_sources WHERE work_id=? AND source_id=?', [link.work_id, link.source_id]);
        changeRow(db, clock, idFactory, link.work_id, 'LINK_SOURCE', before, after, actorClass);
        return after;
      });
    }
    function addRelation(input) {
      return durableMutation(() => {
        const row = relationRow(input, clock, idFactory); assertItemExists(db, row.from_work_id); assertItemExists(db, row.to_work_id);
        if (getById(db, 'wm_relations', 'relation_id', row.relation_id)) throw fail('relation_id already exists: ' + row.relation_id, 'ID_CONFLICT');
        insertRow(db, 'wm_relations', row); changeRow(db, clock, idFactory, row.from_work_id, 'ADD_RELATION', null, row, actorClass);
        return row;
      });
    }
    function appendChange(input) {
      return durableMutation(() => {
        const row = changeInputRow(input, clock, idFactory, actorClass);
        if (row.work_id) assertItemExists(db, row.work_id);
        if (getById(db, 'wm_changes', 'change_id', row.change_id)) throw fail('change_id already exists: ' + row.change_id, 'ID_CONFLICT');
        insertRow(db, 'wm_changes', row);
        return row;
      });
    }
    function searchItems(query, limit, searchOptions) {
      if (typeof query !== 'string' || !query.trim()) return [];
      const needle = query.trim(), folded = needle.toLowerCase();
      const max = Math.max(1, Math.min(100, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 20));
      const includeArchived = !!(searchOptions && searchOptions.includeArchived);
      // Optional project scope is applied to the candidate set BEFORE ranking and LIMIT.
      const projectId = searchOptions && searchOptions.project_id ? String(searchOptions.project_id) : null;
      const where = [];
      const params = [];
      if (!includeArchived) where.push('archived_at IS NULL');
      if (projectId) { where.push('project_id=?'); params.push(projectId); }
      const candidates = dbRows(db, 'SELECT * FROM wm_items' + (where.length ? ' WHERE ' + where.join(' AND ') : ''), params);
      const matches = [];
      for (const item of candidates) {
        const title = (item.title || '').toLowerCase();
        const summary = (item.summary || '').toLowerCase();
        const body = (item.body_md || '').toLowerCase();
        let rank = Infinity;
        if (item.work_id === needle) rank = 1;
        else if (title === folded) rank = 2;
        else if (title.includes(folded)) rank = 3;
        else {
          let tags = [];
          try { tags = JSON.parse(item.tags_json || '[]'); } catch (_) {}
          if (tags.some(tag => typeof tag === 'string' && tag.toLowerCase() === folded)) rank = 4;
          else if (summary.includes(folded)) rank = 5;
          else if (body.includes(folded)) rank = 6;
        }
        if (rank !== Infinity) matches.push({ item, rank });
      }
      matches.sort((a, b) => a.rank - b.rank || (a.item.title < b.item.title ? -1 : a.item.title > b.item.title ? 1 : 0) ||
        (a.item.work_id < b.item.work_id ? -1 : a.item.work_id > b.item.work_id ? 1 : 0));
      return matches.slice(0, max).map(entry => entry.item);
    }
    function listItems(filters) {
      filters = filters || {};
      let sql = 'SELECT * FROM wm_items WHERE 1=1', params = [];
      if (!filters.includeArchived) sql += ' AND archived_at IS NULL';
      if (filters.project_id) { sql += ' AND project_id=?'; params.push(filters.project_id); }
      if (filters.status) { sql += ' AND status=?'; params.push(enumValue(filters.status, 'status')); }
      if (filters.type) { sql += ' AND type=?'; params.push(enumValue(filters.type, 'type')); }
      if (filters.priority) { sql += ' AND priority=?'; params.push(enumValue(filters.priority, 'priority')); }
      if (filters.thread != null && filters.thread !== '') { sql += ' AND thread=?'; params.push(String(filters.thread)); }
      sql += ' ORDER BY updated_at DESC, work_id ASC';
      if (filters.limit != null) { const limit = Math.max(1, Math.min(100, Math.floor(Number(filters.limit) || 20))); sql += ' LIMIT ?'; params.push(limit); }
      return dbRows(db, sql, params);
    }
    function listUnresolved(filters) {
      filters = filters || {};
      let sql = "SELECT * FROM wm_items WHERE archived_at IS NULL AND status IN ('OPEN','IN_PROGRESS','BLOCKED','UNKNOWN')", params = [];
      if (filters.project_id) { sql += ' AND project_id=?'; params.push(filters.project_id); }
      sql += ' ORDER BY updated_at DESC, work_id ASC';
      if (filters.limit != null) { sql += ' LIMIT ?'; params.push(Math.max(1, Math.min(100, Math.floor(Number(filters.limit) || 20)))); }
      return dbRows(db, sql, params);
    }
    function listResolved(filters) {
      filters = filters || {};
      let sql = "SELECT * FROM wm_items WHERE archived_at IS NULL AND status='RESOLVED'", params = [];
      if (filters.project_id) { sql += ' AND project_id=?'; params.push(filters.project_id); }
      sql += ' ORDER BY resolved_at DESC, work_id ASC';
      if (filters.limit != null) { sql += ' LIMIT ?'; params.push(Math.max(1, Math.min(100, Math.floor(Number(filters.limit) || 20)))); }
      return dbRows(db, sql, params);
    }
    function listCompleted(filters) {
      filters = filters || {};
      let sql = "SELECT * FROM wm_items WHERE archived_at IS NULL AND status='COMPLETED'", params = [];
      if (filters.project_id) { sql += ' AND project_id=?'; params.push(filters.project_id); }
      sql += ' ORDER BY updated_at DESC, work_id ASC';
      if (filters.limit != null) { sql += ' LIMIT ?'; params.push(Math.max(1, Math.min(100, Math.floor(Number(filters.limit) || 20)))); }
      return dbRows(db, sql, params);
    }
    // Read-only accessors for the agent read bridge (B1). No mutation, no inference.
    function listProjects() { return dbRows(db, 'SELECT * FROM wm_projects ORDER BY code ASC, project_id ASC'); }
    function listSources(projectId) {
      return dbRows(db, 'SELECT * FROM wm_sources WHERE project_id=? ORDER BY role ASC, title ASC, source_id ASC', [assertId(projectId, 'project_id')]);
    }
    function listItemSources(workId) {
      return dbRows(db, `SELECT s.*, l.is_primary AS is_primary FROM wm_item_sources l JOIN wm_sources s ON s.source_id=l.source_id
        WHERE l.work_id=? ORDER BY l.is_primary DESC, s.source_id ASC`, [assertId(workId, 'work_id')]);
    }
    function listRelations(workId) {
      const id = assertId(workId, 'work_id');
      return dbRows(db, 'SELECT * FROM wm_relations WHERE from_work_id=? OR to_work_id=? ORDER BY created_at ASC, relation_id ASC', [id, id]);
    }
    function getItem(workId) { return getById(db, 'wm_items', 'work_id', assertId(workId, 'work_id')); }
    function listChanges(workId) {
      return workId ? dbRows(db, 'SELECT * FROM wm_changes WHERE work_id=? ORDER BY created_at ASC, change_id ASC', [assertId(workId, 'work_id')])
        : dbRows(db, 'SELECT * FROM wm_changes ORDER BY created_at ASC, change_id ASC');
    }
    function exportData() { return dataSnapshot(db); }
    function exportJSON() { return JSON.stringify(exportData(), null, 2) + '\n'; }
    function importJSON(input) {
      return durableMutation(() => {
        const rows = importPayload(db, input, clock, idFactory);
        const counts = { imported: 0, unchanged: 0 };
        for (const table of ['wm_projects', 'wm_sources', 'wm_items', 'wm_item_sources', 'wm_relations', 'wm_changes']) {
          for (const row of rows[table]) {
            if (table === 'wm_sources') assertProjectExists(db, row.project_id);
            if (table === 'wm_items') assertProjectExists(db, row.project_id);
            if (table === 'wm_item_sources') { assertItemExists(db, row.work_id); assertSourceExists(db, row.source_id); }
            if (table === 'wm_relations') { assertItemExists(db, row.from_work_id); assertItemExists(db, row.to_work_id); }
            if (table === 'wm_changes' && row.work_id) assertItemExists(db, row.work_id);
            const prior = existingByKey(db, table, row);
            if (prior) {
              if (!rowsEqual(table, prior, row)) throw fail('Import conflict in ' + table + ' for ' + TABLE_KEYS[table].map(key => row[key]).join('/'), 'IMPORT_CONFLICT');
              counts.unchanged++;
            } else {
              insertRow(db, table, row); counts.imported++;
            }
          }
        }
        if (counts.imported === 0) return { __workingMemoryNoop: true, data: Object.assign({ noOp: true }, counts) };
        return Object.assign({ noOp: false }, counts);
      });
    }

    return Object.freeze({
      createProject, createSource, createItem, updateItem, archiveItem, addItemSource, addRelation, appendChange,
      getItem, listItems, listProjects, listSources, listItemSources, listRelations, searchItems, listUnresolved, listResolved, listCompleted, listChanges,
      exportData, exportJSON, importJSON,
    });
  }

  return Object.freeze({
    EXPORT_FORMAT, MULTI_TAB_WRITES, ENUMS, UNRESOLVED_STATUSES, ITEM_COLUMNS, TABLE_COLUMNS,
    initSchema, create,
  });
});
