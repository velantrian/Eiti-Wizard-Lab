// Clean Resume Test v0.1: свежий агент читает ТОЛЬКО эту папку эксперимента
// и восстанавливает проектную непрерывность без LLM.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  КОРЕНЬ_ЭКСПЕРИМЕНТА,
  читатьТолькоЭксперимент,
  загрузитьКартуПамяти,
  извлечьОтветыДляResume,
  списокЧекпоинтов,
  путьВнутриЭксперимента,
} from './parse-memory.mjs';

const ОБЯЗАТЕЛЬНЫЕ_СЕКЦИИ = [
  'ACTIVE_THREADS',
  'RECENT_CHECKPOINTS',
  'OWNER_ASSERTED',
  'MODEL_SUMMARY',
  'OPEN_QUESTIONS',
  'IMPORTANT_DECISIONS',
];

function записатьДоказательство(итог) {
  const каталог = path.join(КОРЕНЬ_ЭКСПЕРИМЕНТА, 'tests', 'results');
  fs.mkdirSync(каталог, { recursive: true });
  const файл = path.join(каталог, 'clean-resume-latest.md');
  const строки = [
    '# Clean Resume Test — результат',
    '',
    `CLEAN_RESUME_TEST=${итог.status}`,
    `RECORDED_AT=${итог.recorded_at}`,
    'EXPERIMENTAL_ONLY=YES',
    'AUTHORITATIVE=NO',
    'CANON=NO',
    'OFFICIAL_MEMORY=NO',
    '',
    '## Извлечённые ответы свежего агента',
    '',
    ...Object.entries(итог.answers).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Проверки',
    '',
    ...итог.checks.map((c) => `- ${c}`),
    '',
  ];
  fs.writeFileSync(файл, строки.join('\n'), 'utf8');
  return файл;
}

test('свежий агент читает только experiments/ruslan-experimental-memory/', () => {
  const картаПуть = path.join(КОРЕНЬ_ЭКСПЕРИМЕНТА, 'RUSLAN_EXPERIMENTAL_MEMORY.md');
  assert.equal(путьВнутриЭксперимента(картаПуть), true);
  const текст = читатьТолькоЭксперимент('RUSLAN_EXPERIMENTAL_MEMORY.md');
  assert.ok(текст.includes('EXPERIMENTAL_ONLY=YES'));

  const вне = path.resolve(КОРЕНЬ_ЭКСПЕРИМЕНТА, '..', '..', 'docs', 'memory', 'README.md');
  assert.equal(путьВнутриЭксперимента(вне), false);
  assert.throws(
    () => читатьТолькоЭксперимент(вне),
    /READ_DENIED_OUTSIDE_EXPERIMENT/,
  );

  const sandbox = path.resolve(
    КОРЕНЬ_ЭКСПЕРИМЕНТА,
    '..',
    'owner-authority-sandbox',
    'README.md',
  );
  assert.equal(путьВнутриЭксперимента(sandbox), false);
  assert.throws(
    () => читатьТолькоЭксперимент(sandbox),
    /READ_DENIED_OUTSIDE_EXPERIMENT/,
  );
});

test('карта содержит обязательные KEY=VALUE и секции', () => {
  const карта = загрузитьКартуПамяти();
  for (const ключ of [
    'CURRENT_PROJECT',
    'CURRENT_THREAD',
    'CURRENT_GOAL',
    'CURRENT_STATUS',
    'LAST_COMPLETED_STEP',
    'CURRENT_BLOCKER',
    'LAST_STOP_POINT',
    'NEXT_BOUNDED_ACTION',
    'EXPERIMENTAL_ONLY',
    'AUTHORITATIVE',
    'CANON',
    'OFFICIAL_MEMORY',
  ]) {
    assert.ok(карта.keys[ключ], `нет ключа ${ключ}`);
  }
  assert.equal(карта.keys.EXPERIMENTAL_ONLY.value, 'YES');
  assert.equal(карта.keys.AUTHORITATIVE.value, 'NO');
  assert.equal(карта.keys.CANON.value, 'NO');
  assert.equal(карта.keys.OFFICIAL_MEMORY.value, 'NO');
  for (const секция of ОБЯЗАТЕЛЬНЫЕ_СЕКЦИИ) {
    assert.ok(карта.sections[секция], `нет секции ${секция}`);
    assert.ok(карта.sections[секция].length > 0, `секция ${секция} пуста`);
  }
});

test('Clean Resume: 5 вопросов свежего агента', () => {
  const карта = загрузитьКартуПамяти();
  const ответы = извлечьОтветыДляResume(карта);
  const проверки = [];

  // 1) что происходит
  assert.match(ответы.current_project, /экспериментальн|continuity memory|непрерывн/i);
  assert.match(ответы.current_thread, /ruslan-experimental-memory|owner review/i);
  assert.match(ответы.current_goal, /сессии|стоп|шаг|памяти/i);
  assert.match(
    ответы.current_status,
    /Creating ruslan-experimental-memory v0\.1.*Clean Resume Test.*draft PR.*OWNER REVIEW/s,
  );
  проверки.push('PASS Q1 current project/thread/goal/status');

  // 2) где остановились
  assert.match(ответы.last_stop_point, /draft PR/i);
  assert.match(ответы.last_stop_point, /Clean Resume Test/i);
  проверки.push('PASS Q2 LAST_STOP_POINT');

  // 3) что уже сделано
  assert.match(
    ответы.last_completed_step,
    /v0\.1|README|checkpoint|Clean Resume Test|experiments\/ruslan-experimental-memory/i,
  );
  const чекпоинты = списокЧекпоинтов();
  assert.ok(чекпоинты.length >= 1, 'нет markdown checkpoint');
  const текстЧекпоинта = читатьТолькоЭксперимент(path.join('checkpoints', чекпоинты[0]));
  assert.match(текстЧекпоинта, /LAST_STOP_POINT|NEXT_BOUNDED_ACTION/);
  assert.match(текстЧекпоинта, /OWNER_ASSERTED|MODEL_SUMMARY/);
  проверки.push(`PASS Q3 LAST_COMPLETED_STEP + checkpoint ${чекпоинты[0]}`);

  // 4) чего не делать
  assert.equal(ответы.do_not_touch_canon, 'YES');
  assert.equal(ответы.do_not_touch_official_memory, 'YES');
  assert.equal(ответы.do_not_merge, 'YES');
  assert.equal(ответы.do_not_mix_owner_authority, 'YES');
  assert.equal(ответы.do_not_add_graph, 'YES');
  assert.equal(ответы.do_not_add_rag, 'YES');
  assert.equal(ответы.do_not_add_sqlite, 'YES');
  assert.equal(ответы.do_not_add_ingestion, 'YES');
  assert.equal(ответы.do_not_add_authority, 'YES');
  assert.equal(ответы.allowed_read_root, 'experiments/ruslan-experimental-memory/');
  const ownerСекция = карта.sections.OWNER_ASSERTED.join('\n');
  assert.match(ownerСекция, /Canon|official docs\/memory|ledger|wiz_ref/i);
  assert.match(ownerСекция, /draft PR|no merge/i);
  assert.match(ownerСекция, /owner-authority-sandbox/i);
  проверки.push('PASS Q4 HARD_DO_NOT Canon/official memory/merge/sandbox/graph-RAG-SQLite-ingestion-authority');

  // 5) следующий ограниченный шаг
  assert.match(ответы.next_bounded_action, /OWNER REVIEW/i);
  assert.match(ответы.next_bounded_action, /read-only/i);
  assert.match(ответы.next_bounded_action, /No v0\.2/i);
  assert.match(ответы.next_bounded_action, /no Canon integration/i);
  assert.match(ответы.next_bounded_action, /no RAG/i);
  assert.equal(ответы.do_not_canon_integration, 'YES');
  assert.equal(ответы.do_not_start_v02, 'YES');
  проверки.push('PASS Q5 NEXT_BOUNDED_ACTION');

  const файл = записатьДоказательство({
    status: 'PASS',
    recorded_at: '2026-10-05T16:20:00+02:00',
    answers: ответы,
    checks: проверки,
  });
  assert.equal(путьВнутриЭксперимента(файл), true);
  const доказательство = читатьТолькоЭксперимент(path.join('tests', 'results', 'clean-resume-latest.md'));
  assert.match(доказательство, /CLEAN_RESUME_TEST=PASS/);
});
