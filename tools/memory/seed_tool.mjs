#!/usr/bin/env node
// seed_tool.mjs — orientation-seed tooling for the Ruslan Orientation Passport (no dependencies).
//
//   node tools/memory/seed_tool.mjs validate [seed.json]
//   node tools/memory/seed_tool.mjs stats [seed.json]
//   node tools/memory/seed_tool.mjs render-start-view [seed.json] [--out docs/memory/CURRENT_ORIENTATION.md]
//   node tools/memory/seed_tool.mjs search "<query>" [--k 5] [--json] [--seed seed.json]
//   node tools/memory/seed_tool.mjs export-lab [seed.json] [--out file.private.jsonl] [--locators private-memory/source-locators.private.json]
//   node tools/memory/seed_tool.mjs export-context --format json|md [--out <path>] [--seed seed.json] [--manifest manifest.json]
//
// M2: команда export-context строит провайдер-нейтральный ориентационный пакет
// eiti-context-bootstrap/1 только из канона + манифеста. Без сети, моделей, эмбеддингов.
// Retrieval is LOCAL and DETERMINISTIC (RU+EN keyword scoring + a small, documented intent lexicon).
// No model / LLM / embedding calls. export-lab writes the EXISTING Lab import format `wiz-ref-jsonl/1`
// (docs/REFERENCE_MEMORY.md §3), to be imported manually via Memory → 📖 Reference memory → Import JSONL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_SEED = path.join(ROOT, 'docs', 'memory', 'ruslan-orientation-seed.json');
// Путь к манифесту носителя непрерывности (М1). Ворота целостности М2 читают его, но не меняют.
export const DEFAULT_MANIFEST = path.join(ROOT, 'docs', 'memory', 'manifest.json');

export const TYPES = ['USER_IDENTITY', 'USER_GOAL', 'USER_MOTIVATION', 'CURRENT_PRIORITY', 'ACTIVE_THREAD', 'RESEARCH_RESULT',
  'OPEN_QUESTION', 'KNOWN_LIMITATION', 'PROJECT_POINTER', 'SOURCE_POINTER', 'INVARIANT', 'DEFERRED_ITEM', 'NEXT_ACTION'];
export const STATUSES = ['CURRENT', 'OPEN', 'UNKNOWN', 'HYPOTHESIS', 'RESEARCH_RESULT', 'ENGINEERING_RESULT', 'HISTORICAL', 'SUPERSEDED', 'DEFERRED'];
export const PROVENANCE = ['USER_STATEMENT_2026-09-29', 'USER_RAW', 'SOURCE_DOC', 'AI_SUMMARY'];
export const RELS = ['MOTIVATED_BY', 'IMPLEMENTED_BY_PROJECT', 'INVESTIGATES', 'RELATED_TO', 'SUPPORTS', 'DOES_NOT_ESTABLISH',
  'USES_SOURCE', 'NEXT_ACTION', 'SUPERSEDED_BY'];
const REQUIRED = ['id', 'type', 'statement', 'status', 'source', 'source_kind', 'scope', 'provenance', 'valid_from', 'updated_at', 'details_pointer', 'relations'];

export function loadSeed(p = DEFAULT_SEED) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// ── validate ───────────────────────────────────────────────────────────────
export function validate(seed) {
  const errors = [], warnings = [];
  const recs = Array.isArray(seed && seed.records) ? seed.records : null;
  if (!recs) return { ok: false, errors: ['seed.records missing'], warnings };
  const srcs = new Map((seed.sources || []).map(s => [s.alias, s]));
  const ids = new Map();
  for (const r of recs) {
    const at = `record ${r && r.id ? r.id : '(no id)'}`;
    for (const f of REQUIRED) if (r[f] === undefined || r[f] === null || r[f] === '') errors.push(`${at}: missing ${f}`);
    if (ids.has(r.id)) errors.push(`${at}: duplicate id`);
    ids.set(r.id, r);
    if (!TYPES.includes(r.type)) errors.push(`${at}: unknown type ${r.type}`);
    if (!STATUSES.includes(r.status)) errors.push(`${at}: unknown status ${r.status}`);
    if (!PROVENANCE.includes(r.provenance)) errors.push(`${at}: unknown provenance ${r.provenance}`);
    const s = srcs.get(r.source);
    if (!s) errors.push(`${at}: source alias ${r.source} not in seed.sources`);
    else if (s.kind !== r.source_kind) errors.push(`${at}: source_kind ${r.source_kind} != source ${s.alias} kind ${s.kind}`);
    if (r.provenance === 'USER_STATEMENT_2026-09-29' && s && s.kind !== 'USER_STATEMENT') errors.push(`${at}: USER_STATEMENT provenance requires the user-statement source`);
    if (s && s.kind === 'USER_STATEMENT' && !['USER_STATEMENT_2026-09-29'].includes(r.provenance)) warnings.push(`${at}: user-statement source with provenance ${r.provenance}`);
    if (r.status === 'SUPERSEDED' && !r.superseded_by) errors.push(`${at}: SUPERSEDED without superseded_by`);
    if (typeof r.statement === 'string' && r.statement.length > 420) warnings.push(`${at}: statement longer than 420 chars`);
    if (!Array.isArray(r.relations)) errors.push(`${at}: relations must be an array`);
  }
  for (const r of recs) {
    const at = `record ${r.id}`;
    for (const rel of r.relations || []) {
      if (!RELS.includes(rel.rel)) errors.push(`${at}: relation ${rel.rel} not allowed`);
      if (!ids.has(rel.target)) errors.push(`${at}: relation target ${rel.target} does not exist`);
      if (rel.target === r.id) errors.push(`${at}: self relation`);
    }
    for (const t of r.related_to || []) if (!ids.has(t)) errors.push(`${at}: related_to ${t} does not exist`);
    for (const f of ['supersedes', 'superseded_by']) if (r[f] && !ids.has(r[f])) errors.push(`${at}: ${f} ${r[f]} does not exist`);
    if (r.superseded_by) {
      const n = ids.get(r.superseded_by);
      if (n && n.supersedes !== r.id) errors.push(`${at}: superseded_by ${r.superseded_by} but that record does not declare supersedes=${r.id}`);
      if (r.status !== 'SUPERSEDED') errors.push(`${at}: has superseded_by but status ${r.status}`);
    }
    if (r.supersedes) { const o = ids.get(r.supersedes); if (o && o.superseded_by !== r.id) errors.push(`${at}: supersedes ${r.supersedes} but it is not superseded_by ${r.id}`); }
  }
  return { ok: errors.length === 0, errors, warnings, records: recs.length };
}

export function stats(seed) {
  const by = k => seed.records.reduce((m, r) => (m[r[k]] = (m[r[k]] || 0) + 1, m), {});
  const rels = {};
  for (const r of seed.records) for (const x of r.relations || []) rels[x.rel] = (rels[x.rel] || 0) + 1;
  const sort = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  return { records: seed.records.length, relations: Object.values(rels).reduce((a, b) => a + b, 0),
    by_type: sort(by('type')), by_status: sort(by('status')), by_provenance: sort(by('provenance')), by_rel: sort(rels) };
}

// ── search (local, deterministic) ──────────────────────────────────────────
const STOP = new Set(('и в во на с со что это как или но не за от до по к из у о об же ли бы он она они мы я ты его ее их ' +
  'чем чего такой такая такое является есть был была были мой моя мое мои the a an of to is are and or what who how in on for with').split(' '));
const RU_SUFFIXES = ['иями', 'ями', 'ами', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ией', 'иях', 'ешь', 'ах', 'ях', 'ую', 'юю', 'ая', 'яя',
  'ое', 'ее', 'ые', 'ие', 'ий', 'ый', 'ой', 'ей', 'ом', 'ем', 'ам', 'ям', 'ов', 'ев', 'ым', 'им', 'ью', 'ть', 'ет', 'ют', 'ут', 'ит', 'ят',
  'ал', 'ил', 'ла', 'ло', 'ли', 'но', 'на', 'ны', 'а', 'я', 'о', 'е', 'ы', 'и', 'у', 'ю', 'ь', 'й'];
export function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
export function stem(w) {
  if (/^[а-я]+$/.test(w)) {
    if (w.length > 5 && /(ся|сь)$/.test(w)) w = w.slice(0, -2);
    for (const suf of RU_SUFFIXES) if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length);
    return w;
  }
  if (/^[a-z]+$/.test(w) && w.length > 4) return w.replace(/(ing|ed|es|s)$/, '');
  return w;
}
export function tokens(text) {
  const out = [];
  for (const m of norm(text).matchAll(/[a-zа-я0-9]+(?:[-_][a-zа-я0-9]+)*/g)) {
    const t = m[0];
    const parts = t.split(/[-_]/);
    if (parts.length > 1) out.push(t);
    for (const p of parts) if (p.length >= 2 && !STOP.has(p)) out.push(stem(p));
  }
  return out;
}
// Intent lexicon: question cues → record-type boosts. Generic, documented, deterministic.
export const INTENTS = [
  { cue: /(^|\s)кто(\s|$)|\bwho\b/, boost: { USER_IDENTITY: 2.0 } },
  { cue: /хоч|хотел|стремит|\bwant|\bgoal/, boost: { USER_GOAL: 1.5 } },
  { cue: /почему|зачем|\bwhy\b|мотив/, boost: { USER_MOTIVATION: 1.5, USER_GOAL: 0.5 } },
  { cue: /сейчас|текущ|\bnow\b|\bcurrent/, status: { CURRENT: 0.5 }, boost: { CURRENT_PRIORITY: 0.5 } },
  { cue: /открыт|остает|неизвест|нерешен|\bopen\b|\bunknown\b|unresolved/, boost: { OPEN_QUESTION: 2.0, KNOWN_LIMITATION: 0.5 } },
  { cue: /сделан|уже |достигнут|установлен|\bdone\b|achiev|establish/, boost: { RESEARCH_RESULT: 1.5, KNOWN_LIMITATION: 0.3 } },
  { cue: /куда смотреть|где смотреть|где искать|где найти|источник|where to look|\bsource/, boost: { SOURCE_POINTER: 2.5 } },
  { cue: /отлича|разниц|differ/, boost: { KNOWN_LIMITATION: 0.5, INVARIANT: 0.3 } },
  { cue: /следующ|дальше|\bnext\b/, boost: { NEXT_ACTION: 1.5 } },
];
function recordIndex(r) {
  const main = new Set(tokens(r.statement));
  const kw = new Set(tokens(r.keywords || ''));
  const meta = new Set(tokens([r.id, r.type, r.status].join(' ')));
  return { r, main, kw, meta, all: new Set([...main, ...kw, ...meta]) };
}
export function search(seed, query, { k = 5, minRatio = 0.4 } = {}) {
  const idx = seed.records.map(recordIndex);
  const N = idx.length;
  const df = new Map();
  for (const d of idx) for (const t of d.all) df.set(t, (df.get(t) || 0) + 1);
  const q = [...new Set(tokens(query))];
  const nq = norm(query);
  const intents = INTENTS.filter(i => i.cue.test(nq));
  const scored = idx.map(d => {
    let lex = 0; const hits = [];
    for (const t of q) {
      const idf = Math.log(1 + N / (1 + (df.get(t) || 0)));
      let w = 0;
      if (d.main.has(t) || d.kw.has(t)) w = 1;
      else if (d.meta.has(t)) w = 0.5;
      else if (t.length >= 5 && [...d.all].some(x => x.length >= 5 && (x.startsWith(t) || t.startsWith(x)))) w = 0.6;
      if (w) { lex += w * idf; hits.push(t); }
    }
    let boost = 0;
    for (const i of intents) { boost += (i.boost && i.boost[d.r.type]) || 0; boost += (i.status && i.status[d.r.status]) || 0; }
    let score = lex > 0 ? lex + boost : 0;
    if (d.r.status === 'SUPERSEDED') score *= 0.5;
    return { id: d.r.id, type: d.r.type, status: d.r.status, source: d.r.source, score: Math.round(score * 1000) / 1000, hits, statement: d.r.statement };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  if (!scored.length) return [];
  const top = scored[0].score;
  return scored.filter(x => x.score >= minRatio * top).slice(0, k);
}

// ── М2: общий детерминированный селектор ориентации ─────────────────────────
// Правило отбора: фильтр по типу + исключение HISTORICAL/SUPERSEDED.
// Порядок внутри каждой секции — порядок канона (seed records), детерминирован.
// SUPERSEDED не выдаются за текущее; HISTORICAL не продвигаются;
// DEFERRED остаются DEFERRED; UNKNOWN остаются UNKNOWN.
// Селектор используют и render-start-view, и export-context (один источник отбора).
export function selectBootstrapSections(seed) {
  const R = Array.isArray(seed && seed.records) ? seed.records : [];
  // Исключаем историю из текущих секций, остальное сохраняем дословно.
  const isCurrent = (r) => r.status !== 'HISTORICAL' && r.status !== 'SUPERSEDED';
  const byTypes = (...types) => R.filter((r) => types.includes(r.type) && isCurrent(r));
  // NEXT_ACTION идут первыми, затем явные DEFERRED_ITEM (оба в порядке канона).
  const nextCombined = [...R.filter((r) => r.type === 'NEXT_ACTION' && isCurrent(r)),
    ...R.filter((r) => r.type === 'DEFERRED_ITEM' && isCurrent(r))];
  return {
    who: byTypes('USER_IDENTITY'),
    north_star: byTypes('USER_GOAL', 'USER_MOTIVATION'),
    current_priority: byTypes('CURRENT_PRIORITY'),
    active_threads: byTypes('ACTIVE_THREAD'),
    known: byTypes('RESEARCH_RESULT'),
    known_limitations: byTypes('KNOWN_LIMITATION'),
    open: byTypes('OPEN_QUESTION'),
    next: nextCombined,
    projects: byTypes('PROJECT_POINTER'),
    sources: byTypes('SOURCE_POINTER'),
    invariants: byTypes('INVARIANT'),
  };
}

// Проекция записи канона в пакет: только 9 сохраняемых полей, дословно.
// Связи/keywords/certainty не включаем: связи нарисованы ИИ (см. relations_note),
// keywords — локальный поисковый индекс, а не часть схемы.
export function projectRecord(r) {
  return { id: r.id, type: r.type, status: r.status, statement: r.statement, source: r.source,
    provenance: r.provenance, scope: r.scope, updated_at: r.updated_at, details_pointer: r.details_pointer };
}

// ── render-start-view (deterministic) ──────────────────────────────────────
function tag(r) { return `\`${r.id} · ${r.status} · ${r.source}\``; }
function line(r) { return `- ${r.statement} ${tag(r)}`; }
export function renderStartView(seed) {
  const sec = selectBootstrapSections(seed);
  const S = new Map((seed.sources || []).map(s => [s.alias, s]));
  const out = [];
  out.push('# CURRENT ORIENTATION — Руслан / Velantrim');
  out.push('');
  out.push(`> Сгенерировано детерминированно из \`docs/memory/ruslan-orientation-seed.json\` (seed ${seed.seed_version}, as of ${seed.as_of}) командой \`node tools/memory/seed_tool.mjs render-start-view\`. Не редактировать вручную.`);
  out.push('> ORIENTATION, не архитектурный authority. Теги: `id · status · source`. ' + seed.principle);
  out.push('');
  out.push('## WHO');
  sec.who.forEach(r => out.push(line(r)));
  out.push('');
  out.push('## NORTH STAR');
  sec.north_star.filter(r => r.type === 'USER_GOAL').forEach(r => out.push(line(r)));
  sec.north_star.filter(r => r.type === 'USER_MOTIVATION' && /USER_MOTIVATION, НЕ/.test(r.statement)).forEach(r => out.push(line(r)));
  out.push('');
  out.push('## CURRENT PRIORITY');
  sec.north_star.filter(r => r.type === 'USER_MOTIVATION' && !/USER_MOTIVATION, НЕ/.test(r.statement)).forEach(r => out.push(line(r)));
  sec.current_priority.forEach(r => out.push(line(r)));
  sec.invariants.filter(r => r.id === 'INV-06').forEach(r => out.push(line(r)));
  out.push('');
  out.push('## ACTIVE THREAD');
  sec.active_threads.filter(r => r.status === 'CURRENT').forEach(r => out.push(line(r)));
  sec.known_limitations.filter(r => r.id.startsWith('KL-HAP')).forEach(r => out.push(line(r)));
  const unk = sec.active_threads.filter(r => r.status === 'UNKNOWN');
  if (unk.length) { out.push('- Линии из источников, актуальность которых сегодня НЕ подтверждена (STORED != CURRENT):'); unk.forEach(r => out.push('  ' + line(r))); }
  out.push('');
  out.push('## KNOWN');
  sec.known.forEach(r => out.push(line(r)));
  sec.known_limitations.filter(r => !r.id.startsWith('KL-HAP')).forEach(r => out.push(line(r)));
  out.push('');
  out.push('## OPEN');
  sec.open.forEach(r => out.push(line(r)));
  out.push('');
  out.push('## NEXT');
  sec.next.filter(r => r.type === 'NEXT_ACTION').forEach(r => out.push(line(r)));
  out.push('- Отложено (не начинать без явного GO): ' + sec.next.filter(r => r.type === 'DEFERRED_ITEM').map(r => `\`${r.id}\``).join(', ') + ' — см. seed.');
  out.push('');
  out.push('## DETAILS (detail on demand)');
  sec.sources.forEach(r => {
    const s = S.get(r.source);
    out.push(`- ${r.statement} ${tag(r)}${s ? ` — reachable: ${s.reachable}` : ''}`);
  });
  out.push('- Проекты: ' + sec.projects.map(r => r.statement.split(' — ')[0] + ` (\`${r.id}\`)`).join(' · ') + ' — роли в паспорте §10 / seed.');
  out.push('- Правила чтения (verbatim): ' + sec.invariants.filter(r => /^INV-0[1-4]$/.test(r.id)).map(r => r.statement).join('; '));
  out.push('');
  return out.join('\n');
}
export function wordCount(md) { return (md.match(/[\p{L}\p{N}][\p{L}\p{N}_'’-]*/gu) || []).length; }

// ── export-lab: projection into the EXISTING wiz-ref-jsonl/1 import format ──
export const ITEM_TYPE_MAP = { RESEARCH_RESULT: 'RESEARCH_RESULT', OPEN_QUESTION: 'OPEN_QUESTION', PROJECT_POINTER: 'PROJECT_ROLE',
  SOURCE_POINTER: 'ROUTE', INVARIANT: 'INVARIANT', NEXT_ACTION: 'NEXT_ACTION' };
export const REL_MAP = { MOTIVATED_BY: 'RELATED_TO', IMPLEMENTED_BY_PROJECT: 'RELATED_TO', INVESTIGATES: 'RELATED_TO', RELATED_TO: 'RELATED_TO',
  SUPPORTS: 'SUPPORTS', DOES_NOT_ESTABLISH: 'RELATED_TO', USES_SOURCE: 'DOCUMENTED_IN', NEXT_ACTION: 'RELATED_TO', SUPERSEDED_BY: null /* via supersedes_item_id */ };
const EPI = { 'USER_STATEMENT_2026-09-29': 'USER_STATEMENT', USER_RAW: 'USER_RAW', SOURCE_DOC: 'SOURCE_ASSERTION', AI_SUMMARY: 'AI_SUMMARY' };
export function labItemType(r, src) {
  if (src.authority_class === 'HUMAN_REFERENCE_ONLY') return 'HUMAN_LENS'; // importer guard: such sources may carry only HUMAN_LENS
  if (r.type === 'RESEARCH_RESULT' && r.status === 'ENGINEERING_RESULT') return 'VALIDATION_RESULT';
  if (ITEM_TYPE_MAP[r.type]) return ITEM_TYPE_MAP[r.type];
  if (r.status === 'HISTORICAL' || r.status === 'SUPERSEDED') return 'HISTORICAL_NOTE';
  if (r.status === 'HYPOTHESIS') return 'HYPOTHESIS';
  return 'UNKNOWN'; // no equivalent wiz_ref item_type; seed type kept in claim prefix + source_section
}
function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
export function exportLab(seed, locators = {}) {
  const lines = [];
  const src = new Map(seed.sources.map(s => [s.alias, s]));
  const srcObj = a => {
    const s = src.get(a);
    const isGh = s.surface === 'github';
    return { source_id: 'passport:src:' + a, title: s.title, surface: s.surface, source_kind: s.export_kind, authority_class: s.authority_class,
      project_id: 'ruslan-orientation', locator: locators[a] || s.public_locator || ('alias:' + a), revision: isGh ? (s.title.match(/\(([0-9a-f]{7,40})\)/) || [])[1] || null : null,
      as_of: String(s.fetched_at).slice(0, 10), currentness: s.currentness, privacy: isGh ? 'public' : 'private', content_hash: null };
  };
  lines.push({ manifest: { format: 'wiz-ref-jsonl/1', seed_id: seed.seed_id, seed_version: seed.seed_version, seed_as_of: seed.as_of, privacy: 'private',
    note: 'Ruslan Orientation Passport projection (seed ' + seed.format + '). ORIENTATION, not authority. Seed type/status/provenance kept in claim prefix, source_section, source_status, epistemic_state, provenance.' } });
  const PP = { 'PP-CRYSTAL': 'crystal', 'PP-TITAN': 'titan', 'PP-NATIVE': 'native-kernel', 'PP-SOUL': 'mentaury-soul', 'PP-MKERNEL': 'mentaury-kernel',
    'PP-CONTINUUM': 'continuum', 'PP-COGOS': 'cognitive-os', 'PP-CLOS': 'clos', 'PP-GRAPHITI': 'graphiti-fractal', 'PP-ATLAS': 'atlas', 'PP-SVL': 'state-validation-lab', 'PP-LAB': 'eiti-wizard-lab' };
  for (const r of seed.records) {
    const s = src.get(r.source);
    const item = {
      item_id: 'passport:' + r.id, source_id: 'passport:src:' + r.source,
      project_id: PP[r.id] || 'ruslan-orientation',
      item_type: labItemType(r, s),
      claim: `[${r.type} · ${r.status}] ${r.statement}`,
      source_section: `seed_type=${r.type}; seed_id=${r.id}; details=${r.details_pointer}`,
      source_status: r.status,
      epistemic_state: EPI[r.provenance],
      authority_scope: r.scope,
      validity: `valid_from=${r.valid_from}`,
      confidence: r.certainty != null ? r.certainty : null,
      as_of: r.updated_at,
      supersedes_item_id: r.supersedes ? 'passport:' + r.supersedes : null,
      provenance: `${r.provenance}; seed_source=${r.source}` + ((r.related_to || []).length ? '; related_to=' + r.related_to.join(',') : ''),
    };
    lines.push({ source: srcObj(r.source), item });
  }
  for (const r of seed.records) for (const x of r.relations || []) {
    const t = REL_MAP[x.rel];
    if (!t) continue;
    lines.push({ relation: { relation_id: `passport:rel:${r.id}:${x.rel}:${x.target}`, from_item_id: 'passport:' + r.id, to_item_id: 'passport:' + x.target,
      relation_type: t, epistemic_status: 'AI_PROPOSED_LINK', source_id: 'passport:src:' + r.source, scope: 'seed_rel=' + x.rel,
      rationale: x.rel === 'DOES_NOT_ESTABLISH' ? 'seed_rel=DOES_NOT_ESTABLISH — the source record does NOT establish the target (neither support nor counterevidence)' : 'seed_rel=' + x.rel } });
  }
  return lines.map(l => JSON.stringify(l)).join('\n') + '\n';
}

// ── М2: провайдер-нейтральный контекст (eiti-context-bootstrap/1) ─────────────
// Источник — только канон + манифест. Без сети, моделей, эмбеддингов, провайдеров.
// Детерминизм: тот же seed+manifest+tool дают побайтово одинаковые JSON и МД.
// Без wall-clock generated_at: as_of берём из seed.as_of.
export const BOOTSTRAP_SCHEMA = 'eiti-context-bootstrap/1';
export const BOOTSTRAP_ROLE = 'PROVIDER_NEUTRAL_ORIENTATION';
export const BOOTSTRAP_CARRIER = 'M1';
// Фиксированные правила чтения пакета. Порядок фиксирован для детерминизма.
export const INTERPRETATION_RULES = [
  'BOOTSTRAP!=CANON: производная ориентация, пересобирается из канона; не источник истины.',
  'BOOTSTRAP!=FULL HISTORY: HISTORICAL/SUPERSEDED исключены из текущих секций; CURRENT_STATE!=HISTORY.',
  'BOOTSTRAP!=MEMORY ADMISSION: чтение не записывает память; ADMISSION_IMPLEMENTATION=ABSENT.',
  'BOOTSTRAP!=USER DECISION: MODEL_PROPOSAL!=USER_DECISION; AI_SUMMARY!=USER_STATEMENT.',
  'UNKNOWN!=FALSE; NOT RETRIEVED!=ABSENT; HYPOTHESIS!=FACT.',
  'RESEARCH_RESULT!=VERIFIED_TRUTH; ENGINEERING_RESULT действует только в своём scope.',
  'SUPERSEDED!=DELETED: superseded/history живут в каноне, здесь исключены из current.',
  'MODEL READING != MODEL OWNING MEMORY; PROVIDER != MEMORY_OWNER.',
  'Сохранять id/type/status/source/provenance/scope/updated_at/details_pointer дословно.',
  'Детали — только по details_pointer; приватные локаторы не разрешать.',
];
// Порядок секций фиксирован для детерминизма JSON и МД.
export const BOOTSTRAP_SECTION_ORDER = ['who', 'north_star', 'current_priority', 'active_threads', 'known',
  'known_limitations', 'open', 'next', 'projects', 'sources', 'invariants'];

// Загрузка манифеста носителя (только чтение для ворот целостности).
export function loadManifest(p = DEFAULT_MANIFEST) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
// SHA-256 файла канона по байтам (без нормализации — строгое сравнение с манифестом).
export function sha256File(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

// Чистая проверка трёх условий (без чтения файлов — для тестов и переиспользования).
// Возвращает ok=false и явные ошибки при любом нарушении; никакого silent repair.
export function verifyIntegrity(seed, fileHash, manifest) {
  const errors = [];
  const v = validate(seed);
  if (!v.ok) errors.push(`проверка 1/3 (валидация seed): INVALID — ${v.errors.length} ошибок (${v.errors.slice(0, 3).join('; ')}${v.errors.length > 3 ? '…' : ''})`);
  const actual = Array.isArray(seed && seed.records) ? seed.records.length : null;
  const expected = manifest && manifest.canonical_record_count;
  if (actual !== expected) errors.push(`проверка 2/3 (счётчик записей): seed содержит ${actual}, манифест требует ${expected}`);
  const gotHash = fileHash;
  const wantHash = manifest && manifest.canonical_content_sha256;
  if (gotHash !== wantHash) errors.push(`проверка 3/3 (SHA-256 содержимого): файл ${gotHash}, манифест ${wantHash}`);
  return { ok: errors.length === 0, errors };
}

// Ворота целостности с чтением файлов. FAIL CLOSED: при любой ошибке ok=false.
export function checkIntegrity(seedPath = DEFAULT_SEED, manifestPath = DEFAULT_MANIFEST) {
  let manifest = null;
  let seed = null;
  let fileHash = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`манифест не прочитан (${manifestPath}): ${e.message}`], seed, manifest, fileHash };
  }
  try {
    fileHash = sha256File(seedPath);
  } catch (e) {
    return { ok: false, errors: [`файл seed не прочитан (${seedPath}): ${e.message}`], seed, manifest, fileHash };
  }
  try {
    seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`seed не разобран как JSON (${seedPath}): ${e.message}`], seed, manifest, fileHash };
  }
  const verdict = verifyIntegrity(seed, fileHash, manifest);
  return { ok: verdict.ok, errors: verdict.errors, seed, manifest, fileHash };
}

// Сборка объекта пакета (порядок ключей и секций фиксирован).
export function buildBootstrap(seed, manifest, fileHash) {
  const selected = selectBootstrapSections(seed);
  const sections = {};
  for (const key of BOOTSTRAP_SECTION_ORDER) sections[key] = (selected[key] || []).map(projectRecord);
  return {
    schema: BOOTSTRAP_SCHEMA,
    role: BOOTSTRAP_ROLE,
    carrier_version: (manifest && manifest.carrier_version) || BOOTSTRAP_CARRIER,
    canonical_content_sha256: (manifest && manifest.canonical_content_sha256) || fileHash,
    canonical_record_count: (manifest && manifest.canonical_record_count) ?? seed.records.length,
    seed_version: seed.seed_version,
    as_of: seed.as_of,
    interpretation_rules: [...INTERPRETATION_RULES],
    sections,
  };
}
// Упорядоченный список ИД записей пакета (порядок секций + порядок канона внутри).
export function bootstrapRecordIds(bootstrap) {
  const ids = [];
  for (const key of BOOTSTRAP_SECTION_ORDER) for (const r of (bootstrap.sections[key] || [])) ids.push(r.id);
  return ids;
}
// JSON-вывод: стабильный stringify с отступом 2 и концевым переводом строки.
export function renderBootstrapJson(seed, manifest, fileHash) {
  return JSON.stringify(buildBootstrap(seed, manifest, fileHash), null, 2) + '\n';
}
// Строка одной записи в МД: первая строка несёт ИД для извлечения тем же порядком, что в JSON.
function bootstrapMdRecord(r) {
  const first = `- ${r.id} [${r.type} · ${r.status}] ${r.statement}`;
  const second = `  - источник: ${r.source}; происхождение: ${r.provenance}; охват: ${r.scope}; обновлено: ${r.updated_at}; детали: ${r.details_pointer}`;
  return first + '\n' + second;
}
// МД-вывод: те же ИД и тот же порядок, что в JSON; без выдуманных утверждений.
export function renderBootstrapMarkdown(seed, manifest, fileHash) {
  const pack = buildBootstrap(seed, manifest, fileHash);
  const out = [];
  out.push('# EITI CONTEXT BOOTSTRAP — провайдер-нейтральная ориентация');
  out.push('> Граница ориентации: это производный пакет для чтения любым ИИ, а не абсолютная истина.');
  out.push('> BOOTSTRAP!=CANON: пересобирается из канона; канон — только docs/memory/ruslan-orientation-seed.json.');
  out.push('> BOOTSTRAP!=FULL HISTORY: HISTORICAL/SUPERSEDED исключены из текущих секций; CURRENT_STATE!=HISTORY.');
  out.push('> BOOTSTRAP!=MEMORY ADMISSION: чтение не записывает память; BOOTSTRAP!=USER DECISION.');
  out.push('> Сохраняйте status/provenance/source/type дословно. UNKNOWN!=FALSE. MODEL_PROPOSAL!=USER_DECISION.');
  out.push('> MODEL READING != MODEL OWNING MEMORY. Детали — только по details_pointer; приватные локаторы не разрешать.');
  out.push('>');
  out.push(`> Метаданные: schema=${pack.schema}; role=${pack.role}; carrier=${pack.carrier_version}; canon_sha=${pack.canonical_content_sha256}; canon_count=${pack.canonical_record_count}; seed_version=${pack.seed_version}; as_of=${pack.as_of}.`);
  out.push('');
  const titles = { who: 'WHO', north_star: 'NORTH_STAR', current_priority: 'CURRENT_PRIORITY',
    active_threads: 'ACTIVE_THREADS', known: 'KNOWN', known_limitations: 'KNOWN_LIMITATIONS',
    open: 'OPEN', next: 'NEXT', projects: 'PROJECTS', sources: 'SOURCES', invariants: 'INVARIANTS' };
  for (const key of BOOTSTRAP_SECTION_ORDER) {
    out.push(`## ${titles[key]}`);
    const rows = pack.sections[key] || [];
    if (key === 'active_threads') {
      const current = rows.filter((r) => r.status === 'CURRENT');
      const rest = rows.filter((r) => r.status !== 'CURRENT');
      current.forEach((r) => out.push(bootstrapMdRecord(r)));
      if (rest.length) {
        out.push('- Линии, актуальность которых сегодня НЕ подтверждена (STORED != CURRENT, статус сохранён):');
        rest.forEach((r) => out.push(bootstrapMdRecord(r)));
      }
    } else if (key === 'next') {
      const steps = rows.filter((r) => r.type === 'NEXT_ACTION');
      const deferred = rows.filter((r) => r.type !== 'NEXT_ACTION');
      steps.forEach((r) => out.push(bootstrapMdRecord(r)));
      if (deferred.length) {
        out.push('- Явно отложено (DEFERRED, не начинать без явного GO; статус сохранён):');
        deferred.forEach((r) => out.push(bootstrapMdRecord(r)));
      }
    } else {
      rows.forEach((r) => out.push(bootstrapMdRecord(r)));
    }
    out.push('');
  }
  return out.join('\n');
}

// Извлечение упорядоченных ИД из МД-пакета (первая строка каждой записи).
export function bootstrapMarkdownIds(md) {
  const ids = [];
  for (const m of String(md).matchAll(/^- ([A-Z0-9-]+) \[/gm)) ids.push(m[1]);
  return ids;
}

// ── CLI ────────────────────────────────────────────────────────────────────
function arg(argv, name, def) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; }
function positional(argv) { const out = []; for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { if (!['--json'].includes(argv[i])) i++; continue; } out.push(argv[i]); } return out; }
export function main(argv) {
  const [cmd, ...rest] = argv;
  const pos = positional(rest);
  const seedPath = arg(rest, '--seed', null) || (cmd !== 'search' && cmd !== 'export-context' && pos[0]) || DEFAULT_SEED;
  // Справка: строки использования из шапки файла (включая export-context).
  if (!cmd || cmd === 'help' || cmd === '--help') { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).join('\n')); return 0; }
  // М2: ворота целостности до любого экспорта (FAIL CLOSED, без silent repair).
  if (cmd === 'export-context') {
    const format = arg(rest, '--format', null);
    if (format !== 'json' && format !== 'md') { console.error('usage: export-context --format json|md [--out <path>] [--seed seed.json] [--manifest manifest.json]'); return 2; }
    const ctxSeedPath = arg(rest, '--seed', null) || pos[0] || DEFAULT_SEED;
    const manifestPath = arg(rest, '--manifest', null) || DEFAULT_MANIFEST;
    const gate = checkIntegrity(ctxSeedPath, manifestPath);
    if (!gate.ok) { gate.errors.forEach((e) => console.error('INTEGRITY FAIL: ' + e)); return 1; }
    const text = format === 'json'
      ? renderBootstrapJson(gate.seed, gate.manifest, gate.fileHash)
      : renderBootstrapMarkdown(gate.seed, gate.manifest, gate.fileHash);
    const out = arg(rest, '--out', null);
    if (out) { fs.writeFileSync(out, text); console.log(`wrote ${out} (${bootstrapRecordIds(buildBootstrap(gate.seed, gate.manifest, gate.fileHash)).length} records, format ${format})`); }
    else process.stdout.write(text);
    return 0;
  }
  const seed = loadSeed(seedPath);
  if (cmd === 'validate') {
    const v = validate(seed);
    v.warnings.forEach(w => console.log('WARN  ' + w)); v.errors.forEach(e => console.log('ERROR ' + e));
    console.log(v.ok ? `VALID: ${v.records} records, 0 errors, ${v.warnings.length} warnings` : `INVALID: ${v.errors.length} errors`);
    return v.ok ? 0 : 1;
  }
  if (cmd === 'stats') { console.log(JSON.stringify(stats(seed), null, 2)); return 0; }
  if (cmd === 'render-start-view') {
    const md = renderStartView(seed); const out = arg(rest, '--out', null);
    if (out) { fs.writeFileSync(out, md); console.log(`wrote ${out} (${wordCount(md)} words)`); } else process.stdout.write(md);
    return 0;
  }
  if (cmd === 'search') {
    const q = pos[0]; if (!q) { console.error('usage: search "<query>"'); return 2; }
    const res = search(seed, q, { k: Number(arg(rest, '--k', 5)) });
    if (rest.includes('--json')) console.log(JSON.stringify(res, null, 2));
    else res.forEach((x, i) => console.log(`${i + 1}. ${x.id} [${x.type} · ${x.status} · ${x.source}] score=${x.score}\n   ${x.statement}`));
    return 0;
  }
  if (cmd === 'export-lab') {
    const locPath = arg(rest, '--locators', path.join(ROOT, 'private-memory', 'source-locators.private.json'));
    const loc = fs.existsSync(locPath) ? JSON.parse(fs.readFileSync(locPath, 'utf8')) : {};
    const text = exportLab(seed, loc); const out = arg(rest, '--out', null);
    if (out) { fs.writeFileSync(out, text); console.log(`wrote ${out} (${text.trim().split('\n').length} lines; locators ${Object.keys(loc).length ? 'from ' + locPath : 'NOT found → alias: placeholders'})`); }
    else process.stdout.write(text);
    return 0;
  }
  console.error('unknown command ' + cmd); return 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
