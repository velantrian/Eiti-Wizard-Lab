// Тесты журнала М2.1.1: приёмные случаи М2.1 плюс исключающий выбор источника (локально, без моделей).
// Все дописывания идут во временные журналы. Реальные канон, манифест,
// CURRENT_ORIENTATION, паспорт и wiz_ref/рантайм не мутируют.
// Запуск: node --test tools/memory/ledger_tool.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, DEFAULT_SEED, DEFAULT_MANIFEST, DEFAULT_LEDGER, validateEvent, appendObserved, checkHash, loadLedger, sha256File, sha256Bytes, acquireLedgerLock, releaseLedgerLock, ledgerLockDir, LEDGER_LOCK_INFO } from './ledger_tool.mjs';
import { loadSeed, loadSeed as загрузитьСид } from './seed_tool.mjs';

// Базовый коммит вехи М1 (только формат 40 hex проверяется в М2.1.1).
const БАЗОВЫЙ_КОММИТ = 'b8db5d7e16a23832ee1b2695d26c9c6bbbec33f7';

// Чтение текущего канонического хеша из манифеста.
function каноническийХеш() {
  return JSON.parse(fs.readFileSync(DEFAULT_MANIFEST, 'utf8')).canonical_content_sha256;
}

// Создание временного пустого журнала.
function временныйЖурнал() {
  const каталог = fs.mkdtempSync(path.join(os.tmpdir(), 'журнал-м21-'));
  return path.join(каталог, 'event_ledger.jsonl');
}

// Запись события в файл JSON для тестов интерфейса (если нужно).
function записатьСобытие(каталог, имя, событие) {
  const путь = path.join(каталог, имя);
  fs.writeFileSync(путь, JSON.stringify(событие, null, 2));
  return путь;
}

// Допустимая запись-кандидат (только ключи сида, без authority/evidence/confidence/validity).
function допустимаяЗапись(ид = 'OBS-M2-0001') {
  return {
    id: ид,
    type: 'OPEN_QUESTION',
    statement: 'Наблюдение журнала М2.1: пример вопроса без учётных данных и приватных ссылок.',
    status: 'OPEN',
    source: 'SRC-USER-2026-09-29',
    source_kind: 'USER_STATEMENT',
    scope: 'наблюдение',
    provenance: 'USER_STATEMENT_2026-09-29',
    valid_from: '2026-10-01',
    updated_at: '2026-10-01',
    details_pointer: 'карантинное наблюдение, не канон',
    relations: [{ rel: 'RELATED_TO', target: 'OQ-01' }],
    related_to: [],
    supersedes: null,
    superseded_by: null,
    keywords: 'наблюдение пример журнал',
  };
}

// Допустимый конверт OBSERVED от писателя ИИ.
function допустимыйКонверт(идСобытия = 'evt-m2-1-0001', prior = null, переопределения = {}) {
  return {
    event_id: идСобытия,
    timestamp: '2026-10-01T09:30:00+02:00',
    admission_state: 'OBSERVED',
    event_kind: 'OBSERVE',
    source_actor: 'HUMAN:ruslan',
    recorded_by: 'AI:eiti-wizard-m2.1',
    authorized_by: null,
    base_canonical_sha256: каноническийХеш(),
    base_commit_sha: БАЗОВЫЙ_КОММИТ,
    prior_event_id: prior,
    writer_mode: 'READ_WRITE_PR',
    ...переопределения,
  };
}

// Допустимое событие целиком.
function допустимоеСобытие(идСобытия = 'evt-m2-1-0001', идЗаписи = 'OBS-M2-0001', prior = null, переопределенияКонверта = {}, переопределенияЗаписи = {}) {
  return {
    envelope: допустимыйКонверт(идСобытия, prior, переопределенияКонверта),
    record: { ...допустимаяЗапись(идЗаписи), ...переопределенияЗаписи },
  };
}

// Допустимый событийно-локальный источник Пути Б (без регистрации в сиде).
function допустимыйНаблюдаемыйИсточник(переопределения = {}) {
  return {
    kind: 'CHAT_OBSERVATION',
    label: 'Наблюдение из рабочего чата от 2026-10-01',
    surface_class: 'chat',
    provenance_status: 'UNREGISTERED_EVENT_LOCAL',
    ...переопределения,
  };
}

// Допустимая запись Пути Б: без source/source_kind, с observed_source и происхождением USER_RAW.
function допустимаяЗаписьПутьБ(ид = 'OBS-M2-1001', переопределенияНабл = {}, переопределенияЗаписи = {}) {
  return {
    id: ид,
    type: 'OPEN_QUESTION',
    statement: 'Наблюдение журнала М2.1.1 Пути Б: пример без учётных данных и приватных ссылок.',
    status: 'OPEN',
    observed_source: допустимыйНаблюдаемыйИсточник(переопределенияНабл),
    scope: 'наблюдение',
    provenance: 'USER_RAW',
    valid_from: '2026-10-01',
    updated_at: '2026-10-01',
    details_pointer: 'карантинное наблюдение, не канон',
    relations: [{ rel: 'RELATED_TO', target: 'OQ-01' }],
    related_to: [],
    supersedes: null,
    superseded_by: null,
    keywords: 'наблюдение путь-б журнал',
    ...переопределенияЗаписи,
  };
}

// Допустимое событие Пути Б целиком.
function допустимоеСобытиеПутьБ(идСобытия = 'evt-m2-1-1-0001', идЗаписи = 'OBS-M2-1001', prior = null, переопределенияКонверта = {}, переопределенияНабл = {}, переопределенияЗаписи = {}) {
  return {
    envelope: допустимыйКонверт(идСобытия, prior, переопределенияКонверта),
    record: допустимаяЗаписьПутьБ(идЗаписи, переопределенияНабл, переопределенияЗаписи),
  };
}

// Размер временного журнала (байты и строки).
function размерЖурнала(путь) {
  if (!fs.existsSync(путь)) return { байты: 0, строки: 0 };
  const сырьё = fs.readFileSync(путь, 'utf8');
  if (сырьё === '') return { байты: 0, строки: 0 };
  return { байты: Buffer.byteLength(сырьё, 'utf8'), строки: сырьё.trim().split('\n').length };
}

// Снимок хешей реальных файлов (канон, манифест, выжимка, рантайм, журнал).
function снимокРеальныхФайлов() {
  const файлы = [
    DEFAULT_SEED,
    DEFAULT_MANIFEST,
    path.join(ROOT, 'docs', 'memory', 'CURRENT_ORIENTATION.md'),
    path.join(ROOT, 'docs', 'memory', 'RUSLAN_ORIENTATION_PASSPORT.md'),
    path.join(ROOT, 'wiz-ref-memory.js'),
    path.join(ROOT, 'index.html'),
    path.join(ROOT, 'sw.js'),
  ];
  const хеши = {};
  for (const ф of файлы) хеши[ф] = sha256File(ф);
  const журнал = fs.existsSync(DEFAULT_LEDGER) ? fs.readFileSync(DEFAULT_LEDGER, 'utf8') : null;
  return { хеши, журнал };
}

// ── 1. Допустимое дописывание OBSERVED от ИИ ────────────────────────────────
test('1: допустимое дописывание OBSERVED от ИИ проходит и добавляет одну строку', () => {
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытие();
  const проверка = validateEvent(событие, { ledgerPath: журнал });
  assert.equal(проверка.ok, true, 'валидация: ' + проверка.errors.join(' | '));
  const итог = appendObserved(событие, { ledgerPath: журнал });
  assert.equal(итог.ok, true, 'дописывание: ' + итог.errors.join(' | '));
  assert.equal(итог.event_id, 'evt-m2-1-0001');
  const размер = размерЖурнала(журнал);
  assert.equal(размер.строки, 1);
  const строка = fs.readFileSync(журнал, 'utf8').trim();
  assert.deepEqual(JSON.parse(строка), событие);
  const состояние = loadLedger(журнал);
  assert.equal(состояние.ok, true);
  assert.equal(состояние.tip, 'evt-m2-1-0001');
});

// ── 2. Неизменяемое дописывание ─────────────────────────────────────────────
test('2: дописывание неизменяемо — первая строка не меняется после второй', () => {
  const журнал = временныйЖурнал();
  const первое = допустимоеСобытие('evt-m2-1-0001', 'OBS-M2-0001', null);
  const итог1 = appendObserved(первое, { ledgerPath: журнал });
  assert.equal(итог1.ok, true);
  const снимок = fs.readFileSync(журнал, 'utf8');
  const второе = допустимоеСобытие('evt-m2-1-0002', 'OBS-M2-0002', 'evt-m2-1-0001');
  // Вторая метка раньше первой: порядок задаёт цепочка, а не время.
  второе.envelope.timestamp = '2026-10-01T09:25:00+02:00';
  const итог2 = appendObserved(второе, { ledgerPath: журнал });
  assert.equal(итог2.ok, true);
  const после = fs.readFileSync(журнал, 'utf8');
  assert.ok(после.startsWith(снимок), 'префикс журнала обязан сохраниться байт в байт');
  const строки = после.trim().split('\n');
  assert.equal(строки.length, 2);
  assert.deepEqual(JSON.parse(строки[0]), первое);
  assert.deepEqual(JSON.parse(строки[1]), второе);
});

// ── 3. Хеш сида не меняется ─────────────────────────────────────────────────
test('3: хеш сида не меняется после операций журнала', () => {
  const до = sha256File(DEFAULT_SEED);
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытие('evt-m2-1-0003', 'OBS-M2-0003', null);
  assert.equal(validateEvent(событие, { ledgerPath: журнал }).ok, true);
  assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
  assert.equal(checkHash({ ledgerPath: журнал }).ok, true);
  const после = sha256File(DEFAULT_SEED);
  assert.equal(после, до);
  assert.equal(после, каноническийХеш());
});

// ── 4. Манифест не меняется ─────────────────────────────────────────────────
test('4: манифест не меняется, admission_implementation остаётся ABSENT', () => {
  const доБайты = fs.readFileSync(DEFAULT_MANIFEST, 'utf8');
  const доХеш = sha256Bytes(доБайты);
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытие('evt-m2-1-0004', 'OBS-M2-0004', null);
  assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
  const послеБайты = fs.readFileSync(DEFAULT_MANIFEST, 'utf8');
  assert.equal(послеБайты, доБайты);
  assert.equal(sha256Bytes(послеБайты), доХеш);
  assert.equal(JSON.parse(послеБайты).admission_implementation, 'ABSENT');
});

// ── 5. CURRENT_ORIENTATION не меняется ──────────────────────────────────────
test('5: CURRENT_ORIENTATION.md не меняется', () => {
  const путь = path.join(ROOT, 'docs', 'memory', 'CURRENT_ORIENTATION.md');
  const до = sha256File(путь);
  const журнал = временныйЖурнал();
  assert.equal(appendObserved(допустимоеСобытие('evt-m2-1-0005', 'OBS-M2-0005', null), { ledgerPath: журнал }).ok, true);
  assert.equal(sha256File(путь), до);
});

// ── 6. wiz_ref и рантайм не тронуты ─────────────────────────────────────────
test('6: wiz_ref и рантайм не тронуты', () => {
  const файлы = ['wiz-ref-memory.js', 'index.html', 'sw.js'].map(f => path.join(ROOT, f));
  const до = файлы.map(f => sha256File(f));
  const журнал = временныйЖурнал();
  assert.equal(appendObserved(допустимоеСобытие('evt-m2-1-0006', 'OBS-M2-0006', null), { ledgerPath: журнал }).ok, true);
  assert.equal(validateEvent(допустимоеСобытие('evt-m2-1-0007', 'OBS-M2-0007', 'evt-m2-1-0006'), { ledgerPath: журнал }).ok, true);
  const после = файлы.map(f => sha256File(f));
  assert.deepEqual(после, до);
});

// ── 7. Устаревший хеш канона отклоняется ────────────────────────────────────
test('7: устаревший base_canonical_sha256 отклоняется, журнал не меняется', () => {
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытие('evt-m2-1-0007', 'OBS-M2-0007', null, { base_canonical_sha256: '0'.repeat(64) });
  const проверка = validateEvent(событие, { ledgerPath: журнал });
  assert.equal(проверка.ok, false);
  assert.ok(проверка.errors.some(e => e.includes('STALE_CANONICAL_HASH')), проверка.errors.join(' | '));
  const итог = appendObserved(событие, { ledgerPath: журнал });
  assert.equal(итог.ok, false);
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  // Запрещённое имя base_manifest_hash также отклоняется.
  const плохоеИмя = допустимоеСобытие('evt-m2-1-0008', 'OBS-M2-0008', null);
  плохоеИмя.envelope.base_manifest_hash = плохоеИмя.envelope.base_canonical_sha256;
  delete плохоеИмя.envelope.base_canonical_sha256;
  const проверкаИмени = validateEvent(плохоеИмя, { ledgerPath: журнал });
  assert.equal(проверкаИмени.ok, false);
  assert.ok(проверкаИмени.errors.some(e => e.includes('base_manifest_hash')), проверкаИмени.errors.join(' | '));
  // Опциональный неверный хеш файла манифеста отклоняется.
  const плохойМанифест = допустимоеСобытие('evt-m2-1-0009', 'OBS-M2-0009', null, { base_manifest_file_sha256: 'f'.repeat(64) });
  const проверкаМанифеста = validateEvent(плохойМанифест, { ledgerPath: журнал });
  assert.equal(проверкаМанифеста.ok, false);
  assert.ok(проверкаМанифеста.errors.some(e => e.includes('STALE_MANIFEST_FILE_HASH')), проверкаМанифеста.errors.join(' | '));
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
});

// ── 8. Неверные перечисления отклоняются ────────────────────────────────────
test('8: неверные перечисления отклоняются до дописывания', () => {
  const случаи = [
    ['неверный type', с => { с.record.type = 'FACT'; }],
    ['неверный status', с => { с.record.status = 'TRUE'; }],
    ['неверный provenance', с => { с.record.provenance = 'BELIEF'; }],
    ['неверный rel', с => { с.record.relations = [{ rel: 'CAUSES', target: 'OQ-01' }]; }],
    ['неверный admission_state', с => { с.envelope.admission_state = 'BOGUS'; }],
    ['неверный event_kind', с => { с.envelope.event_kind = 'BOGUS'; }],
    ['неверный writer_mode', с => { с.envelope.writer_mode = 'READ_WRITE_DIRECT'; }],
    ['неизвестный источник', с => { с.record.source = 'SRC-NOT-REGISTERED'; }],
    ['несоответствие source_kind', с => { с.record.source_kind = 'NOTION_PAGE'; }],
    ['висячая цель связи', с => { с.record.relations = [{ rel: 'RELATED_TO', target: 'NOPE-99' }]; }],
    ['неизвестный ключ записи', с => { с.record.неизвестное_поле = 'x'; }],
    ['неизвестный ключ конверта', с => { с.envelope.неизвестное_поле = 'x'; }],
  ];
  for (const [название, мутация] of случаи) {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m2-1-1000', 'OBS-M2-1000', null);
    мутация(событие);
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false, название + ': ' + проверка.errors.join(' | '));
    const итог = appendObserved(событие, { ledgerPath: журнал });
    assert.equal(итог.ok, false, название);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 }, название);
  }
});

// ── 9. Карантин отклоняется до дописывания ──────────────────────────────────
test('9: карантинные входы отклоняются до дописывания', () => {
  const случаи = [
    ['учётные данные api_key', с => { с.record.statement = 'пример с api_key=sk-abc123XYZ4567890 внутри'; }, 'QUARANTINE_CREDENTIAL'],
    ['токен Bearer', с => { с.record.details_pointer = 'пример Bearer abcdef1234567890XYZ'; }, 'QUARANTINE_CREDENTIAL'],
    ['пароль', с => { с.record.statement = 'пример password: hunter2-hunter2 внутри'; }, 'QUARANTINE_CREDENTIAL'],
    ['приватный локатор notion', с => { с.record.details_pointer = 'смотреть https://notion.so/abc123 внутри'; }, 'QUARANTINE_PRIVATE_LOCATOR'],
    ['приватный локатор drive', с => { с.record.statement = 'смотреть https://drive.google.com/file/d/abc внутри'; }, 'QUARANTINE_PRIVATE_LOCATOR'],
    ['запрещённый ключ authority', с => { с.record.authority = 'HIGH'; }, 'QUARANTINE_FORBIDDEN_KEYS'],
    ['запрещённый ключ evidence', с => { с.record.evidence = 'doc'; }, 'QUARANTINE_FORBIDDEN_KEYS'],
    ['запрещённый ключ confidence', с => { с.record.confidence = 0.9; }, 'QUARANTINE_FORBIDDEN_KEYS'],
    ['запрещённый ключ validity', с => { с.record.validity = 'now'; }, 'QUARANTINE_FORBIDDEN_KEYS'],
  ];
  for (const [название, мутация, метка] of случаи) {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m2-1-2000', 'OBS-M2-2000', null);
    мутация(событие);
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false, название);
    assert.ok(проверка.errors.some(e => e.includes(метка)), название + ': ' + проверка.errors.join(' | '));
    const итог = appendObserved(событие, { ledgerPath: журнал });
    assert.equal(итог.ok, false, название);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 }, название);
  }
});

// ── 10. Попытка ADMIT от ИИ отклоняется ─────────────────────────────────────
test('10: попытка ADMIT от ИИ отклоняется (ИИ не допускает в канон)', () => {
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытие('evt-m2-1-3000', 'OBS-M2-3000', null, { admission_state: 'ADMITTED', event_kind: 'ADMIT' });
  // Писатель остаётся ИИ.
  assert.ok(событие.envelope.recorded_by.startsWith('AI:'));
  const проверка = validateEvent(событие, { ledgerPath: журнал });
  assert.equal(проверка.ok, false);
  assert.ok(проверка.errors.some(e => e.includes('AI_MAY_NOT_ADMIT') || e.includes('ADMISSION_IMPLEMENTATION_ABSENT')), проверка.errors.join(' | '));
  const итог = appendObserved(событие, { ledgerPath: журнал });
  assert.equal(итог.ok, false);
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  // Любой ADMIT отклоняется и от человека, пока реализация отсутствует.
  const человек = допустимоеСобытие('evt-m2-1-3001', 'OBS-M2-3001', null, {
    admission_state: 'ADMITTED', event_kind: 'ADMIT', source_actor: 'SYSTEM:cron', recorded_by: 'HUMAN:ruslan',
  });
  const проверкаЧеловека = validateEvent(человек, { ledgerPath: журнал });
  assert.equal(проверкаЧеловека.ok, false);
  assert.ok(проверкаЧеловека.errors.some(e => e.includes('ADMISSION_IMPLEMENTATION_ABSENT')), проверкаЧеловека.errors.join(' | '));
});

// ── 11. authorized_by для OBSERVED ──────────────────────────────────────────
test('11: authorized_by для OBSERVED обязан быть null/отсутствовать', () => {
  const журнал = временныйЖурнал();
  const плохое = допустимоеСобытие('evt-m2-1-4000', 'OBS-M2-4000', null, { authorized_by: 'HUMAN:ruslan' });
  const проверкаПлохого = validateEvent(плохое, { ledgerPath: журнал });
  assert.equal(проверкаПлохого.ok, false);
  assert.ok(проверкаПлохого.errors.some(e => e.includes('authorized_by')), проверкаПлохого.errors.join(' | '));
  assert.equal(appendObserved(плохое, { ledgerPath: журнал }).ok, false);
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  // Вариант с null проходит.
  const сНулём = допустимоеСобытие('evt-m2-1-4001', 'OBS-M2-4001', null, { authorized_by: null });
  assert.equal(validateEvent(сНулём, { ledgerPath: журнал }).ok, true);
  // Вариант без ключа проходит.
  const безКлюча = допустимоеСобытие('evt-m2-1-4002', 'OBS-M2-4002', null);
  delete безКлюча.envelope.authorized_by;
  assert.equal(validateEvent(безКлюча, { ledgerPath: журнал }).ok, true);
});

// ── 12. Разделение актёров ──────────────────────────────────────────────────
test('12: разделение актёров — source_actor обязан отличаться от recorded_by', () => {
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытие('evt-m2-1-5000', 'OBS-M2-5000', null, { source_actor: 'AI:eiti-wizard-m2.1', recorded_by: 'AI:eiti-wizard-m2.1' });
  const проверка = validateEvent(событие, { ledgerPath: журнал });
  assert.equal(проверка.ok, false);
  assert.ok(проверка.errors.some(e => e.includes('ACTOR_SEPARATION')), проверка.errors.join(' | '));
  assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
});

// ── 13. Форк и malformed цепочка с закрытием ────────────────────────────────
test('13: malformed цепочка и форк приводят к отказу с закрытием', () => {
  // Случай а: разрыв prior_event_id.
  {
    const журнал = временныйЖурнал();
    assert.equal(appendObserved(допустимоеСобытие('evt-m2-1-6001', 'OBS-M2-6001', null), { ledgerPath: журнал }).ok, true);
    const разрыв = допустимоеСобытие('evt-m2-1-6002', 'OBS-M2-6002', 'evt-unknown-prior');
    fs.appendFileSync(журнал, JSON.stringify(разрыв) + '\n', 'utf8');
    const проверкаЦелого = checkHash({ ledgerPath: журнал });
    assert.equal(проверкаЦелого.ok, false);
    assert.ok(проверкаЦелого.errors.some(e => e.includes('CONFLICT') || e.includes('CHAIN') || e.includes('prior')), проверкаЦелого.errors.join(' | '));
    const новое = допустимоеСобытие('evt-m2-1-6003', 'OBS-M2-6003', 'evt-m2-1-6002');
    assert.equal(validateEvent(новое, { ledgerPath: журнал }).ok, false);
    assert.equal(appendObserved(новое, { ledgerPath: журнал }).ok, false);
  }
  // Случай б: дубликат event_id.
  {
    const журнал = временныйЖурнал();
    assert.equal(appendObserved(допустимоеСобытие('evt-m2-1-6101', 'OBS-M2-6101', null), { ledgerPath: журнал }).ok, true);
    const дубликат = допустимоеСобытие('evt-m2-1-6101', 'OBS-M2-6102', 'evt-m2-1-6101');
    fs.appendFileSync(журнал, JSON.stringify(дубликат) + '\n', 'utf8');
    const проверкаЦелого = checkHash({ ledgerPath: журнал });
    assert.equal(проверкаЦелого.ok, false);
    assert.ok(проверкаЦелого.errors.some(e => e.includes('дубликат') || e.includes('FORK') || e.includes('CONFLICT')), проверкаЦелого.errors.join(' | '));
  }
  // Случай в: malformed JSON-строка.
  {
    const журнал = временныйЖурнал();
    assert.equal(appendObserved(допустимоеСобытие('evt-m2-1-6201', 'OBS-M2-6201', null), { ledgerPath: журнал }).ok, true);
    fs.appendFileSync(журнал, 'не json {{{ \n', 'utf8');
    const проверкаЦелого = checkHash({ ledgerPath: журнал });
    assert.equal(проверкаЦелого.ok, false);
    assert.ok(проверкаЦелого.errors.some(e => e.includes('malformed') || e.includes('CONFLICT')), проверкаЦелого.errors.join(' | '));
    const новое = допустимоеСобытие('evt-m2-1-6202', 'OBS-M2-6202', 'evt-m2-1-6201');
    assert.equal(validateEvent(новое, { ledgerPath: журнал }).ok, false);
  }
  // Случай г: неверный prior у нового события (без порчи журнала).
  {
    const журнал = временныйЖурнал();
    assert.equal(appendObserved(допустимоеСобытие('evt-m2-1-6301', 'OBS-M2-6301', null), { ledgerPath: журнал }).ok, true);
    const неверный = допустимоеСобытие('evt-m2-1-6302', 'OBS-M2-6302', 'evt-wrong-tip');
    const проверка = validateEvent(неверный, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('CHAIN') || e.includes('prior')), проверка.errors.join(' | '));
    assert.equal(appendObserved(неверный, { ledgerPath: журнал }).ok, false);
    assert.equal(размерЖурнала(журнал).строки, 1);
  }
});

// ── Реальный журнал сохраняет целостность append-only ──────────────────────────
test('реальный журнал event_ledger.jsonl сохраняет целостность append-only', () => {
  // Все тесты выше писали только во временные файлы. Реальный журнал может законно
  // содержать настоящие события OBSERVED, поэтому пустота не требуется — требуется целостность.
  const сырьё = fs.existsSync(DEFAULT_LEDGER) ? fs.readFileSync(DEFAULT_LEDGER, 'utf8') : '';
  if (сырьё !== '') {
    assert.equal(сырьё.endsWith('\n'), true, 'непустой журнал обязан завершаться переводом строки');
    const строки = сырьё.split('\n');
    assert.equal(строки[строки.length - 1], '', 'последний фрагмент после финального перевода строки обязан быть пустым');
    for (const [индекс, строка] of строки.slice(0, -1).entries()) {
      assert.notEqual(строка, '', `строка ${индекс + 1} не должна быть пустой`);
      JSON.parse(строка); // malformed строка роняет тест
    }
  }
  const журнал = loadLedger(DEFAULT_LEDGER);
  assert.equal(журнал.ok, true, 'цепочка журнала: ' + журнал.errors.join(' | '));
  if (сырьё !== '') {
    assert.ok(журнал.tip, 'непустой журнал обязан иметь кончик');
    assert.ok(журнал.lineCount > 0, 'непустой журнал обязан содержать строки');
  }
  // Каждое событие реального журнала — только OBSERVED/OBSERVE без authorized_by.
  for (const { parsed } of журнал.events) {
    assert.equal(parsed.envelope.admission_state, 'OBSERVED');
    assert.equal(parsed.envelope.event_kind, 'OBSERVE');
    assert.ok(parsed.envelope.authorized_by === null || parsed.envelope.authorized_by === undefined);
  }
});

// ── Снимок реальных файлов до и после (защита от мутаций) ───────────────────
test('снимок реальных файлов: канон, манифест и рантайм не мутировали', () => {
  const снимок = снимокРеальныхФайлов();
  const журнал = временныйЖурнал();
  assert.equal(appendObserved(допустимоеСобытие('evt-m2-1-7001', 'OBS-M2-7001', null), { ledgerPath: журнал }).ok, true);
  const сид = загрузитьСид();
  assert.equal(сид.records.length, 79);
  const повтор = снимокРеальныхФайлов();
  assert.deepEqual(повтор.хеши, снимок.хеши);
  // Тест писал только во временный журнал: реальный журнал не изменился за время теста.
  // Пустота не требуется — законные события OBSERVED допустимы.
  assert.equal(повтор.журнал, снимок.журнал);
  const проверка = loadLedger(DEFAULT_LEDGER);
  assert.equal(проверка.ok, true, 'цепочка журнала: ' + проверка.errors.join(' | '));
});

// ── 16. Блокировка удерживается: второй писатель получает LEDGER_BUSY ───────
test('16: удержание блокировки даёт LEDGER_BUSY без изменения журнала', () => {
  const журнал = временныйЖурнал();
  // Ручной захват блокировки имитирует параллельного писателя внутри критической секции.
  const захват = acquireLedgerLock(журнал);
  assert.equal(захват.ok, true);
  try {
    const событие = допустимоеСобытие('evt-toctou-busy-001', 'OBS-TOCTOU-BUSY-001', null);
    const итог = appendObserved(событие, { ledgerPath: журнал });
    assert.equal(итог.ok, false);
    assert.ok(итог.errors.some(e => e.includes('LEDGER_BUSY') || e.includes('LOCK_HELD')), итог.errors.join(' | '));
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  } finally {
    releaseLedgerLock(захват.lockDir);
  }
  // После освобождения тот же журнал принимает запись.
  const повтор = допустимоеСобытие('evt-toctou-busy-001', 'OBS-TOCTOU-BUSY-001', null);
  assert.equal(appendObserved(повтор, { ledgerPath: журнал }).ok, true);
  assert.equal(размерЖурнала(журнал).строки, 1);
  assert.equal(loadLedger(журнал).ok, true);
});

// ── 17. Два события с одним prior: побеждает одно ───────────────────────────
test('17: два события с одним prior_event_id — второе отклоняется, строка одна', () => {
  const журнал = временныйЖурнал();
  assert.equal(appendObserved(допустимоеСобытие('evt-toctou-base-001', 'OBS-TOCTOU-BASE-001', null), { ledgerPath: журнал }).ok, true);
  const первый = допустимоеСобытие('evt-toctou-race-a-001', 'OBS-TOCTOU-RACE-A-001', 'evt-toctou-base-001');
  const второй = допустимоеСобытие('evt-toctou-race-b-001', 'OBS-TOCTOU-RACE-B-001', 'evt-toctou-base-001');
  const итог1 = appendObserved(первый, { ledgerPath: журнал });
  assert.equal(итог1.ok, true);
  const итог2 = appendObserved(второй, { ledgerPath: журнал });
  assert.equal(итог2.ok, false);
  assert.ok(итог2.errors.some(e => e.includes('CHAIN') || e.includes('prior') || e.includes('STALE') || e.includes('CONFLICT') || e.includes('LEDGER_BUSY') || e.includes('FORK')), итог2.errors.join(' | '));
  // Журнал структурно допустим, для данного кончика ровно одна новая строка.
  const состояние = loadLedger(журнал);
  assert.equal(состояние.ok, true);
  assert.equal(состояние.lineCount, 2);
  assert.equal(состояние.tip, 'evt-toctou-race-a-001');
  assert.equal(размерЖурнала(журнал).строки, 2);
});

// ── 18. Устаревшая блокировка требует ручного разбора ───────────────────────
test('18: устаревшая блокировка даёт STALE_LOCK_REQUIRES_REVIEW без авто-удаления', () => {
  const журнал = временныйЖурнал();
  const каталогБлокировки = ledgerLockDir(журнал);
  fs.mkdirSync(path.dirname(журнал), { recursive: true });
  fs.mkdirSync(каталогБлокировки);
  // Сведения с древним временем захвата имитируют рухнувший процесс.
  fs.writeFileSync(path.join(каталогБлокировки, LEDGER_LOCK_INFO), JSON.stringify({ pid: 999999, acquiredAt: Date.now() - 3600_000, ledger: журнал }));
  const событие = допустимоеСобытие('evt-toctou-stale-001', 'OBS-TOCTOU-STALE-001', null);
  const итог = appendObserved(событие, { ledgerPath: журнал });
  assert.equal(итог.ok, false);
  assert.ok(итог.errors.some(e => e.includes('STALE_LOCK_REQUIRES_REVIEW')), итог.errors.join(' | '));
  // Блокировка не удалена автоматически, журнал не изменён.
  assert.equal(fs.existsSync(каталогБлокировки), true);
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  // Ручное восстановление: человек удаляет каталог, после чего запись проходит.
  releaseLedgerLock(каталогБлокировки);
  assert.equal(fs.existsSync(каталогБлокировки), false);
  assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
});

// ── 19. Тройная сверка хеша: байты сида, а не только поле манифеста ─────────
test('19: подмена байтов сида отклоняется даже при совпадении поля манифеста', () => {
  const каталог = fs.mkdtempSync(path.join(os.tmpdir(), 'журнал-м21-сид-'));
  const временныйСид = path.join(каталог, 'seed.json');
  const временныйМанифест = path.join(каталог, 'manifest.json');
  const журнал = path.join(каталог, 'event_ledger.jsonl');
  fs.copyFileSync(DEFAULT_SEED, временныйСид);
  fs.copyFileSync(DEFAULT_MANIFEST, временныйМанифест);
  // Портим байты сида одним пробелом: поле манифеста остаётся старым.
  fs.appendFileSync(временныйСид, ' ', 'utf8');
  const событие = допустимоеСобытие('evt-toctou-hash-001', 'OBS-TOCTOU-HASH-001', null);
  // Заявленный хеш совпадает с полем манифеста, но не с байтами.
  assert.equal(событие.envelope.base_canonical_sha256, JSON.parse(fs.readFileSync(временныйМанифест, 'utf8')).canonical_content_sha256);
  const проверка = validateEvent(событие, { ledgerPath: журнал, manifestPath: временныйМанифест, seedPath: временныйСид });
  assert.equal(проверка.ok, false);
  assert.ok(проверка.errors.some(e => e.includes('STALE_CANONICAL_HASH')), проверка.errors.join(' | '));
  assert.equal(appendObserved(событие, { ledgerPath: журнал, manifestPath: временныйМанифест, seedPath: временныйСид }).ok, false);
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  // Реальный сид и манифест не тронуты.
  assert.equal(sha256File(DEFAULT_SEED), каноническийХеш());
});

// Вспомогательное: один параллельный запуск append-observed через дочерний процесс.
function запуститьПисателя(путьИнструмента, путьСобытия, путьЖурнала) {
  return new Promise((решить) => {
    const потомок = spawn(process.execPath, [путьИнструмента, 'append-observed', путьСобытия, '--ledger', путьЖурнала], { stdio: ['ignore', 'pipe', 'pipe'] });
    let вывод = '';
    потомок.stdout.on('data', д => { вывод += String(д); });
    потомок.stderr.on('data', д => { вывод += String(д); });
    потомок.on('close', код => решить({ код, вывод }));
    потомок.on('error', ошибка => решить({ код: 99, вывод: String(ошибка && ошибка.message || ошибка) }));
  });
}

// ── 20. Детерминированная конкуренция через процессы: побеждает один ────────
test('20: конкуренция двух процессов с одним prior — побеждает один, форка нет', async () => {
  const каталог = fs.mkdtempSync(path.join(os.tmpdir(), 'журнал-м21-гонка-'));
  const журнал = path.join(каталог, 'event_ledger.jsonl');
  const путьИнструмента = path.join(ROOT, 'tools', 'memory', 'ledger_tool.mjs');
  assert.equal(appendObserved(допустимоеСобытие('evt-race-base-001', 'OBS-RACE-BASE-001', null), { ledgerPath: журнал }).ok, true);
  const событиеА = допустимоеСобытие('evt-race-a-001', 'OBS-RACE-A-001', 'evt-race-base-001');
  const событиеБ = допустимоеСобытие('evt-race-b-001', 'OBS-RACE-B-001', 'evt-race-base-001');
  const путьА = записатьСобытие(каталог, 'a.json', событиеА);
  const путьБ = записатьСобытие(каталог, 'b.json', событиеБ);
  const итоги = await Promise.all([
    запуститьПисателя(путьИнструмента, путьА, журнал),
    запуститьПисателя(путьИнструмента, путьБ, журнал),
  ]);
  const успехи = итоги.filter(r => r.код === 0);
  const отказы = итоги.filter(r => r.код !== 0);
  assert.equal(успехи.length, 1, 'ровно один победитель: ' + JSON.stringify(итоги));
  assert.equal(отказы.length, 1);
  assert.ok(отказы[0].вывод.includes('REJECTED') || отказы[0].вывод.includes('BUSY') || отказы[0].вывод.includes('CHAIN') || отказы[0].вывод.includes('STALE') || отказы[0].вывод.includes('CONFLICT') || отказы[0].вывод.includes('ОШИБКА'), отказы[0].вывод);
  const состояние = loadLedger(журнал);
  assert.equal(состояние.ok, true, состояние.errors.join(' | '));
  assert.equal(состояние.lineCount, 2);
});

// ── 21. Стресс гонки: выборка параллельных попыток без форков ───────────────
test('21: стресс гонки 30 проб по 5 писателей — 0 форков из 30', async () => {
  const путьИнструмента = path.join(ROOT, 'tools', 'memory', 'ledger_tool.mjs');
  const ПРОБ = 30;
  const ПИСАТЕЛЕЙ = 5;
  let форков = 0;
  let победителейВсего = 0;
  for (let проба = 0; проба < ПРОБ; проба++) {
    const каталог = fs.mkdtempSync(path.join(os.tmpdir(), `журнал-м21-стресс-${проба}-`));
    const журнал = path.join(каталог, 'event_ledger.jsonl');
    const база = `evt-stress-${проба}-base`;
    assert.equal(appendObserved(допустимоеСобытие(база, `OBS-STRESS-${проба}-BASE`, null), { ledgerPath: журнал }).ok, true);
    const запуски = [];
    for (let в = 0; в < ПИСАТЕЛЕЙ; в++) {
      const событие = допустимоеСобытие(`evt-stress-${проба}-w${в}`, `OBS-STRESS-${проба}-W${в}`, база);
      const путьСобытия = записатьСобытие(каталог, `w${в}.json`, событие);
      запуски.push(запуститьПисателя(путьИнструмента, путьСобытия, журнал));
    }
    const итоги = await Promise.all(запуски);
    const успехи = итоги.filter(r => r.код === 0).length;
    победителейВсего += успехи;
    const состояние = loadLedger(журнал);
    if (!состояние.ok) форков++;
    assert.equal(состояние.ok, true, `проба ${проба}: ${состояние.errors.join(' | ')}`);
    // Ровно один победитель на пробу: база плюс одна строка.
    assert.equal(состояние.lineCount, 2, `проба ${проба}: строк ${состояние.lineCount}, успехов ${успехи}`);
    assert.equal(успехи, 1, `проба ${проба}: успехов ${успехи} из ${ПИСАТЕЛЕЙ}`);
  }
  console.log(`  стресс: проб ${ПРОБ}, писателей на пробу ${ПИСАТЕЛЕЙ}, всего попыток ${ПРОБ * ПИСАТЕЛЕЙ}, победителей ${победителейВсего}, форков ${форков}`);
  assert.equal(форков, 0);
});

// ── 22. Сбой fsync и частичная запись означают отказ, а не успех ────────────
test('22: принудительный сбой fsync и частичная запись дают отказ без пути успеха', () => {
  // Случай а: сбой fsync после успешной записи.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-durability-fsync-001', 'OBS-DURABILITY-FSYNC-001', null);
    const настоящийФсинк = fs.fsyncSync;
    fs.fsyncSync = () => { throw new Error('принудительный сбой fsync для регрессии'); };
    try {
      const итог = appendObserved(событие, { ledgerPath: журнал });
      assert.equal(итог.ok, false, 'сбой fsync обязан давать отказ');
      assert.ok(итог.errors.some(e => e.includes('LEDGER_DURABILITY_ERROR')), итог.errors.join(' | '));
      assert.equal(итог.event_id, undefined, 'путь успеха запрещён: event_id отсутствует при отказе');
      assert.notEqual(итог.ok, true);
      // Байты могли быть физически записаны до сбоя fsync: скрытый откат запрещён,
      // поэтому файл может содержать строку, но успех не сообщается.
      const сырьё = fs.existsSync(журнал) ? fs.readFileSync(журнал, 'utf8') : '';
      assert.ok(сырьё.includes('evt-durability-fsync-001'), 'байты записаны, но долговечность не подтверждена');
    } finally {
      fs.fsyncSync = настоящийФсинк;
    }
  }
  // Случай б: частичная запись (возврат writeSync меньше ожидаемого).
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-durability-partial-001', 'OBS-DURABILITY-PARTIAL-001', null);
    const настоящаяЗапись = fs.writeSync;
    fs.writeSync = () => 1;
    try {
      const итог = appendObserved(событие, { ledgerPath: журнал });
      assert.equal(итог.ok, false, 'частичная запись обязана давать отказ');
      assert.ok(итог.errors.some(e => e.includes('LEDGER_DURABILITY_ERROR')), итог.errors.join(' | '));
      assert.equal(итог.event_id, undefined);
    } finally {
      fs.writeSync = настоящаяЗапись;
    }
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  }
});

// ── 23. Отсутствие завершающего перевода строки блокирует дописывание ──────
test('23: журнал без финального перевода строки отклоняет дописывание без изменения байтов', () => {
  // Случай а: допустимое событие без финального \n.
  const каталог = fs.mkdtempSync(path.join(os.tmpdir(), 'журнал-м21-конец-'));
  const журнал = path.join(каталог, 'event_ledger.jsonl');
  const первое = допустимоеСобытие('evt-newline-base-001', 'OBS-NEWLINE-BASE-001', null);
  fs.writeFileSync(журнал, JSON.stringify(первое), 'utf8');
  const снимокБайт = fs.readFileSync(журнал);
  const состояние = loadLedger(журнал);
  assert.equal(состояние.ok, false);
  assert.ok(состояние.errors.some(e => e.includes('TERMINAL_NEWLINE_MISSING')), состояние.errors.join(' | '));
  assert.ok(состояние.errors.some(e => e.includes('LEDGER_FORMAT_ERROR')), состояние.errors.join(' | '));
  const проверкаЦелого = checkHash({ ledgerPath: журнал });
  assert.equal(проверкаЦелого.ok, false);
  assert.ok(проверкаЦелого.errors.some(e => e.includes('TERMINAL_NEWLINE_MISSING') || e.includes('LEDGER_FORMAT_ERROR')), проверкаЦелого.errors.join(' | '));
  const второе = допустимоеСобытие('evt-newline-next-001', 'OBS-NEWLINE-NEXT-001', 'evt-newline-base-001');
  const проверка = validateEvent(второе, { ledgerPath: журнал });
  assert.equal(проверка.ok, false);
  const итог = appendObserved(второе, { ledgerPath: журнал });
  assert.equal(итог.ok, false);
  assert.ok(итог.errors.some(e => e.includes('TERMINAL_NEWLINE_MISSING') || e.includes('LEDGER_FORMAT_ERROR') || e.includes('CONFLICT')), итог.errors.join(' | '));
  assert.deepEqual(fs.readFileSync(журнал), снимокБайт, 'байты журнала обязаны остаться неизменными');
  // Случай б: обычный журнал с финальным \n принимает дописывание.
  {
    const журнал2 = временныйЖурнал();
    assert.equal(appendObserved(допустимоеСобытие('evt-newline-ok-001', 'OBS-NEWLINE-OK-001', null), { ledgerPath: журнал2 }).ok, true);
    assert.ok(fs.readFileSync(журнал2, 'utf8').endsWith('\n'));
    assert.equal(appendObserved(допустимоеСобытие('evt-newline-ok-002', 'OBS-NEWLINE-OK-002', 'evt-newline-ok-001'), { ledgerPath: журнал2 }).ok, true);
    assert.equal(loadLedger(журнал2).ok, true);
  }
});

// ── 24. Поле манифеста изменено, байты сида прежние — отказ ─────────────────
test('24: несоответствие поля манифеста байтам сида отклоняется', () => {
  const каталог = fs.mkdtempSync(path.join(os.tmpdir(), 'журнал-м21-манифест-'));
  const временныйСид = path.join(каталог, 'seed.json');
  const временныйМанифест = path.join(каталог, 'manifest.json');
  const журнал = path.join(каталог, 'event_ledger.jsonl');
  fs.copyFileSync(DEFAULT_SEED, временныйСид);
  fs.copyFileSync(DEFAULT_MANIFEST, временныйМанифест);
  // Меняем только поле манифеста, байты сида не тронуты.
  const манифест = JSON.parse(fs.readFileSync(временныйМанифест, 'utf8'));
  манифест.canonical_content_sha256 = 'f'.repeat(64);
  fs.writeFileSync(временныйМанифест, JSON.stringify(манифест, null, 2));
  const хешБайтов = sha256File(временныйСид);
  assert.notEqual(хешБайтов, манифест.canonical_content_sha256);
  // Подслучай а: заявленный хеш совпадает с байтами, но не с полем.
  const событиеА = допустимоеСобытие('evt-manifest-mismatch-a-001', 'OBS-MANIFEST-A-001', null);
  assert.equal(событиеА.envelope.base_canonical_sha256, хешБайтов);
  const проверкаА = validateEvent(событиеА, { ledgerPath: журнал, manifestPath: временныйМанифест, seedPath: временныйСид });
  assert.equal(проверкаА.ok, false);
  assert.ok(проверкаА.errors.some(e => e.includes('STALE_CANONICAL_HASH')), проверкаА.errors.join(' | '));
  assert.equal(appendObserved(событиеА, { ledgerPath: журнал, manifestPath: временныйМанифест, seedPath: временныйСид }).ok, false);
  // Подслучай б: заявленный хеш совпадает с полем, но не с байтами.
  const событиеБ = допустимоеСобытие('evt-manifest-mismatch-b-001', 'OBS-MANIFEST-B-001', null, { base_canonical_sha256: 'f'.repeat(64) });
  const проверкаБ = validateEvent(событиеБ, { ledgerPath: журнал, manifestPath: временныйМанифест, seedPath: временныйСид });
  assert.equal(проверкаБ.ok, false);
  assert.ok(проверкаБ.errors.some(e => e.includes('STALE_CANONICAL_HASH')), проверкаБ.errors.join(' | '));
  assert.equal(appendObserved(событиеБ, { ledgerPath: журнал, manifestPath: временныйМанифест, seedPath: временныйСид }).ok, false);
  assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  // Реальные файлы не тронуты.
  assert.equal(sha256File(DEFAULT_SEED), каноническийХеш());
});

// ── 25. М2.1.1 Путь Б: допустимый наблюдаемый источник проходит ─────────────
test('25: Путь Б с допустимым observed_source проходит и дописывается', () => {
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытиеПутьБ('evt-m211-0001', 'OBS-M211-0001', null);
  // Ключи Пути А отсутствуют (нуль не допускается).
  assert.equal('source' in событие.record, false);
  assert.equal('source_kind' in событие.record, false);
  const проверка = validateEvent(событие, { ledgerPath: журнал });
  assert.equal(проверка.ok, true, 'валидация Пути Б: ' + проверка.errors.join(' | '));
  const итог = appendObserved(событие, { ledgerPath: журнал });
  assert.equal(итог.ok, true, 'дописывание Пути Б: ' + итог.errors.join(' | '));
  assert.equal(размерЖурнала(журнал).строки, 1);
  const состояние = loadLedger(журнал);
  assert.equal(состояние.ok, true);
  assert.equal(состояние.tip, 'evt-m211-0001');
  // Путь А без изменений: зарегистрированный источник по-прежнему проходит.
  const журналА = временныйЖурнал();
  assert.equal(validateEvent(допустимоеСобытие('evt-m211-a-001', 'OBS-M211-A-001', null), { ledgerPath: журналА }).ok, true);
  assert.equal(appendObserved(допустимоеСобытие('evt-m211-a-001', 'OBS-M211-A-001', null), { ledgerPath: журналА }).ok, true);
});

// ── 26. М2.1.1 Путь Б: notion и drive с безопасной меткой проходят ──────────
test('26: Путь Б с surface_class notion и drive и безопасной меткой проходит', () => {
  const случаи = [
    ['ноушен без ссылки', { kind: 'NOTION_PAGE', label: 'Заметка из личной базы знаний без ссылки', surface_class: 'notion' }, 'SOURCE_DOC'],
    ['драйв без ссылки', { kind: 'DRIVE_DOC', label: 'Рабочий документ без ссылки и идентификаторов', surface_class: 'drive' }, 'SOURCE_DOC'],
    ['локальный чат', { kind: 'CHAT_OBSERVATION', label: 'Наблюдение из чата без ссылки', surface_class: 'chat' }, 'USER_RAW'],
    ['публичная сеть', { kind: 'PUBLIC_WEB', label: 'Публичная статья без приватной ссылки', surface_class: 'public_web' }, 'SOURCE_DOC'],
    ['иное заявленное', { kind: 'OTHER_DECLARED', label: 'Иной заявленный источник без ссылки', surface_class: 'other' }, 'USER_RAW'],
    ['локальный гитхаб', { kind: 'GITHUB_REPO', label: 'Публичный репозиторий без приватного локатора', surface_class: 'github' }, 'SOURCE_DOC'],
    ['локальный вид', { kind: 'AI_ASSEMBLY', label: 'Сборка модели без ссылки', surface_class: 'local' }, 'AI_SUMMARY'],
  ];
  случаи.forEach(([название, набл, происхождение], индекс) => {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ(`evt-m211-safe-${индекс}`, `OBS-M211-SAFE-${индекс}`, null, {}, набл, { provenance: происхождение });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, true, название + ': ' + проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true, название);
  });
});

// ── 27. М2.1.1 Путь Б: канон не меняется ────────────────────────────────────
test('27: дописывание Пути Б не меняет байты канона и манифеста', () => {
  const доСида = sha256File(DEFAULT_SEED);
  const доМанифеста = fs.readFileSync(DEFAULT_MANIFEST, 'utf8');
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытиеПутьБ('evt-m211-canon-001', 'OBS-M211-CANON-001', null);
  assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
  assert.equal(checkHash({ ledgerPath: журнал }).ok, true);
  assert.equal(sha256File(DEFAULT_SEED), доСида);
  assert.equal(sha256File(DEFAULT_SEED), каноническийХеш());
  assert.equal(fs.readFileSync(DEFAULT_MANIFEST, 'utf8'), доМанифеста);
  assert.equal(JSON.parse(доМанифеста).admission_implementation, 'ABSENT');
});

// ── 28. М2.1.1: голый технический ид без ссылки проходит ────────────────────
test('28: метка Пути Б с голым УУИД без приватной ссылки проходит', () => {
  const журнал = временныйЖурнал();
  const событие = допустимоеСобытиеПутьБ('evt-m211-uuid-001', 'OBS-M211-UUID-001', null, {}, {
    kind: 'OTHER_DECLARED',
    label: 'Ид эксперимента 550e8400-e29b-41d4-a716-446655440000 без ссылки',
    surface_class: 'local',
  });
  const проверка = validateEvent(событие, { ledgerPath: журнал });
  assert.equal(проверка.ok, true, 'голый ид не равен локатору: ' + проверка.errors.join(' | '));
  assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
  // Заявление без дефисов также проходит.
  const журнал2 = временныйЖурнал();
  const событие2 = допустимоеСобытиеПутьБ('evt-m211-uuid-002', 'OBS-M211-UUID-002', null, {}, {
    kind: 'CHAT_OBSERVATION',
    label: 'Наблюдение 550e8400e29b41d4a716446655440000 без ссылки',
    surface_class: 'chat',
  });
  assert.equal(validateEvent(событие2, { ledgerPath: журнал2 }).ok, true);
});

// ── 29. М2.1.1: исключающий выбор отклоняет пусто и обе формы ────────────────
test('29: отсутствие источника и обе формы сразу отклоняются', () => {
  // Случай а: ни одной формы.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m211-xor-001', 'OBS-M211-XOR-001', null);
    delete событие.record.source;
    delete событие.record.source_kind;
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('SOURCE_XOR_REQUIRED')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  }
  // Случай б: обе формы сразу.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m211-xor-002', 'OBS-M211-XOR-002', null);
    событие.record.observed_source = допустимыйНаблюдаемыйИсточник();
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('SOURCE_XOR_BOTH')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  }
  // Случай в: Путь Б с ключом source равным нуль — всё равно обе формы (нуль не допускается).
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ('evt-m211-xor-003', 'OBS-M211-XOR-003', null);
    событие.record.source = null;
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('SOURCE_XOR_BOTH')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
  }
  // Случай г: Путь А неполный (только source без source_kind) — отказ.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m211-xor-004', 'OBS-M211-XOR-004', null);
    delete событие.record.source_kind;
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('source_kind') || e.includes('Путь А')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
  }
});

// ── 30. М2.1.1 Путь А: поддельный алиас отклоняется ──────────────────────────
test('30: поддельный алиас канона и несоответствие вида отклоняются', () => {
  const случаи = [
    ['поддельный алиас', с => { с.record.source = 'SRC-FAKE-2026-10-01'; с.record.source_kind = 'NOTION_PAGE'; }, 'seed.sources'],
    ['несоответствие вида', с => { с.record.source = 'SRC-N-GENESIS'; с.record.source_kind = 'DRIVE_DOC'; }, 'source_kind'],
    ['пустой алиас', с => { с.record.source = ''; }, 'отсутствует'],
  ];
  for (const [название, мутация, метка] of случаи) {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m211-fake-001', 'OBS-M211-FAKE-001', null);
    мутация(событие);
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false, название);
    assert.ok(проверка.errors.some(e => e.includes(метка) || e.includes('source')), название + ': ' + проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false, название);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 }, название);
  }
});

// ── 31. М2.1.1: приватная ссылка в метке и учётные данные отклоняются ────────
test('31: приватный локатор в метке и учётные данные отклоняются', () => {
  const случаи = [
    ['ноушен ссылка в метке', { label: 'смотреть https://notion.so/abc123 внутри' }, 'QUARANTINE_PRIVATE_LOCATOR'],
    ['ноушен сайт в метке', { label: 'смотреть https://example.notion.site/abc внутри' }, 'QUARANTINE_PRIVATE_LOCATOR'],
    ['приложение ноушен в метке', { label: 'смотреть https://app.notion.com/abc внутри' }, 'QUARANTINE_PRIVATE_LOCATOR'],
    ['гугл документы в метке', { label: 'смотреть https://docs.google.com/document/d/abc внутри' }, 'QUARANTINE_PRIVATE_LOCATOR'],
    ['гугл драйв в метке', { label: 'смотреть https://drive.google.com/file/d/abc внутри' }, 'QUARANTINE_PRIVATE_LOCATOR'],
    ['учётные данные в метке', { label: 'пример с api_key=sk-abc123XYZ4567890 внутри' }, 'QUARANTINE_CREDENTIAL'],
    ['токен в метке', { label: 'пример token: abcdef1234567890XYZ внутри' }, 'QUARANTINE_CREDENTIAL'],
  ];
  for (const [название, набл, метка] of случаи) {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ('evt-m211-quarantine-001', 'OBS-M211-QUARANTINE-001', null, {}, набл);
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false, название);
    assert.ok(проверка.errors.some(e => e.includes(метка)), название + ': ' + проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false, название);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 }, название);
  }
  // Учётные данные в заявлении Пути Б также отклоняются.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ('evt-m211-quarantine-002', 'OBS-M211-QUARANTINE-002', null, {}, {}, { statement: 'пример password: hunter2-hunter2 внутри' });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('QUARANTINE_CREDENTIAL')), проверка.errors.join(' | '));
  }
});

// ── 32. М2.1.1 Путь Б: неверные перечисления и ключи отклоняются ─────────────
test('32: неверные kind, surface, provenance_status и ключи Пути Б отклоняются', () => {
  const случаи = [
    ['неверный kind', с => { с.record.observed_source.kind = 'FAKE_KIND'; }, 'kind'],
    ['неверный surface_class', с => { с.record.observed_source.surface_class = 'мессенджер'; }, 'surface_class'],
    ['неверный provenance_status', с => { с.record.observed_source.provenance_status = 'VERIFIED'; }, 'provenance_status'],
    ['пустая метка', с => { с.record.observed_source.label = ''; }, 'label'],
    ['метка только пробелы', с => { с.record.observed_source.label = '   '; }, 'label'],
    ['метка длиннее 200', с => { с.record.observed_source.label = 'я'.repeat(201); }, 'label'],
    ['метка не строка', с => { с.record.observed_source.label = 42; }, 'label'],
    ['отсутствует kind', с => { delete с.record.observed_source.kind; }, 'отсутствует'],
    ['лишний ключ alias', с => { с.record.observed_source.alias = 'SRC-FAKE'; }, 'запрещённый'],
    ['лишний ключ url', с => { с.record.observed_source.url = 'https://example.com'; }, 'запрещённый'],
    ['лишний ключ page_id', с => { с.record.observed_source.page_id = 'abc123'; }, 'запрещённый'],
    ['лишний ключ file_id', с => { с.record.observed_source.file_id = 'abc123'; }, 'запрещённый'],
    ['лишний ключ document_id', с => { с.record.observed_source.document_id = 'abc123'; }, 'запрещённый'],
    ['лишний ключ title', с => { с.record.observed_source.title = 'Название'; }, 'запрещённый'],
    ['лишний ключ notion_page', с => { с.record.observed_source.notion_page = 'x'; }, 'запрещённый'],
    ['лишний ключ drive_file', с => { с.record.observed_source.drive_file = 'x'; }, 'запрещённый'],
    ['лишний ключ token', с => { с.record.observed_source.token = 'abc'; }, 'запрещённый'],
    ['лишний ключ reachable', с => { с.record.observed_source.reachable = 'YES'; }, 'запрещённый'],
    ['произвольный лишний ключ', с => { с.record.observed_source.лишний = 'x'; }, 'неизвестный ключ'],
    ['не объект', с => { с.record.observed_source = 'строка'; }, 'объектом'],
    ['нуль вместо объекта', с => { с.record.observed_source = null; }, 'объектом'],
  ];
  for (const [название, мутация, метка] of случаи) {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ('evt-m211-enum-001', 'OBS-M211-ENUM-001', null);
    мутация(событие);
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false, название);
    assert.ok(проверка.errors.some(e => e.includes(метка) || e.includes('observed_source')), название + ': ' + проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false, название);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 }, название);
  }
  // Границы метки: 1 и 200 проходят, 0 и 201 отклоняются (границы уже проверены выше частично).
  {
    const журнал = временныйЖурнал();
    const событие1 = допустимоеСобытиеПутьБ('evt-m211-bound-001', 'OBS-M211-BOUND-001', null, {}, { label: 'я' });
    assert.equal(validateEvent(событие1, { ledgerPath: журнал }).ok, true);
    const событие200 = допустимоеСобытиеПутьБ('evt-m211-bound-002', 'OBS-M211-BOUND-002', null, {}, { label: 'я'.repeat(200) });
    assert.equal(validateEvent(событие200, { ledgerPath: временныйЖурнал() }).ok, true);
  }
});

// ── 33. М2.1.1: согласованность происхождения для обоих путей ────────────────
test('33: происхождение USER_STATEMENT требует вида USER_STATEMENT на обоих путях', () => {
  // Путь А: верный вид проходит, неверный отклоняется.
  {
    const журнал = временныйЖурнал();
    const верное = допустимоеСобытие('evt-m211-prov-a-001', 'OBS-M211-PROV-A-001', null);
    assert.equal(верное.record.provenance, 'USER_STATEMENT_2026-09-29');
    assert.equal(верное.record.source_kind, 'USER_STATEMENT');
    assert.equal(validateEvent(верное, { ledgerPath: журнал }).ok, true);
    const журнал2 = временныйЖурнал();
    const неверное = допустимоеСобытие('evt-m211-prov-a-002', 'OBS-M211-PROV-A-002', null, {}, { source: 'SRC-N-GENESIS', source_kind: 'NOTION_PAGE' });
    assert.equal(неверное.record.provenance, 'USER_STATEMENT_2026-09-29');
    const проверка = validateEvent(неверное, { ledgerPath: журнал2 });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('USER_STATEMENT')), проверка.errors.join(' | '));
  }
  // Путь Б: верный вид проходит, неверный отклоняется.
  {
    const журнал = временныйЖурнал();
    const верное = допустимоеСобытиеПутьБ('evt-m211-prov-b-001', 'OBS-M211-PROV-B-001', null, {}, { kind: 'USER_STATEMENT', label: 'Заявление пользователя без ссылки', surface_class: 'local' }, { provenance: 'USER_STATEMENT_2026-09-29' });
    assert.equal(validateEvent(верное, { ledgerPath: журнал }).ok, true);
    const журнал2 = временныйЖурнал();
    const неверное = допустимоеСобытиеПутьБ('evt-m211-prov-b-002', 'OBS-M211-PROV-B-002', null, {}, { kind: 'CHAT_OBSERVATION' }, { provenance: 'USER_STATEMENT_2026-09-29' });
    const проверка = validateEvent(неверное, { ledgerPath: журнал2 });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('USER_STATEMENT')), проверка.errors.join(' | '));
    assert.equal(appendObserved(неверное, { ledgerPath: журнал2 }).ok, false);
  }
});

// ── 34. М2.1.1 Путь Б: ADMIT и authorized_by отклоняются ─────────────────────
test('34: Путь Б с ADMIT или не-нуль authorized_by отклоняется', () => {
  // ADMIT от ИИ.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ('evt-m211-admit-001', 'OBS-M211-ADMIT-001', null, { admission_state: 'ADMITTED', event_kind: 'ADMIT' });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('ADMISSION_IMPLEMENTATION_ABSENT') || e.includes('AI_MAY_NOT_ADMIT')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  }
  // ADMIT от человека также отклоняется (реализация отсутствует).
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ('evt-m211-admit-002', 'OBS-M211-ADMIT-002', null, {
      admission_state: 'ADMITTED', event_kind: 'ADMIT', source_actor: 'SYSTEM:cron', recorded_by: 'HUMAN:ruslan',
    });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('ADMISSION_IMPLEMENTATION_ABSENT')), проверка.errors.join(' | '));
  }
  // authorized_by не нуль.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытиеПутьБ('evt-m211-admit-003', 'OBS-M211-ADMIT-003', null, { authorized_by: 'HUMAN:ruslan' });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('authorized_by')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
    assert.deepEqual(размерЖурнала(журнал), { байты: 0, строки: 0 });
  }
});

// ── 35. М2.1.1 Б-01: приватный локатор в envelope.admission_reason отклоняется ──
test('35: приватный локатор в envelope.admission_reason отклоняется, байты журнала неизменны', () => {
  const случаи = [
    ['ноушен УРЛ в admission_reason', 'смотреть https://notion.so/abc123def456 внутри'],
    ['гугл документы УРЛ в admission_reason', 'смотреть https://docs.google.com/document/d/abc123 внутри'],
    ['гугл драйв УРЛ в admission_reason', 'смотреть https://drive.google.com/file/d/abc123 внутри'],
  ];
  for (const [название, причина] of случаи) {
    const журнал = временныйЖурнал();
    const до = размерЖурнала(журнал);
    const событие = допустимоеСобытие('evt-m211-b01-001', 'OBS-M211-B01-001', null, { admission_reason: причина });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false, название);
    assert.ok(проверка.errors.some(e => e.includes('QUARANTINE_PRIVATE_LOCATOR')), название + ': ' + проверка.errors.join(' | '));
    const итог = appendObserved(событие, { ledgerPath: журнал });
    assert.equal(итог.ok, false, название);
    assert.ok(итог.errors.some(e => e.includes('QUARANTINE_PRIVATE_LOCATOR')), название + ': ' + итог.errors.join(' | '));
    const после = размерЖурнала(журнал);
    assert.deepEqual(после, до, название + ': байты журнала обязаны остаться неизменными');
    assert.deepEqual(после, { байты: 0, строки: 0 }, название);
  }
  // Путь Б: конвертный карантин не зависит от формы источника.
  {
    const журнал = временныйЖурнал();
    const до = размерЖурнала(журнал);
    const событие = допустимоеСобытиеПутьБ('evt-m211-b01-002', 'OBS-M211-B01-002', null, { admission_reason: 'смотреть https://notion.so/abc123 внутри' });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('QUARANTINE_PRIVATE_LOCATOR')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
    assert.deepEqual(размерЖурнала(журнал), до);
  }
  // Голый технический ид в admission_reason без приватного УРЛ-контекста проходит (без глобальной блокировки УУИД).
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m211-b01-allow-001', 'OBS-M211-B01-ALLOW-001', null, { admission_reason: 'Ид эксперимента 550e8400-e29b-41d4-a716-446655440000 без ссылки' });
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, true, 'голый УУИД в конверте не равен локатору: ' + проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
    assert.equal(размерЖурнала(журнал).строки, 1);
  }
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m211-b01-allow-002', 'OBS-M211-B01-ALLOW-002', null, { admission_reason: 'Технический ид TECH-2026-001 без ссылки' });
    assert.equal(validateEvent(событие, { ledgerPath: журнал }).ok, true);
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
  }
});

// ── 36. М2.1.1 Б-02: точные ключи relations[] — только rel и target ──────────
test('36: лишний ключ в relations[] отклоняется, байты журнала неизменны', () => {
  const случаи = [
    ['лишний ключ page_id в связи', 'page_id', 'abc123def456'],
    ['лишний ключ file_id в связи', 'file_id', 'abc123def456'],
    ['лишний ключ document_id в связи', 'document_id', 'abc123def456'],
    ['лишний ключ locator в связи', 'locator', 'alias:SRC-FAKE'],
    ['лишний ключ url в связи', 'url', 'https://example.com/abc'],
    ['лишний ключ token в связи', 'token', 'abc123def456'],
    ['лишний ключ secret в связи', 'secret', 'abc123def456'],
    ['лишний ключ credentials в связи', 'credentials', 'abc123def456'],
  ];
  for (const [название, ключ, значение] of случаи) {
    const журнал = временныйЖурнал();
    const до = размерЖурнала(журнал);
    const событие = допустимоеСобытие('evt-m211-b02-001', 'OBS-M211-B02-001', null);
    событие.record.relations = [{ rel: 'RELATED_TO', target: 'OQ-01', [ключ]: значение }];
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false, название);
    assert.ok(проверка.errors.some(e => e.includes('запрещённый ключ') || e.includes(ключ)), название + ': ' + проверка.errors.join(' | '));
    const итог = appendObserved(событие, { ledgerPath: журнал });
    assert.equal(итог.ok, false, название);
    const после = размерЖурнала(журнал);
    assert.deepEqual(после, до, название + ': байты журнала обязаны остаться неизменными');
    assert.deepEqual(после, { байты: 0, строки: 0 }, название);
  }
  // Путь Б: точные ключи связи не зависят от формы источника.
  {
    const журнал = временныйЖурнал();
    const до = размерЖурнала(журнал);
    const событие = допустимоеСобытиеПутьБ('evt-m211-b02-002', 'OBS-M211-B02-002', null);
    событие.record.relations = [{ rel: 'RELATED_TO', target: 'OQ-01', page_id: 'abc123' }];
    const проверка = validateEvent(событие, { ledgerPath: журнал });
    assert.equal(проверка.ok, false);
    assert.ok(проверка.errors.some(e => e.includes('запрещённый ключ')), проверка.errors.join(' | '));
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, false);
    assert.deepEqual(размерЖурнала(журнал), до);
  }
  // Допустимая связь только с rel и target по-прежнему проходит.
  {
    const журнал = временныйЖурнал();
    const событие = допустимоеСобытие('evt-m211-b02-allow-001', 'OBS-M211-B02-ALLOW-001', null);
    событие.record.relations = [{ rel: 'RELATED_TO', target: 'OQ-01' }];
    assert.equal(validateEvent(событие, { ledgerPath: журнал }).ok, true);
    assert.equal(appendObserved(событие, { ledgerPath: журнал }).ok, true);
    assert.equal(размерЖурнала(журнал).строки, 1);
  }
});
