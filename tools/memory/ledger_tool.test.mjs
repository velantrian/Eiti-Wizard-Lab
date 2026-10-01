// Тесты журнала М2.1: 13 приёмных случаев (локально, детерминированно, без моделей).
// Все дописывания идут во временные журналы. Реальные канон, манифест,
// CURRENT_ORIENTATION, паспорт и wiz_ref/рантайм не мутируют.
// Запуск: node --test tools/memory/ledger_tool.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, DEFAULT_SEED, DEFAULT_MANIFEST, DEFAULT_LEDGER, validateEvent, appendObserved, checkHash, loadLedger, sha256File, sha256Bytes } from './ledger_tool.mjs';
import { loadSeed, loadSeed as загрузитьСид } from './seed_tool.mjs';

// Базовый коммит вехи М1 (только формат 40 hex проверяется в М2.1).
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

// ── Реальный журнал остаётся пустым ─────────────────────────────────────────
test('реальный журнал event_ledger.jsonl остаётся пустым после тестов', () => {
  // Все тесты выше писали только во временные файлы.
  const сырьё = fs.existsSync(DEFAULT_LEDGER) ? fs.readFileSync(DEFAULT_LEDGER, 'utf8') : '';
  assert.equal(сырьё, '');
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
  assert.equal(повтор.журнал, '');
});
