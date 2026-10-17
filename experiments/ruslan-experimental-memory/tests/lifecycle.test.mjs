// Lifecycle: текущий PASS не путать с историческим NOT_RUN.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  загрузитьКартуПамяти,
  читатьТолькоЭксперимент,
  разобратьКарту,
  списокЧекпоинтов,
} from './parse-memory.mjs';

test('текущая ориентация: PASS / YES / OWNER REVIEW next', () => {
  const карта = загрузитьКартуПамяти();
  assert.equal(карта.keys.STRUCTURED_RESUME_TEST.value, 'PASS');
  assert.equal(карта.keys.CROSS_SESSION_AI_RESUME_TEST.value, 'PASS');
  assert.equal(
    карта.keys.CROSS_SESSION_AI_RESUME_TEST.provenance,
    'OBSERVED_FROM_PROJECT_SOURCE',
  );
  assert.equal(
    карта.keys.CROSS_SESSION_AI_RESUME_TEST.extras.SOURCE_REF,
    'tests/results/cross-session-v01/result.md',
  );
  assert.equal(карта.keys.SESSION_A_COMPLETED.value, 'YES');
  assert.equal(карта.keys.SESSION_B_COMPLETED.value, 'YES');
  assert.equal(карта.keys.SESSION_B_COMPLETED.provenance, 'OBSERVED_FROM_PROJECT_SOURCE');
  assert.equal(
    карта.keys.NEXT_BOUNDED_ACTION.value,
    'OWNER REVIEW OF RUSLAN EXPERIMENTAL MEMORY v0.1 RESULT',
  );
  assert.equal(карта.keys.NEXT_BOUNDED_ACTION.provenance, 'OWNER_ASSERTED');
  assert.match(карта.keys.CURRENT_STATUS.value, /completed successfully/i);
  assert.match(карта.keys.CURRENT_STATUS.value, /10\/10/);
  assert.match(карта.keys.CURRENT_STATUS.value, /waiting owner review/i);
  assert.equal(карта.keys.CURRENT_STATUS.provenance, 'MODEL_SUMMARY');
  assert.match(
    карта.keys.LAST_STOP_POINT.value,
    /after successful Session B comparison and PASS result/,
  );
  assert.equal(карта.keys.LAST_STOP_POINT.provenance, 'MODEL_SUMMARY');
  assert.notEqual(карта.keys.CROSS_SESSION_AI_RESUME_TEST.value, 'NOT_RUN');
});

test('исторический NOT_RUN остаётся в Session A evidence (SUPERSEDED ≠ DELETED)', () => {
  const карта = загрузитьКартуПамяти();
  assert.equal(карта.keys.CROSS_SESSION_AI_RESUME_TEST.value, 'PASS');

  const имена = списокЧекпоинтов();
  assert.ok(имена.includes('2026-10-05-cross-session-session-a-v01.md'));
  assert.ok(имена.includes('2026-10-05-cross-session-pass-v01.md'));
  assert.ok(имена.includes('2026-10-05-project-lane-v01.md'));

  const исторический = читатьТолькоЭксперимент(
    'checkpoints/2026-10-05-cross-session-session-a-v01.md',
  );
  const историческаяКарта = разобратьКарту(исторический);
  assert.equal(историческаяКарта.keys.CROSS_SESSION_AI_RESUME_TEST.value, 'NOT_RUN');
  assert.match(историческаяКарта.keys.LAST_STOP_POINT.value, /awaiting Session B/);
  assert.match(историческаяКарта.keys.NEXT_BOUNDED_ACTION.value, /SESSION_B must answer Q1/);

  const sessionAEvidence = читатьТолькоЭксперимент(
    'tests/results/cross-session-v01/session-a-checkpoint.md',
  );
  assert.match(sessionAEvidence, /CROSS_SESSION_AI_RESUME_TEST=NOT_RUN/);
  assert.match(sessionAEvidence, /awaiting Session B/);

  const текущийPass = читатьТолькоЭксперимент(
    'checkpoints/2026-10-05-cross-session-pass-v01.md',
  );
  const passКарта = разобратьКарту(текущийPass);
  assert.equal(passКарта.keys.CROSS_SESSION_AI_RESUME_TEST.value, 'PASS');
  assert.equal(
    passКарта.keys.NEXT_BOUNDED_ACTION.value,
    'OWNER REVIEW OF RUSLAN EXPERIMENTAL MEMORY v0.1 RESULT',
  );

  assert.notEqual(
    карта.keys.CROSS_SESSION_AI_RESUME_TEST.value,
    историческаяКарта.keys.CROSS_SESSION_AI_RESUME_TEST.value,
  );
  assert.notEqual(
    карта.keys.NEXT_BOUNDED_ACTION.value,
    историческаяКарта.keys.NEXT_BOUNDED_ACTION.value,
  );
});
