#!/usr/bin/env node
// Инструмент журнала М2.1.1 — только OBSERVED, неизменяемый карантинный слой (без зависимостей).
//
//   node tools/memory/ledger_tool.mjs validate-event <событие.json> [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]
//   node tools/memory/ledger_tool.mjs append-observed <событие.json> [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]
//   node tools/memory/ledger_tool.mjs check-hash [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]
//
// Правила вехи М2.1.1 (надмножество М2.1, только OBSERVED):
// - ИИ МОЖЕТ ДОПИСЫВАТЬ OBSERVED; ИИ НЕ МОЖЕТ ДОПУСКАТЬ В КАНОН.
// - Дописывание только неизменяемое (append-only). Карантин означает отказ ДО дописывания.
// - Источник записи — строгий ИСКЛЮЧАЮЩИЙ выбор: Путь А (source+source_kind из сида) или Путь Б (observed_source).
// - Событийно-локальное не равно канону, реестру, допущенному и проверенному.
// - Критическая секция: appendObserved сериализует писателей блокировкой каталога (mkdir exclusive).
//   Граница гарантии — только ОДНА общая локальная файловая система. Не распределённый консенсус.
// - Хеш base_canonical_sha256 обязан равняться хешу БАЙТОВ сида и полю манифеста, иначе отказ с закрытием.
// - Имя base_manifest_hash запрещено.
// - Порядок задают цепочка prior_event_id и физический порядок строк; метка времени только метаданные.
// - Форк или malformed строка означают FAIL CLOSED CONFLICT.
// - Канон, манифест, CURRENT_ORIENTATION, паспорт и wiz_ref в М2.1.1 не мутируют.
// - recorded_by — заявленная логическая метка писателя, а не проверенная личность (см. ниже).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { TYPES as SEED_TYPES, STATUSES as SEED_STATUSES, PROVENANCE as SEED_PROVENANCE, RELS as SEED_RELS } from './seed_tool.mjs';

// Корень репозитория и пути по умолчанию.
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');
export const DEFAULT_SEED = path.join(ROOT, 'docs', 'memory', 'ruslan-orientation-seed.json');
export const DEFAULT_MANIFEST = path.join(ROOT, 'docs', 'memory', 'manifest.json');
export const DEFAULT_LEDGER = path.join(ROOT, 'docs', 'memory', 'event_ledger.jsonl');

// Перечисления конверта М2.1.1.
export const ADMISSION_STATES = ['OBSERVED', 'ADMITTED', 'QUARANTINED', 'REJECTED'];
export const EVENT_KINDS = ['OBSERVE', 'ADMIT', 'SUPERSEDE', 'CONFLICT_MARK'];
export const WRITER_MODES = ['READ_WRITE_PR'];
export const ACTOR_CLASSES = ['HUMAN', 'AI', 'SYSTEM'];

// Разрешённые ключи конверта и записи.
// В М2.1.1 source/source_kind убраны из безусловных обязательных: их наличие проверяет ИСКЛЮЧАЮЩИЙ выбор.
export const ENVELOPE_KEYS = ['event_id', 'timestamp', 'admission_state', 'event_kind', 'source_actor', 'recorded_by',
  'authorized_by', 'base_canonical_sha256', 'base_manifest_file_sha256', 'base_commit_sha', 'prior_event_id',
  'applies_to_event_id', 'admission_reason', 'writer_mode'];
export const RECORD_REQUIRED = ['id', 'type', 'statement', 'status', 'scope', 'provenance',
  'valid_from', 'updated_at', 'details_pointer', 'relations'];
export const RECORD_OPTIONAL = ['related_to', 'supersedes', 'superseded_by', 'keywords'];
// Ключи источника под управлением ИСКЛЮЧАЮЩЕГО выбора: Путь А (source+source_kind) или Путь Б (observed_source).
export const RECORD_SOURCE_KEYS = ['source', 'source_kind', 'observed_source'];
export const RECORD_ALLOWED = [...RECORD_REQUIRED, ...RECORD_OPTIONAL, ...RECORD_SOURCE_KEYS];
// Запрещённые в М2.1.1 ключи записи (карантин).
export const RECORD_FORBIDDEN_M21 = ['authority', 'evidence', 'confidence', 'validity'];

// Перечисления событийно-локального источника М2.1.1 (Путь Б).
// Виды сида плюс событийно-локальные виды; событийно-локальное не равно канону.
export const OBS_SOURCE_KINDS = ['USER_STATEMENT', 'NOTION_PAGE', 'DRIVE_DOC', 'GITHUB_REPO', 'AI_ASSEMBLY',
  'CHAT_OBSERVATION', 'PUBLIC_WEB', 'OTHER_DECLARED'];
export const OBS_SURFACE_CLASSES = ['local', 'github', 'public_web', 'chat', 'notion', 'drive', 'other'];
export const OBS_PROVENANCE_STATUSES = ['UNREGISTERED_EVENT_LOCAL'];
export const OBSERVED_SOURCE_REQUIRED = ['kind', 'label', 'surface_class', 'provenance_status'];
// Запрещённые ключи внутри observed_source: идентификаторы, локаторы, секреты и метаданные канона.
// Метка label — единственный носитель названия; поле title запрещено (использовать label).
export const OBSERVED_SOURCE_FORBIDDEN = ['alias', 'url', 'locator', 'id', 'page_id', 'file_id', 'document_id',
  'token', 'secret', 'credentials',
  'authority_class', 'currentness', 'role', 'use_for', 'do_not_use_for', 'reachable', 'fetched_at',
  'last_edited', 'export_kind', 'title'];

// Шаблоны форматов.
const RE_EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
const RE_HEX64 = /^[0-9a-f]{64}$/;
const RE_HEX40 = /^[0-9a-f]{40}$/;
// Метка актёра КЛАСС:идентификатор. Это заявленная логическая метка писателя, а не проверенная личность:
// самозаявленная метка не равна подтверждённой личности, не равна коммитеру гита и не равна криптодоказательству.
const RE_ACTOR = /^(HUMAN|AI|SYSTEM):\S{1,64}$/;

// Шаблоны карантина: учётные данные.
const QUARANTINE_CREDENTIAL_RES = [
  /sk-[A-Za-z0-9]{8,}/,
  /gh[pousr]_[A-Za-z0-9]{8,}/,
  /xox[baprs]-[A-Za-z0-9-]{8,}/,
  /AIza[A-Za-z0-9_-]{8,}/,
  /-----BEGIN (RSA )?PRIVATE KEY-----/,
  /api[_-]?key\s*[:=]\s*['"]?[A-Za-z0-9\-_.]{4,}/i,
  /password\s*[:=]\s*['"]?\S{4,}/i,
  /secret\s*[:=]\s*['"]?\S{4,}/i,
  /bearer\s+[A-Za-z0-9\-_.]{8,}/i,
  /(^|[^A-Za-z])token\s*[:=]\s*['"]?[A-Za-z0-9\-_.]{8,}/i,
  /(^|[^A-Za-z])cookie\s*[:=]\s*['"]?\S{4,}/i,
];
// Шаблоны карантина: приватные локаторы.
// Политика М2.1.1: произвольный технический идентификатор не равен приватному локатору.
// Голый УУИД-подобный токен вне приватного УРЛ-контекста не отклоняется (ложные срабатывания на ид событий).
const QUARANTINE_LOCATOR_RES = [
  /notion\.so\//i,
  /notion\.site\//i,
  /app\.notion\.com/i,
  /docs\.google\.com/i,
  /drive\.google\.com/i,
];

// Вычисление SHA-256 байтов и файлов.
export function sha256Bytes(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
export function sha256File(p) { return sha256Bytes(fs.readFileSync(p)); }

// Блокировка журнала для сериализации писателей на одной локальной файловой системе.
// Атомарность захвата обеспечивается исключительным созданием каталога (mkdir без recursive).
// Это НЕ распределённая блокировка между клонами, машинами и ветками.
export const LEDGER_LOCK_SUFFIX = '.lock';
export const LEDGER_LOCK_INFO = 'info.json';
export const LEDGER_LOCK_STALE_MS = 60000;

// Путь каталога блокировки для заданного журнала.
export function ledgerLockDir(ledgerPath) { return String(ledgerPath) + LEDGER_LOCK_SUFFIX; }

// Возраст блокировки по времени модификации каталога (миллисекунды, null при ошибке).
function возрастБлокировкиПоМодификации(lockDir) {
  try {
    const стат = fs.statSync(lockDir);
    return Date.now() - стат.mtimeMs;
  } catch (ошибкаСтата) { void ошибкаСтата; return null; }
}

// Захват блокировки: одна попытка, без ожидания и без авто-повторов.
// Успех: {ok:true, lockDir, info}. Занято: {ok:false, busy:true}. Устарело: {ok:false, stale:true}.
// Устаревшая блокировка НЕ удаляется автоматически — требуется ручной разбор.
export function acquireLedgerLock(ledgerPath, opts = {}) {
  const staleMs = opts.staleMs ?? LEDGER_LOCK_STALE_MS;
  const lockDir = ledgerLockDir(ledgerPath);
  try { fs.mkdirSync(path.dirname(String(ledgerPath)), { recursive: true }); } catch (ошибкаКаталога) { void ошибкаКаталога; }
  try {
    fs.mkdirSync(lockDir);
  } catch (e) {
    const код = e && e.code ? String(e.code) : '';
    if (код !== '' && код !== 'EEXIST') {
      return { ok: false, errors: [`LEDGER_BUSY/LOCK_HELD: невозможно захватить блокировку ${lockDir}: ${String(e && e.message || e)}`], warnings: [], busy: true, lockDir };
    }
    // Блокировка уже удерживается — читаем сведения для различения занято/устарело.
    let сведения = null;
    let сведенияПрочитаны = false;
    try {
      const сырьё = fs.readFileSync(path.join(lockDir, LEDGER_LOCK_INFO), 'utf8');
      сведения = JSON.parse(сырьё);
      сведенияПрочитаны = true;
    } catch (ошибкаСведений) { void ошибкаСведений; сведенияПрочитаны = false; }
    if (сведенияПрочитаны && сведения && typeof сведения.acquiredAt === 'number') {
      const возраст = Date.now() - сведения.acquiredAt;
      const идПроцесса = сведения.pid ?? '?';
      if (возраст > staleMs) {
        return { ok: false, errors: [`STALE_LOCK_REQUIRES_REVIEW: блокировка ${lockDir} устарела (возраст ${возраст} мс > ${staleMs} мс, pid ${String(идПроцесса)}). Авто-удаление запрещено, требуется ручной разбор.`], warnings: [], stale: true, lockDir };
      }
      return { ok: false, errors: [`LEDGER_BUSY/LOCK_HELD: журнал заблокирован ${lockDir} (pid ${String(идПроцесса)}, возраст ${возраст} мс). Повторите позже без изменения порядка.`], warnings: [], busy: true, lockDir };
    }
    // Сведения отсутствуют или повреждены: оцениваем возраст по модификации каталога.
    const возрастФс = возрастБлокировкиПоМодификации(lockDir);
    if (возрастФс !== null && возрастФс > staleMs) {
      return { ok: false, errors: [`STALE_LOCK_REQUIRES_REVIEW: блокировка ${lockDir} без сведений старше ${staleMs} мс (возраст ${Math.round(возрастФс)} мс). Авто-удаление запрещено, требуется ручной разбор.`], warnings: [], stale: true, lockDir };
    }
    return { ok: false, errors: [`LEDGER_BUSY/LOCK_HELD: журнал заблокирован ${lockDir} (сведения недоступны, только что захвачена или повреждена). Повторите позже.`], warnings: [], busy: true, lockDir };
  }
  // Захват успешен — записываем сведения о владельце.
  const сведения = { pid: process.pid, acquiredAt: Date.now(), ledger: String(ledgerPath) };
  try {
    fs.writeFileSync(path.join(lockDir, LEDGER_LOCK_INFO), JSON.stringify(сведения));
  } catch (e) {
    try { releaseLedgerLock(lockDir); } catch (ошибкаОсвобождения) { void ошибкаОсвобождения; }
    return { ok: false, errors: [`LEDGER_BUSY/LOCK_HELD: невозможно записать сведения блокировки ${lockDir}: ${String(e && e.message || e)}`], warnings: [], busy: true, lockDir };
  }
  return { ok: true, errors: [], warnings: [], lockDir, info: сведения };
}

// Освобождение блокировки (лучшая попытка, ошибки игнорируются).
export function releaseLedgerLock(lockDir) {
  try { fs.rmSync(String(lockDir), { recursive: true, force: true }); } catch (ошибкаУдаления) { void ошибкаУдаления; }
  return true;
}

// Загрузка манифеста и сида.
export function loadManifest(p = DEFAULT_MANIFEST) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
export function loadSeed(p = DEFAULT_SEED) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// Сбор всех строковых значений объекта для карантинного сканирования.
function collectStrings(value, out) {
  if (typeof value === 'string') { out.push(value); return; }
  if (Array.isArray(value)) { for (const v of value) collectStrings(v, out); return; }
  if (value && typeof value === 'object') { for (const v of Object.values(value)) collectStrings(v, out); }
}

// Проверка цепочки журнала: читает файл построчно, проверяет целостность.
export function loadLedger(ledgerPath = DEFAULT_LEDGER) {
  const errors = [];
  const events = [];
  const seen = new Set();
  let raw = '';
  if (!fs.existsSync(ledgerPath)) return { ok: true, errors, events, tip: null, lineCount: 0, byteLength: 0 };
  raw = fs.readFileSync(ledgerPath, 'utf8');
  if (raw === '') return { ok: true, errors, events, tip: null, lineCount: 0, byteLength: 0 };
  if (!raw.endsWith('\n')) {
    errors.push('LEDGER_FORMAT_ERROR/TERMINAL_NEWLINE_MISSING: непустой журнал обязан завершаться переводом строки "\\n". Append-only запрещает молчаливую нормализацию и перезапись существующих байтов. Требуется ручной разбор.');
  }
  const lines = raw.split('\n');
  // Последняя пустая строка после завершающего перевода строки не считается событием.
  let effective = lines;
  if (effective.length > 0 && effective[effective.length - 1] === '') effective = effective.slice(0, -1);
  let prevId = null;
  effective.forEach((line, idx) => {
    const номер = idx + 1;
    if (line === '') { errors.push(`строка ${номер}: пустая строка внутри журнала (CONFLICT)`); return; }
    let parsed = null;
    try { parsed = JSON.parse(line); } catch (ошибкаРазбора) { void ошибкаРазбора; errors.push(`строка ${номер}: malformed JSON (CONFLICT)`); return; }
    if (!parsed || typeof parsed !== 'object' || !parsed.envelope || !parsed.record) {
      errors.push(`строка ${номер}: отсутствует envelope или record (CONFLICT)`); return;
    }
    const eid = parsed.envelope.event_id;
    if (typeof eid !== 'string' || !RE_EVENT_ID.test(eid)) { errors.push(`строка ${номер}: неверный event_id (CONFLICT)`); return; }
    if (seen.has(eid)) { errors.push(`строка ${номер}: дубликат event_id ${eid} (FORK/CONFLICT)`); return; }
    seen.add(eid);
    const prior = parsed.envelope.prior_event_id ?? null;
    if (events.length === 0) {
      if (prior !== null && prior !== undefined) errors.push(`строка ${номер}: первое событие обязано иметь prior_event_id null (CONFLICT)`);
    } else if (prior !== prevId) {
      errors.push(`строка ${номер}: prior_event_id ${String(prior)} не равен предыдущему ${String(prevId)} (FORK/CONFLICT)`);
    }
    prevId = eid;
    events.push({ line: номер, event_id: eid, parsed });
  });
  const tip = events.length ? events[events.length - 1].event_id : null;
  return { ok: errors.length === 0, errors, events, tip, lineCount: events.length, byteLength: Buffer.byteLength(raw, 'utf8') };
}

// Проверка одного события против манифеста, сида и текущего кончика журнала.
export function validateEvent(event, opts = {}) {
  const errors = [];
  const warnings = [];
  const manifestPath = opts.manifestPath || DEFAULT_MANIFEST;
  const seedPath = opts.seedPath || DEFAULT_SEED;
  const ledgerPath = opts.ledgerPath || DEFAULT_LEDGER;
  let manifest = opts.manifest || null;
  let seed = opts.seed || null;
  // Загрузка манифеста и сида (отказ с закрытием при отсутствии).
  try { if (!manifest) manifest = loadManifest(manifestPath); } catch (e) { return { ok: false, errors: [`манифест не читается: ${String(e && e.message || e)}`], warnings }; }
  try { if (!seed) seed = loadSeed(seedPath); } catch (e) { return { ok: false, errors: [`сид не читается: ${String(e && e.message || e)}`], warnings }; }
  // Проверка формы провода.
  if (!event || typeof event !== 'object' || Array.isArray(event)) return { ok: false, errors: ['событие обязано быть объектом {envelope, record}'], warnings };
  const topKeys = Object.keys(event);
  for (const k of topKeys) if (k !== 'envelope' && k !== 'record') errors.push(`лишний верхний ключ: ${k}`);
  const env = event.envelope;
  const rec = event.record;
  if (!env || typeof env !== 'object' || Array.isArray(env)) errors.push('envelope обязан быть объектом');
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) errors.push('record обязан быть объектом');
  if (errors.length) return { ok: false, errors, warnings };
  // Запрещённое имя хеша манифеста.
  if ('base_manifest_hash' in env) errors.push('запрещённое имя base_manifest_hash: используйте base_canonical_sha256');
  // Неизвестные ключи конверта.
  for (const k of Object.keys(env)) if (!ENVELOPE_KEYS.includes(k)) errors.push(`неизвестный ключ конверта: ${k}`);
  // Запрещённые ключи записи (карантин).
  for (const k of RECORD_FORBIDDEN_M21) if (k in rec) errors.push(`QUARANTINE_FORBIDDEN_KEYS: ключ ${k} запрещён в М2.1.1`);
  // Неизвестные ключи записи (разрешён новый observed_source).
  for (const k of Object.keys(rec)) if (!RECORD_ALLOWED.includes(k)) errors.push(`неизвестный ключ записи: ${k}`);
  // Строгий ИСКЛЮЧАЮЩИЙ выбор источника М2.1.1: ровно одна форма.
  // Путь А: source+source_kind из сида, observed_source отсутствует.
  // Путь Б: только observed_source, ключи source/source_kind отсутствуют (нуль не допускается).
  const естьНаблюдаемый = 'observed_source' in rec;
  const естьКлючиСида = ('source' in rec) || ('source_kind' in rec);
  let путьА = false;
  let путьБ = false;
  if (естьНаблюдаемый && естьКлючиСида) {
    errors.push('SOURCE_XOR_BOTH: запрещены одновременно source/source_kind и observed_source (ровно одна форма)');
  } else if (!естьНаблюдаемый && !естьКлючиСида) {
    errors.push('SOURCE_XOR_REQUIRED: требуется ровно одна форма источника: source+source_kind или observed_source');
  } else if (естьНаблюдаемый) {
    путьБ = true;
  } else {
    путьА = true;
  }
  // Обязательные поля конверта.
  for (const f of ['event_id', 'timestamp', 'admission_state', 'event_kind', 'source_actor', 'recorded_by', 'base_canonical_sha256', 'base_commit_sha', 'writer_mode']) {
    if (env[f] === undefined || env[f] === null || env[f] === '') errors.push(`конверт: отсутствует ${f}`);
  }
  // Форматы конверта.
  if (env.event_id !== undefined && env.event_id !== null && !RE_EVENT_ID.test(String(env.event_id))) errors.push(`конверт: неверный event_id ${String(env.event_id)}`);
  if (env.timestamp !== undefined && env.timestamp !== null) {
    if (!RE_TIMESTAMP.test(String(env.timestamp)) || Number.isNaN(Date.parse(String(env.timestamp)))) errors.push(`конверт: неверный timestamp ${String(env.timestamp)}`);
  }
  if (env.admission_state !== undefined && env.admission_state !== null && !ADMISSION_STATES.includes(env.admission_state)) errors.push(`конверт: неверный admission_state ${String(env.admission_state)}`);
  if (env.event_kind !== undefined && env.event_kind !== null && !EVENT_KINDS.includes(env.event_kind)) errors.push(`конверт: неверный event_kind ${String(env.event_kind)}`);
  if (env.writer_mode !== undefined && env.writer_mode !== null && !WRITER_MODES.includes(env.writer_mode)) errors.push(`конверт: неверный writer_mode ${String(env.writer_mode)} (в М2.1.1 только READ_WRITE_PR)`);
  for (const f of ['source_actor', 'recorded_by']) {
    // Проверка recorded_by/source_actor — только форма метки; самозаявленная метка не равна проверенной личности.
    if (env[f] !== undefined && env[f] !== null && !RE_ACTOR.test(String(env[f]))) errors.push(`конверт: неверный ${f} ${String(env[f])} (ожидается КЛАСС:идентификатор)`);
  }
  if (env.authorized_by !== undefined && env.authorized_by !== null && !RE_ACTOR.test(String(env.authorized_by))) errors.push(`конверт: неверный authorized_by ${String(env.authorized_by)}`);
  if (env.base_canonical_sha256 !== undefined && env.base_canonical_sha256 !== null && !RE_HEX64.test(String(env.base_canonical_sha256))) errors.push('конверт: неверный base_canonical_sha256 (ожидается 64 hex)');
  if (env.base_manifest_file_sha256 !== undefined && env.base_manifest_file_sha256 !== null && !RE_HEX64.test(String(env.base_manifest_file_sha256))) errors.push('конверт: неверный base_manifest_file_sha256 (ожидается 64 hex)');
  if (env.base_commit_sha !== undefined && env.base_commit_sha !== null && !RE_HEX40.test(String(env.base_commit_sha))) errors.push('конверт: неверный base_commit_sha (ожидается 40 hex)');
  for (const f of ['prior_event_id', 'applies_to_event_id']) {
    const v = env[f];
    if (v !== undefined && v !== null && !RE_EVENT_ID.test(String(v))) errors.push(`конверт: неверный ${f} ${String(v)}`);
  }
  if (env.admission_reason !== undefined && env.admission_reason !== null && typeof env.admission_reason !== 'string') errors.push('конверт: admission_reason обязан быть строкой или null');
  // Правило только OBSERVED в М2.1.1 (ADMIT не реализован).
  if (env.admission_state !== undefined && env.admission_state !== null && env.admission_state !== 'OBSERVED') {
    errors.push(`ADMISSION_IMPLEMENTATION_ABSENT: admission_state ${String(env.admission_state)} запрещён в М2.1.1 (только OBSERVED)`);
  }
  if (env.event_kind !== undefined && env.event_kind !== null && env.event_kind !== 'OBSERVE') {
    errors.push(`ADMISSION_IMPLEMENTATION_ABSENT: event_kind ${String(env.event_kind)} запрещён в М2.1.1 (только OBSERVE)`);
  }
  // Правило ИИ: ИИ может писать только OBSERVED.
  const writer = String(env.recorded_by || '');
  const isAi = writer.startsWith('AI:');
  if (isAi && (env.admission_state !== 'OBSERVED' || env.event_kind !== 'OBSERVE')) {
    errors.push('AI_MAY_NOT_ADMIT: писатель ИИ не может допускать в канон (только OBSERVED)');
  }
  // Правило authorized_by для OBSERVED.
  if (env.admission_state === 'OBSERVED' && env.authorized_by !== undefined && env.authorized_by !== null) {
    errors.push('OBSERVED требует authorized_by null/отсутствует (самоподтверждение запрещено)');
  }
  // Разделение актёров.
  if (env.source_actor !== undefined && env.recorded_by !== undefined && env.source_actor !== null && env.recorded_by !== null) {
    if (String(env.source_actor) === String(env.recorded_by)) errors.push('ACTOR_SEPARATION: source_actor обязан отличаться от recorded_by');
  }
  if (env.authorized_by !== undefined && env.authorized_by !== null) {
    if (String(env.authorized_by) === String(env.recorded_by)) errors.push('ACTOR_SEPARATION: authorized_by обязан отличаться от recorded_by');
    if (env.source_actor !== undefined && env.source_actor !== null && String(env.authorized_by) === String(env.source_actor)) errors.push('ACTOR_SEPARATION: authorized_by обязан отличаться от source_actor');
  }
  // Сверка хешей (отказ с закрытием при устаревшей базе).
  // Тройная сверка: хеш БАЙТОВ сида == поле манифеста == заявленный base_canonical_sha256.
  // Доверять только полю манифеста без чтения байтов запрещено (защита от TOCTOU и подмены).
  const ожидаемыйКанон = manifest.canonical_content_sha256;
  let хешБайтовСида = null;
  try { хешБайтовСида = sha256File(seedPath); } catch (ошибкаХешаСида) { void ошибкаХешаСида; errors.push('сид: невозможно вычислить хеш байтов сида'); }
  if (typeof ожидаемыйКанон !== 'string' || !RE_HEX64.test(ожидаемыйКанон)) {
    errors.push('манифест: неверное поле canonical_content_sha256');
  } else {
    if (хешБайтовСида && хешБайтовСида !== ожидаемыйКанон) {
      errors.push(`STALE_CANONICAL_HASH: хеш байтов сида ${хешБайтовСида} не равен manifest.canonical_content_sha256 ${ожидаемыйКанон}`);
    }
    if (env.base_canonical_sha256 !== undefined && env.base_canonical_sha256 !== null && хешБайтовСида && String(env.base_canonical_sha256) !== хешБайтовСида) {
      errors.push(`STALE_CANONICAL_HASH: base_canonical_sha256 ${String(env.base_canonical_sha256)} не равен хешу байтов сида ${хешБайтовСида}`);
    }
    if (env.base_canonical_sha256 !== undefined && env.base_canonical_sha256 !== null && String(env.base_canonical_sha256) !== ожидаемыйКанон) {
      errors.push(`STALE_CANONICAL_HASH: base_canonical_sha256 ${String(env.base_canonical_sha256)} не равен manifest.canonical_content_sha256 ${ожидаемыйКанон}`);
    }
  }
  if (env.base_manifest_file_sha256 !== undefined && env.base_manifest_file_sha256 !== null) {
    let текущийХешМанифеста = null;
    try { текущийХешМанифеста = sha256File(manifestPath); } catch (ошибкаХешаМанифеста) { void ошибкаХешаМанифеста; errors.push('манифест: невозможно вычислить base_manifest_file_sha256'); }
    if (текущийХешМанифеста && String(env.base_manifest_file_sha256) !== текущийХешМанифеста) {
      errors.push(`STALE_MANIFEST_FILE_HASH: base_manifest_file_sha256 не равен хешу файла манифеста`);
    }
  }
  // Проверка записи против перечислений сида.
  for (const f of RECORD_REQUIRED) if (rec[f] === undefined || rec[f] === null || rec[f] === '') errors.push(`запись: отсутствует ${f}`);
  if (rec.type !== undefined && rec.type !== null && !SEED_TYPES.includes(rec.type)) errors.push(`запись: неверный type ${String(rec.type)}`);
  if (rec.status !== undefined && rec.status !== null && !SEED_STATUSES.includes(rec.status)) errors.push(`запись: неверный status ${String(rec.status)}`);
  if (rec.provenance !== undefined && rec.provenance !== null && !SEED_PROVENANCE.includes(rec.provenance)) errors.push(`запись: неверный provenance ${String(rec.provenance)}`);
  if (rec.id !== undefined && rec.id !== null && (typeof rec.id !== 'string' || rec.id.trim() === '')) errors.push('запись: неверный id');
  for (const f of ['statement', 'scope', 'valid_from', 'updated_at', 'details_pointer']) {
    if (rec[f] !== undefined && rec[f] !== null && typeof rec[f] !== 'string') errors.push(`запись: поле ${f} обязано быть строкой`);
  }
  if (rec.relations !== undefined && rec.relations !== null && !Array.isArray(rec.relations)) errors.push('запись: relations обязан быть массивом');
  if (rec.related_to !== undefined && rec.related_to !== null && !Array.isArray(rec.related_to)) errors.push('запись: related_to обязан быть массивом');
  if (rec.keywords !== undefined && rec.keywords !== null && typeof rec.keywords !== 'string') errors.push('запись: keywords обязан быть строкой');
  for (const f of ['supersedes', 'superseded_by']) {
    const v = rec[f];
    if (v !== undefined && v !== null && typeof v !== 'string') errors.push(`запись: поле ${f} обязано быть строкой или null`);
  }
  // Сверка источника по ИСКЛЮЧАЮЩЕМУ выбору М2.1.1.
  const источники = new Map((seed.sources || []).map(s => [s.alias, s]));
  const идКанона = new Set((seed.records || []).map(r => r.id));
  if (путьА) {
    // Путь А: зарегистрированный источник сида, observed_source отсутствует.
    for (const f of ['source', 'source_kind']) {
      if (rec[f] === undefined || rec[f] === null || rec[f] === '') errors.push(`запись: отсутствует ${f} (Путь А требует source+source_kind)`);
      else if (typeof rec[f] !== 'string') errors.push(`запись: поле ${f} обязано быть строкой`);
    }
    if (typeof rec.source === 'string' && rec.source !== '') {
      const s = источники.get(rec.source);
      if (!s) errors.push(`запись: source ${String(rec.source)} отсутствует в seed.sources`);
      else if (typeof rec.source_kind === 'string' && rec.source_kind !== '' && s.kind !== rec.source_kind) {
        errors.push(`запись: source_kind ${String(rec.source_kind)} не совпадает с kind ${String(s.kind)} источника ${String(s.alias)}`);
      }
      if (rec.provenance === 'USER_STATEMENT_2026-09-29' && s && s.kind !== 'USER_STATEMENT') {
        errors.push('запись: provenance USER_STATEMENT_2026-09-29 требует источник вида USER_STATEMENT');
      }
    }
  } else if (путьБ) {
    // Путь Б: событийно-локальный источник без обращения к сиду и без мутации канона.
    // Событийно-локальное не равно канону, реестру, допущенному и проверенному.
    const набл = rec.observed_source;
    if (!набл || typeof набл !== 'object' || Array.isArray(набл)) {
      errors.push('запись: observed_source обязан быть объектом {kind, label, surface_class, provenance_status}');
    } else {
      // Запрещённые ключи внутри observed_source (идентификаторы, локаторы, секреты, метаданные канона).
      for (const з of OBSERVED_SOURCE_FORBIDDEN) {
        if (з in набл) errors.push(`запись: observed_source запрещённый ключ ${з} (разрешены только kind/label/surface_class/provenance_status)`);
      }
      // Префиксные запреты notion_*/drive_* (любой регистр).
      for (const к of Object.keys(набл)) {
        const нижний = String(к).toLowerCase();
        if (нижний.startsWith('notion_') || нижний.startsWith('notion-') || нижний.startsWith('drive_') || нижний.startsWith('drive-')) {
          errors.push(`запись: observed_source запрещённый ключ ${к} (префикс notion_*/drive_* запрещён)`);
        }
      }
      // Ровно четыре разрешённых ключа.
      for (const о of OBSERVED_SOURCE_REQUIRED) {
        if (!(о in набл)) errors.push(`запись: observed_source отсутствует ${о}`);
      }
      for (const к of Object.keys(набл)) {
        if (!OBSERVED_SOURCE_REQUIRED.includes(к)) errors.push(`запись: observed_source неизвестный ключ ${к} (разрешены только kind/label/surface_class/provenance_status)`);
      }
      // Перечисления Пути Б.
      if ('kind' in набл && !OBS_SOURCE_KINDS.includes(набл.kind)) errors.push(`запись: observed_source неверный kind ${String(набл.kind)}`);
      if ('surface_class' in набл && !OBS_SURFACE_CLASSES.includes(набл.surface_class)) errors.push(`запись: observed_source неверный surface_class ${String(набл.surface_class)}`);
      if ('provenance_status' in набл && !OBS_PROVENANCE_STATUSES.includes(набл.provenance_status)) errors.push(`запись: observed_source неверный provenance_status ${String(набл.provenance_status)} (в М2.1.1 только UNREGISTERED_EVENT_LOCAL)`);
      // Метка: публичная строка длиной 1..200.
      if ('label' in набл) {
        const м = набл.label;
        if (typeof м !== 'string') errors.push('запись: observed_source label обязана быть строкой');
        else if (м.length < 1 || м.length > 200) errors.push(`запись: observed_source label обязана быть длиной 1..200 (получено ${м.length})`);
        else if (м.trim() === '') errors.push('запись: observed_source label не должна состоять только из пробелов');
      }
      // Согласованность происхождения: заявление пользователя требует вида USER_STATEMENT.
      if (rec.provenance === 'USER_STATEMENT_2026-09-29' && 'kind' in набл && набл.kind !== 'USER_STATEMENT') {
        errors.push('запись: provenance USER_STATEMENT_2026-09-29 требует observed_source.kind USER_STATEMENT');
      }
    }
  }
  // Проверка целей связей против канона.
  if (Array.isArray(rec.relations)) {
    for (const rel of rec.relations) {
      if (!rel || typeof rel !== 'object' || Array.isArray(rel)) { errors.push('запись: элемент relations обязан быть объектом {rel, target}'); continue; }
      // Точные ключи связи: только rel и target, любой иной ключ означает отказ с закрытием.
      for (const к of Object.keys(rel)) {
        if (к !== 'rel' && к !== 'target') errors.push(`запись: связь содержит запрещённый ключ ${к} (разрешены только rel/target)`);
      }
      if (!SEED_RELS.includes(rel.rel)) errors.push(`запись: связь ${String(rel.rel)} запрещена`);
      if (typeof rel.target !== 'string' || rel.target === '') errors.push('запись: связь target обязана быть непустой строкой');
      else if (!идКанона.has(rel.target)) errors.push(`запись: связь target ${String(rel.target)} отсутствует в каноне`);
      if (rel.target === rec.id) errors.push('запись: самоссылка запрещена');
    }
  }
  if (Array.isArray(rec.related_to)) {
    for (const t of rec.related_to) {
      if (typeof t !== 'string' || t === '') errors.push('запись: related_to обязан содержать непустые строки');
      else if (!идКанона.has(t)) errors.push(`запись: related_to ${String(t)} отсутствует в каноне`);
    }
  }
  for (const f of ['supersedes', 'superseded_by']) {
    const v = rec[f];
    if (v !== undefined && v !== null && v !== '' && !идКанона.has(v)) errors.push(`запись: ${f} ${String(v)} отсутствует в каноне`);
  }
  if (rec.status === 'SUPERSEDED' && !rec.superseded_by) errors.push('запись: статус SUPERSEDED требует superseded_by');
  // Карантинное сканирование строк (учётные данные и приватные локаторы).
  // Покрывает полное событие {envelope, record}, включая envelope.admission_reason и observed_source.label.
  // Одна коллекция строк переиспользуется обоими сканерами.
  const строки = [];
  collectStrings({ envelope: env, record: rec }, строки);
  for (const s of строки) {
    for (const re of QUARANTINE_CREDENTIAL_RES) {
      if (re.test(s)) { errors.push(`QUARANTINE_CREDENTIAL: обнаружен шаблон учётных данных (${re.source})`); break; }
    }
  }
  // Приватные локаторы проверяются по полному событию {envelope, record}, включая envelope.admission_reason.
  // Политика: голый технический ид без приватного УРЛ-контекста не отклоняется; глобальная блокировка УУИД запрещена.
  for (const s of строки) {
    for (const re of QUARANTINE_LOCATOR_RES) {
      if (re.test(s)) { errors.push(`QUARANTINE_PRIVATE_LOCATOR: обнаружен приватный локатор (${re.source})`); break; }
    }
  }
  // Если уже есть ошибки формы, цепочку всё равно проверяем для полноты отчёта, но итог уже отказ.
  // Проверка целостности журнала и соответствия prior_event_id кончику.
  const журнал = loadLedger(ledgerPath);
  if (!журнал.ok) {
    for (const e of журнал.errors) errors.push(`журнал CONFLICT: ${e}`);
    errors.push('журнал CONFLICT: отказ с закрытием до ручного разбора');
    return { ok: false, errors, warnings };
  }
  const множествоИд = new Set(журнал.events.map(e => e.event_id));
  if (env.event_id !== undefined && env.event_id !== null && множествоИд.has(String(env.event_id))) {
    errors.push(`журнал FORK: event_id ${String(env.event_id)} уже существует`);
  }
  const заявленныйPrior = env.prior_event_id ?? null;
  if (журнал.tip === null) {
    if (заявленныйPrior !== null) errors.push(`журнал CHAIN: первое событие обязано иметь prior_event_id null, получено ${String(заявленныйPrior)}`);
  } else if (заявленныйPrior !== журнал.tip) {
    errors.push(`журнал CHAIN: prior_event_id ${String(заявленныйPrior)} не равен кончику ${String(журнал.tip)} (требуется строгое дописывание)`);
  }
  if (env.applies_to_event_id !== undefined && env.applies_to_event_id !== null && !множествоИд.has(String(env.applies_to_event_id))) {
    errors.push(`журнал CHAIN: applies_to_event_id ${String(env.applies_to_event_id)} отсутствует в журнале`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

// Дописывание только OBSERVED одной строкой (fail-closed локальная критическая секция).
// Порядок: захват блокировки → перепроверка внутри блокировки → дописывание одной строки → освобождение в finally.
// Проверка до блокировки НЕДОСТАТОЧНА одна: все зависимые от состояния проверки повторяются внутри.
// Граница гарантии: сериализация писателей только на ОДНОЙ общей локальной файловой системе.
export function appendObserved(event, opts = {}) {
  const ledgerPath = opts.ledgerPath || DEFAULT_LEDGER;
  const manifestPath = opts.manifestPath || DEFAULT_MANIFEST;
  const seedPath = opts.seedPath || DEFAULT_SEED;
  const staleMs = opts.lockStaleMs ?? opts.staleMs ?? LEDGER_LOCK_STALE_MS;
  // Шаг 1: захват блокировки без ожидания и без скрытых повторов.
  const захват = acquireLedgerLock(ledgerPath, { staleMs });
  if (!захват.ok) return { ok: false, errors: захват.errors, warnings: захват.warnings || [], busy: захват.busy, stale: захват.stale };
  try {
    // Шаги 2–6 внутри блокировки: перечитать журнал, манифест, байты сида и перепроверить всё.
    const проверка = validateEvent(event, { ledgerPath, manifestPath, seedPath });
    if (!проверка.ok) return { ok: false, errors: проверка.errors, warnings: проверка.warnings };
    // Повторная защита: только OBSERVED/OBSERVE и null authorized_by.
    const env = event.envelope;
    if (env.admission_state !== 'OBSERVED' || env.event_kind !== 'OBSERVE') {
      return { ok: false, errors: ['append-observed пишет только неизменяемый OBSERVED'], warnings: проверка.warnings };
    }
    if (env.authorized_by !== undefined && env.authorized_by !== null) {
      return { ok: false, errors: ['append-observed требует authorized_by null/отсутствует'], warnings: проверка.warnings };
    }
    // Шаг 7: дописывание ровно одной строки с обязательным fsync (append-only, без перезаписи).
    // Частичная запись или сбой fsync означают отказ с закрытием, а не успех.
    // Скрытый откат усечением запрещён: при сбое долговечности требуется перепроверка журнала.
    const строка = JSON.stringify(event) + '\n';
    const ожидалосьБайт = Buffer.byteLength(строка, 'utf8');
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    let дескриптор = null;
    try {
      дескриптор = fs.openSync(ledgerPath, 'a');
      const записаноБайт = fs.writeSync(дескриптор, строка, null, 'utf8');
      if (записаноБайт !== ожидалосьБайт) {
        return { ok: false, errors: [`LEDGER_DURABILITY_ERROR: частичная запись ${записаноБайт} из ${ожидалосьБайт} байт. Отказ с закрытием, скрытый откат запрещён. Требуется перепроверка журнала перед следующим дописыванием.`], warnings: проверка.warnings, durability: true };
      }
      try {
        fs.fsyncSync(дескриптор);
      } catch (ошибкаФсинк) {
        return { ok: false, errors: [`LEDGER_DURABILITY_ERROR: сбой fsync после записи ${записаноБайт} байт: ${String(ошибкаФсинк && ошибкаФсинк.message || ошибкаФсинк)}. Байты могли быть физически записаны, но долговечность не подтверждена. Отказ с закрытием, скрытый откат запрещён. Требуется перепроверка журнала перед следующим дописыванием.`], warnings: проверка.warnings, durability: true };
      }
    } catch (e) {
      return { ok: false, errors: [`журнал: невозможно дописать строку: ${String(e && e.message || e)}`], warnings: проверка.warnings };
    } finally {
      if (дескриптор !== null) { try { fs.closeSync(дескриптор); } catch (ошибкаЗакрытия) { void ошибкаЗакрытия; } }
    }
    return { ok: true, errors: [], warnings: проверка.warnings, event_id: env.event_id };
  } finally {
    // Шаг 8: освобождение блокировки всегда.
    releaseLedgerLock(захват.lockDir);
  }
}

// Сверка хеша сида с манифестом и проверка цепочки журнала.
export function checkHash(opts = {}) {
  const errors = [];
  const warnings = [];
  const manifestPath = opts.manifestPath || DEFAULT_MANIFEST;
  const seedPath = opts.seedPath || DEFAULT_SEED;
  const ledgerPath = opts.ledgerPath || DEFAULT_LEDGER;
  let manifest = null;
  try { manifest = loadManifest(manifestPath); } catch (e) { return { ok: false, errors: [`манифест не читается: ${String(e && e.message || e)}`], warnings }; }
  let хешСида = null;
  let хешФайлаМанифеста = null;
  try { хешСида = sha256File(seedPath); } catch (e) { errors.push(`сид не читается: ${String(e && e.message || e)}`); }
  try { хешФайлаМанифеста = sha256File(manifestPath); } catch (e) { errors.push(`манифест не читается для хеша: ${String(e && e.message || e)}`); }
  const полеКанона = manifest.canonical_content_sha256;
  if (хешСида && полеКанона !== хешСида) {
    errors.push(`STALE_CANONICAL_HASH: файл сида ${хешСида} не равен manifest.canonical_content_sha256 ${String(полеКанона)}`);
  }
  if (manifest.admission_implementation !== 'ABSENT') {
    errors.push(`манифест: admission_implementation обязан быть ABSENT в М2.1.1, получено ${String(manifest.admission_implementation)}`);
  }
  const журнал = loadLedger(ledgerPath);
  if (!журнал.ok) {
    for (const e of журнал.errors) errors.push(`журнал CONFLICT: ${e}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    seed_sha256: хешСида,
    manifest_canonical_sha256: полеКанона,
    manifest_file_sha256: хешФайлаМанифеста,
    ledger_tip: журнал.tip,
    ledger_lines: журнал.lineCount,
    ledger_bytes: журнал.byteLength,
  };
}

// Чтение события из файла JSON (один объект).
function прочитатьСобытие(путь) {
  const сырьё = fs.readFileSync(путь, 'utf8');
  return JSON.parse(сырьё);
}

// Разбор аргументов вида --ключ значение.
function аргумент(argv, имя, умолчание) {
  const i = argv.indexOf(имя);
  return i >= 0 ? argv[i + 1] : умолчание;
}

// Точка входа интерфейса командной строки.
export function main(argv) {
  const [команда, ...остаток] = argv;
  if (!команда || команда === 'help' || команда === '--help' || команда === '-h') {
    console.log('Использование:');
    console.log('  node tools/memory/ledger_tool.mjs validate-event <событие.json> [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]');
    console.log('  node tools/memory/ledger_tool.mjs append-observed <событие.json> [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]');
    console.log('  node tools/memory/ledger_tool.mjs check-hash [--ledger ПУТЬ] [--manifest ПУТЬ] [--seed ПУТЬ]');
    return 0;
  }
  const путьЖурнала = аргумент(остаток, '--ledger', DEFAULT_LEDGER);
  const путьМанифеста = аргумент(остаток, '--manifest', DEFAULT_MANIFEST);
  const путьСида = аргумент(остаток, '--seed', DEFAULT_SEED);
  if (команда === 'validate-event') {
    const позиционные = остаток.filter(a => !a.startsWith('--') && a !== путьЖурнала && a !== путьМанифеста && a !== путьСида);
    // Более надёжный разбор позиционных: первый аргумент без флага.
    let файл = null;
    for (let i = 0; i < остаток.length; i++) {
      if (остаток[i].startsWith('--')) { i++; continue; }
      файл = остаток[i]; break;
    }
    if (!файл) { console.error('нужен путь <событие.json>'); return 2; }
    void позиционные;
    let событие = null;
    try { событие = прочитатьСобытие(файл); } catch (e) { console.error(`INVALID: файл события не читается: ${String(e && e.message || e)}`); return 1; }
    const итог = validateEvent(событие, { ledgerPath: путьЖурнала, manifestPath: путьМанифеста, seedPath: путьСида });
    итог.warnings.forEach(w => console.log('ПРЕДУПРЕЖДЕНИЕ ' + w));
    итог.errors.forEach(e => console.log('ОШИБКА ' + e));
    console.log(итог.ok ? 'VALID' : 'INVALID');
    return итог.ok ? 0 : 1;
  }
  if (команда === 'append-observed') {
    let файл = null;
    for (let i = 0; i < остаток.length; i++) {
      if (остаток[i].startsWith('--')) { i++; continue; }
      файл = остаток[i]; break;
    }
    if (!файл) { console.error('нужен путь <событие.json>'); return 2; }
    let событие = null;
    try { событие = прочитатьСобытие(файл); } catch (e) { console.error(`REJECTED: файл события не читается: ${String(e && e.message || e)}`); return 1; }
    const итог = appendObserved(событие, { ledgerPath: путьЖурнала, manifestPath: путьМанифеста, seedPath: путьСида });
    итог.warnings.forEach(w => console.log('ПРЕДУПРЕЖДЕНИЕ ' + w));
    итог.errors.forEach(e => console.log('ОШИБКА ' + e));
    console.log(итог.ok ? `APPENDED ${итог.event_id}` : 'REJECTED');
    return итог.ok ? 0 : 1;
  }
  if (команда === 'check-hash') {
    const итог = checkHash({ ledgerPath: путьЖурнала, manifestPath: путьМанифеста, seedPath: путьСида });
    итог.warnings.forEach(w => console.log('ПРЕДУПРЕЖДЕНИЕ ' + w));
    итог.errors.forEach(e => console.log('ОШИБКА ' + e));
    if (итог.ok) {
      console.log(`OK seed=${итог.seed_sha256} ledger_tip=${итог.ledger_tip ?? '(пусто)'} lines=${итог.ledger_lines}`);
      return 0;
    }
    console.log('FAIL');
    return 1;
  }
  console.error('неизвестная команда ' + команда);
  return 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
