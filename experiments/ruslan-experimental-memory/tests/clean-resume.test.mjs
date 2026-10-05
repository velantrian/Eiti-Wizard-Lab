// STRUCTURED_RESUME_TEST v0.1: свежий агент читает ТОЛЬКО эту папку эксперимента
// и восстанавливает проектную непрерывность без LLM.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  КОРЕНЬ_ЭКСПЕРИМЕНТА,
  PROVENANCE,
  читатьТолькоЭксперимент,
  загрузитьКартуПамяти,
  извлечьОтветыДляResume,
  списокЧекпоинтов,
  путьВнутриЭксперимента,
  разобратьКлючЗначение,
  разобратьКарту,
} from './parse-memory.mjs';

const ОБЯЗАТЕЛЬНЫЕ_СЕКЦИИ = [
  'ACTIVE_THREADS',
  'RECENT_CHECKPOINTS',
  'OWNER_ASSERTED',
  'MODEL_SUMMARY',
  'OPEN_QUESTIONS',
  'IMPORTANT_DECISIONS',
];

const КЛЮЧИ_НЕ_OWNER_ASSERTED = [
  'CURRENT_STATUS',
  'CURRENT_BLOCKER',
  'CURRENT_PROJECT',
  'CURRENT_GOAL',
  'LAST_COMPLETED_STEP',
  'PR_28_STATE',
  'PR_27_STATE',
  'PR_27_HEAD',
  'PR_27_FILE_COUNT',
  'PR_26_STATE',
  'PR_16_STATE',
  'BASE_SHA',
  'BASE_REF',
  'STRUCTURED_RESUME_TEST',
];

function записатьДоказательство(итог) {
  const каталог = path.join(КОРЕНЬ_ЭКСПЕРИМЕНТА, 'tests', 'results');
  fs.mkdirSync(каталог, { recursive: true });
  const файл = path.join(каталог, 'clean-resume-latest.md');
  const строки = [
    '# STRUCTURED_RESUME_TEST — результат',
    '',
    `STRUCTURED_RESUME_TEST=${итог.status}`,
    'CROSS_SESSION_AI_RESUME_TEST=NOT_RUN',
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
  assert.ok(PROVENANCE.has('OBSERVED_FROM_PROJECT_SOURCE'));

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
    'STRUCTURED_RESUME_TEST',
    'CROSS_SESSION_AI_RESUME_TEST',
    'PR_28_STATE',
  ]) {
    assert.ok(карта.keys[ключ], `нет ключа ${ключ}`);
  }
  assert.equal(карта.keys.EXPERIMENTAL_ONLY.value, 'YES');
  assert.equal(карта.keys.AUTHORITATIVE.value, 'NO');
  assert.equal(карта.keys.CANON.value, 'NO');
  assert.equal(карта.keys.OFFICIAL_MEMORY.value, 'NO');
  assert.equal(карта.keys.STRUCTURED_RESUME_TEST.value, 'PASS');
  assert.equal(карта.keys.CROSS_SESSION_AI_RESUME_TEST.value, 'NOT_RUN');
  for (const секция of ОБЯЗАТЕЛЬНЫЕ_СЕКЦИИ) {
    assert.ok(карта.sections[секция], `нет секции ${секция}`);
    assert.ok(карта.sections[секция].length > 0, `секция ${секция} пуста`);
  }
});

test('парсер принимает OBSERVED_FROM_PROJECT_SOURCE и SOURCE_REF', () => {
  const строка =
    'PR_28_STATE=OPEN/DRAFT/NOT_MERGED | OBSERVED_FROM_PROJECT_SOURCE | SOURCE_CLASS=github | SOURCE_REF=GitHub PR #28 | OBSERVED_AT=2026-10-05T15:30:00Z';
  const kv = разобратьКлючЗначение(строка);
  assert.ok(kv);
  assert.equal(kv.key, 'PR_28_STATE');
  assert.equal(kv.value, 'OPEN/DRAFT/NOT_MERGED');
  assert.equal(kv.provenance, 'OBSERVED_FROM_PROJECT_SOURCE');
  assert.equal(kv.extras.SOURCE_REF, 'GitHub PR #28');
  assert.equal(kv.extras.SOURCE_CLASS, 'github');
  assert.equal(kv.extras.OBSERVED_AT, '2026-10-05T15:30:00Z');
});

test('регрессия: технические и сводные поля не помечены OWNER_ASSERTED', () => {
  const карта = загрузитьКартуПамяти();
  for (const ключ of КЛЮЧИ_НЕ_OWNER_ASSERTED) {
    assert.ok(карта.keys[ключ], `нет ключа ${ключ}`);
    assert.notEqual(
      карта.keys[ключ].provenance,
      'OWNER_ASSERTED',
      `${ключ} не должен быть OWNER_ASSERTED`,
    );
  }
  assert.equal(карта.keys.CURRENT_THREAD.provenance, 'OWNER_ASSERTED');
  assert.equal(карта.keys.LAST_STOP_POINT.provenance, 'OWNER_ASSERTED');
  assert.equal(карта.keys.NEXT_BOUNDED_ACTION.provenance, 'OWNER_ASSERTED');
  assert.equal(карта.keys.DO_NOT_MERGE.provenance, 'OWNER_ASSERTED');
  assert.equal(карта.keys.DO_NOT_TOUCH_CANON.provenance, 'OWNER_ASSERTED');
  assert.equal(карта.keys.PR_28_STATE.provenance, 'OBSERVED_FROM_PROJECT_SOURCE');
  assert.equal(карта.keys.PR_27_STATE.provenance, 'OBSERVED_FROM_PROJECT_SOURCE');
  assert.equal(карта.keys.STRUCTURED_RESUME_TEST.provenance, 'OBSERVED_FROM_PROJECT_SOURCE');
  assert.equal(карта.keys.CURRENT_STATUS.provenance, 'MODEL_SUMMARY');
  assert.equal(карта.keys.CURRENT_BLOCKER.provenance, 'MODEL_SUMMARY');
  assert.equal(карта.keys.CURRENT_PROJECT.provenance, 'MODEL_SUMMARY');
  assert.equal(карта.keys.CURRENT_GOAL.provenance, 'MODEL_SUMMARY');

  const техническиеПаттерны = [
    /head 2d6877fc937f3b09c93d68c9b950170b358495d8/i,
    /28\/28/,
    /PR_28_STATE/,
  ];
  for (const bullet of карта.bullets) {
    if (bullet.provenance !== 'OWNER_ASSERTED') continue;
    for (const паттерн of техническиеПаттерны) {
      assert.equal(
        паттерн.test(bullet.text),
        false,
        `OWNER_ASSERTED не должен содержать техническое наблюдение: ${bullet.text}`,
      );
    }
  }

  const observed = Object.values(карта.keys).filter(
    (k) => k.provenance === 'OBSERVED_FROM_PROJECT_SOURCE',
  );
  assert.ok(observed.length >= 8, 'ожидались ключи OBSERVED_FROM_PROJECT_SOURCE');
});

test('STRUCTURED_RESUME_TEST: 5 вопросов свежего агента', () => {
  const карта = загрузитьКартуПамяти();
  const ответы = извлечьОтветыДляResume(карта);
  const проверки = [];

  // 1) что происходит
  assert.match(ответы.current_project, /экспериментальн|continuity memory|непрерывн/i);
  assert.match(ответы.current_thread, /ruslan-experimental-memory|owner review/i);
  assert.match(ответы.current_goal, /STRUCTURED_RESUME_TEST|CROSS_SESSION_AI_RESUME_TEST|handoff Session B/i);
  assert.match(ответы.current_status, /PR #28|OWNER REVIEW|STRUCTURED_RESUME_TEST/i);
  assert.equal(ответы.structured_resume_test, 'PASS');
  assert.equal(ответы.cross_session_ai_resume_test, 'NOT_RUN');
  проверки.push('PASS Q1 current project/thread/goal/status');

  // 2) где остановились
  assert.match(ответы.last_stop_point, /Session A ended after writing checkpoint \+ expected-answers/i);
  assert.match(ответы.last_stop_point, /awaiting Session B/i);
  проверки.push('PASS Q2 LAST_STOP_POINT');

  // 3) что уже сделано
  assert.match(
    ответы.last_completed_step,
    /Session A|expected-answers|SESSION_B_PROMPT|cross-session-session-a-v01/i,
  );
  const чекпоинты = списокЧекпоинтов();
  assert.ok(чекпоинты.length >= 2, 'нужен новый Session A checkpoint без перезаписи старого');
  assert.ok(
    чекпоинты.includes('2026-10-05-project-lane-v01.md'),
    'старый project-lane checkpoint должен остаться',
  );
  assert.ok(
    чекпоинты.includes('2026-10-05-cross-session-session-a-v01.md'),
    'нет Session A checkpoint',
  );
  const текстЧекпоинта = читатьТолькоЭксперимент(
    path.join('checkpoints', '2026-10-05-cross-session-session-a-v01.md'),
  );
  assert.match(текстЧекпоинта, /LAST_STOP_POINT|NEXT_BOUNDED_ACTION/);
  assert.match(текстЧекпоинта, /OWNER_ASSERTED|MODEL_SUMMARY|OBSERVED_FROM_PROJECT_SOURCE/);
  const чекпоинтКарта = разобратьКарту(текстЧекпоинта);
  assert.equal(чекпоинтКарта.keys.LAST_STOP_POINT?.provenance, 'OWNER_ASSERTED');
  assert.equal(чекпоинтКарта.keys.NEXT_BOUNDED_ACTION?.provenance, 'OWNER_ASSERTED');
  проверки.push('PASS Q3 LAST_COMPLETED_STEP + checkpoint 2026-10-05-cross-session-session-a-v01.md');

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
  assert.match(ответы.next_bounded_action, /SESSION_B must answer Q1–Q10/i);
  assert.match(ответы.next_bounded_action, /experimental memory only/i);
  assert.match(ответы.next_bounded_action, /OWNER REVIEW of comparison/i);
  assert.equal(ответы.do_not_canon_integration, 'YES');
  assert.equal(ответы.do_not_start_v02, 'YES');
  проверки.push('PASS Q5 NEXT_BOUNDED_ACTION');

  const файл = записатьДоказательство({
    status: 'PASS',
    recorded_at: '2026-10-05T17:30:00+02:00',
    answers: ответы,
    checks: проверки,
  });
  assert.equal(путьВнутриЭксперимента(файл), true);
  const доказательство = читатьТолькоЭксперимент(path.join('tests', 'results', 'clean-resume-latest.md'));
  assert.match(доказательство, /STRUCTURED_RESUME_TEST=PASS/);
  assert.match(доказательство, /CROSS_SESSION_AI_RESUME_TEST=NOT_RUN/);
  assert.match(доказательство, /CLEAN_RESUME_TEST=PASS/);

  const промпт = читатьТолькоЭксперимент(
    path.join('tests', 'results', 'cross-session-v01', 'SESSION_B_PROMPT.md'),
  );
  assert.match(промпт, /Read ONLY files under `experiments\/ruslan-experimental-memory\/`/);
  assert.match(промпт, /Q10\./);
  assert.equal(промпт.includes('EXPECTED='), false);
});
