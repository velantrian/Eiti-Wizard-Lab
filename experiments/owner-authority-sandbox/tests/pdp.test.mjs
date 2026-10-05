// Детерминированные случаи синтетического PDP v0.1.
// Запуск: node --test experiments/owner-authority-sandbox/tests/**/*.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, applyContextOverrides } from '../pdp/evaluate.mjs';
import { ОБЯЗАТЕЛЬНЫЕ_МЕТКИ, ИЗВЕСТНЫЕ_ДЕЙСТВИЯ } from '../pdp/constants.mjs';
import { загрузитьФикстуры, запросПоId, записатьEvidence } from '../harness/helpers.mjs';

const фикстуры = загрузитьФикстуры();

function оценить(idЗапроса, правкиКонтекста) {
  const запрос = запросПоId(фикстуры, idЗапроса);
  const overrides = правкиКонтекста ?? запрос.context_overrides;
  delete запрос.context_overrides;
  delete запрос.notes;
  delete запрос.case;
  const контекст = applyContextOverrides(фикстуры.context, overrides);
  return evaluate({
    passport: фикстуры.passport,
    context: контекст,
    grants: фикстуры.grants,
    request: запрос,
    knownActions: фикстуры.knownActions.actions,
  });
}

function проверитьОбязательныеМетки(результат) {
  for (const [ключ, значение] of Object.entries(ОБЯЗАТЕЛЬНЫЕ_МЕТКИ)) {
    assert.equal(результат.labels[ключ], значение, `метка ${ключ}`);
  }
  assert.equal(результат.labels.REAL_AUTHORIZATION, 'NO');
  assert.equal(результат.labels.OWNER_AUTHORITY, 'NO');
  assert.equal(результат.labels.PEP_EXECUTED, 'NO');
  assert.equal(результат.labels.NETWORK_USED, 'NO');
  assert.equal(результат.labels.CONNECTORS_USED, 'NO');
  assert.equal(результат.synthetic, true);
  assert.equal(результат.sensitivity, 'TEST_ONLY');
  assert.equal(результат.authoritative, false);
  assert.equal(результат.real_authorization, false);
  assert.equal(результат.owner_authority, false);
  assert.equal(результат.pep_executed, false);
  assert.equal(результат.network_used, false);
  assert.equal(результат.connectors_used, false);
}

test('фикстуры вымышленные: synthetic=true, sensitivity=TEST_ONLY, без реальных owner-данных', () => {
  for (const объект of [фикстуры.passport, фикстуры.context, фикстуры.grants, фикстуры.knownActions, фикстуры.requests]) {
    assert.equal(объект.synthetic, true);
    assert.equal(объект.sensitivity, 'TEST_ONLY');
  }
  const текст = JSON.stringify(фикстуры);
  assert.equal(текст.includes('руслан'), false);
  assert.equal(/ruslan/i.test(текст), false);
  assert.equal(фикстуры.passport.kind, 'SYNTHETIC_OWNER_PASSPORT');
  assert.equal(фикстуры.grants.real_grants, false);
  assert.equal(фикстуры.passport.display_name, 'Синтетическая лабораторная персона Альфа');
});

test('каталог симуляций совпадает с константами PDP', () => {
  assert.deepEqual([...фикстуры.knownActions.actions].sort(), [...ИЗВЕСТНЫЕ_ДЕЙСТВИЯ].sort());
});

test('1 нет гранта → DENY', () => {
  const р = оценить('REQ-01-NO-GRANT');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'NO_GRANT');
  проверитьОбязательныеМетки(р);
});

test('2 точный валидный грант → ALLOW (симулированный)', () => {
  const р = оценить('REQ-02-EXACT-VALID');
  assert.equal(р.decision, 'ALLOW');
  assert.equal(р.reason_code, 'EXACT_VALID_GRANT');
  assert.deepEqual([...р.matching_grant_ids], ['GRANT-SYN-VALID-01']);
  assert.equal(р.simulated_allow, true);
  assert.equal(р.labels.SIMULATED_ALLOW, 'YES');
  assert.equal(р.labels.REAL_AUTHORIZATION, 'NO');
  проверитьОбязательныеМетки(р);
});

test('3 истёкший грант → DENY', () => {
  const р = оценить('REQ-03-EXPIRED');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'GRANT_EXPIRED');
  проверитьОбязательныеМетки(р);
});

test('4 отозванный грант → DENY', () => {
  const р = оценить('REQ-04-REVOKED');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'GRANT_REVOKED');
  проверитьОбязательныеМетки(р);
});

test('5 устаревший обязательный контекст → ESCALATE_TO_OWNER', () => {
  const р = оценить('REQ-05-STALE-CONTEXT');
  assert.equal(р.decision, 'ESCALATE_TO_OWNER');
  assert.equal(р.reason_code, 'STALE_REQUIRED_CONTEXT');
  проверитьОбязательныеМетки(р);
});

test('6 DENY важнее ALLOW → DENY', () => {
  const р = оценить('REQ-06-DENY-PRECEDENCE');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'DENY_PRECEDENCE');
  assert.ok(р.matching_grant_ids.includes('GRANT-SYN-ALLOW-DELETE-01'));
  assert.ok(р.matching_grant_ids.includes('GRANT-SYN-DENY-DELETE-01'));
  проверитьОбязательныеМетки(р);
});

test('7 несовпадение субъекта → DENY', () => {
  const р = оценить('REQ-07-SUBJECT-MISMATCH');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'SUBJECT_MISMATCH');
  проверитьОбязательныеМетки(р);
});

test('8 метка провайдера ≠ аутентифицированный/эквивалентный субъект → DENY', () => {
  const р = оценить('REQ-08-PROVIDER-LABEL');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'PROVIDER_MODEL_LABEL_IS_NOT_SUBJECT');
  assert.equal(фикстуры.passport.equivalent_subjects.includes('provider:lab-model-label'), false);
  assert.ok(фикстуры.passport.not_equivalent.includes('provider:lab-model-label'));
  assert.notEqual(фикстуры.context.authenticated_subject, 'provider:lab-model-label');
  проверитьОбязательныеМетки(р);
});

test('8b метка модели ≠ аутентифицированный/эквивалентный субъект → DENY', () => {
  const р = оценить('REQ-08B-MODEL-LABEL');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'PROVIDER_MODEL_LABEL_IS_NOT_SUBJECT');
  assert.ok(фикстуры.passport.not_equivalent.includes('model:demo-llm'));
  проверитьОбязательныеМетки(р);
});

test('9 неизвестное действие → DENY', () => {
  const р = оценить('REQ-09-UNKNOWN-ACTION');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'UNKNOWN_ACTION');
  проверитьОбязательныеМетки(р);
});

test('10 неоднозначный authority (грант) → ESCALATE_TO_OWNER', () => {
  const р = оценить('REQ-10-AMBIGUOUS');
  assert.equal(р.decision, 'ESCALATE_TO_OWNER');
  assert.equal(р.reason_code, 'AMBIGUOUS_AUTHORITY');
  проверитьОбязательныеМетки(р);
});

test('10b неоднозначная основа authority → ESCALATE_TO_OWNER', () => {
  const р = оценить('REQ-10B-AMBIGUOUS-BASIS');
  assert.equal(р.decision, 'ESCALATE_TO_OWNER');
  assert.equal(р.reason_code, 'AMBIGUOUS_AUTHORITY');
});

test('11 OWNER_GOAL != ACTION_AUTHORITY → DENY', () => {
  const р = оценить('REQ-11-OWNER-GOAL');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'OWNER_GOAL_IS_NOT_ACTION_AUTHORITY');
  проверитьОбязательныеМетки(р);
});

test('12 OWNER_PREFERENCE != DELEGATION → DENY', () => {
  const р = оценить('REQ-12-OWNER-PREFERENCE');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'OWNER_PREFERENCE_IS_NOT_DELEGATION');
  проверитьОбязательныеМетки(р);
});

test('13 PAST_OWNER_ACCEPTANCE != FUTURE_PERMISSION → DENY', () => {
  const р = оценить('REQ-13-PAST-ACCEPTANCE');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'PAST_OWNER_ACCEPTANCE_IS_NOT_FUTURE_PERMISSION');
  проверитьОбязательныеМетки(р);
});

test('14 MODEL_CONFIDENCE != OWNER_INTENT → DENY', () => {
  const р = оценить('REQ-14-MODEL-CONFIDENCE');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'MODEL_CONFIDENCE_IS_NOT_OWNER_INTENT');
  проверитьОбязательныеМетки(р);
});

test('15 CONTEXT_ACCESS != ACTION_AUTHORITY → DENY', () => {
  const р = оценить('REQ-15-CONTEXT-ACCESS');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'CONTEXT_ACCESS_IS_NOT_ACTION_AUTHORITY');
  проверитьОбязательныеМетки(р);
});

test('16 simulated ALLOW != real authorization (метки evidence)', () => {
  const р = оценить('REQ-16-SIMULATED-ALLOW');
  assert.equal(р.decision, 'ALLOW');
  assert.equal(р.labels.SIMULATED_ALLOW, 'YES');
  assert.equal(р.labels.REAL_AUTHORIZATION, 'NO');
  assert.equal(р.labels['SIMULATED_ALLOW != REAL_AUTHORIZATION'], 'YES');
  assert.equal(р.simulated_allow, true);
  assert.equal(р.real_authorization, false);
  const путь = записатьEvidence('case-16-simulated-allow.json', {
    ...р,
    evidence_kind: 'SYNTHETIC_TEST_ONLY',
    notes: 'SIMULATED_ALLOW != REAL_AUTHORIZATION',
  });
  assert.ok(путь.includes('owner-authority-sandbox/evidence/generated/'));
  проверитьОбязательныеМетки(р);
});

test('17 TEST_GRANT != OWNER_AUTHORITY', () => {
  const р = оценить('REQ-17-TEST-GRANT');
  assert.equal(р.decision, 'ALLOW');
  assert.equal(р.labels.TEST_GRANT, 'YES');
  assert.equal(р.labels.OWNER_AUTHORITY, 'NO');
  assert.equal(р.labels['TEST_GRANT != OWNER_AUTHORITY'], 'YES');
  assert.equal(р.test_grant, true);
  assert.equal(р.owner_authority, false);
  const грант = фикстуры.grants.grants.find((г) => г.id === 'GRANT-SYN-VALID-01');
  assert.equal(грант.test_grant, true);
  assert.equal(грант.owner_authority, false);
  assert.equal(грант.kind, 'TEST_GRANT');
  assert.equal(грант.not, 'OWNER_AUTHORITY');
  проверитьОбязательныеМетки(р);
});

test('18 конфликтующие гранты → ESCALATE_TO_OWNER', () => {
  const р = оценить('REQ-18-CONFLICTING');
  assert.equal(р.decision, 'ESCALATE_TO_OWNER');
  assert.equal(р.reason_code, 'CONFLICTING_GRANTS');
  assert.ok(р.matching_grant_ids.includes('GRANT-SYN-CONFLICT-A-01'));
  assert.ok(р.matching_grant_ids.includes('GRANT-SYN-CONFLICT-B-01'));
  проверитьОбязательныеМетки(р);
});

test('19 детерминированный повтор даёт идентичный результат', () => {
  const а = оценить('REQ-19-REPLAY');
  const б = оценить('REQ-19-REPLAY');
  assert.equal(JSON.stringify(а), JSON.stringify(б));
  assert.equal(а.decision, 'ALLOW');
  проверитьОбязательныеМетки(а);
});

test('20 TOOL_AVAILABLE != TOOL_AUTHORIZED → DENY', () => {
  const р = оценить('REQ-20-TOOL-AVAILABLE');
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'TOOL_AVAILABLE_IS_NOT_TOOL_AUTHORIZED');
  assert.ok(фикстуры.context.tools_available.includes('sandbox.note.create'));
  проверитьОбязательныеМетки(р);
});

test('несинтетический вход → DENY (реальные данные запрещены)', () => {
  const запрос = запросПоId(фикстуры, 'REQ-02-EXACT-VALID');
  delete запрос.context_overrides;
  delete запрос.notes;
  delete запрос.case;
  const паспорт = { ...фикстуры.passport, synthetic: false };
  const р = evaluate({
    passport: паспорт,
    context: фикстуры.context,
    grants: фикстуры.grants,
    request: запрос,
  });
  assert.equal(р.decision, 'DENY');
  assert.equal(р.reason_code, 'NON_SYNTHETIC_INPUT_REFUSED');
});

test('evaluate не мутирует входные объекты', () => {
  const passport = structuredClone(фикстуры.passport);
  const context = structuredClone(фикстуры.context);
  const grants = structuredClone(фикстуры.grants);
  const request = запросПоId(фикстуры, 'REQ-02-EXACT-VALID');
  delete request.context_overrides;
  delete request.notes;
  delete request.case;
  const снимок = JSON.stringify({ passport, context, grants, request });
  evaluate({ passport, context, grants, request });
  assert.equal(JSON.stringify({ passport, context, grants, request }), снимок);
});

test('порядок грантов не влияет на deny-precedence и конфликт', () => {
  const запросDeny = запросПоId(фикстуры, 'REQ-06-DENY-PRECEDENCE');
  delete запросDeny.context_overrides;
  delete запросDeny.notes;
  delete запросDeny.case;
  const грантыОбратно = { ...фикстуры.grants, grants: [...фикстуры.grants.grants].reverse() };
  const а = evaluate({
    passport: фикстуры.passport,
    context: фикстуры.context,
    grants: фикстуры.grants,
    request: запросDeny,
  });
  const б = evaluate({
    passport: фикстуры.passport,
    context: фикстуры.context,
    grants: грантыОбратно,
    request: запросDeny,
  });
  assert.equal(а.decision, б.decision);
  assert.equal(а.reason_code, б.reason_code);
  assert.equal(JSON.stringify(а.matching_grant_ids), JSON.stringify(б.matching_grant_ids));

  const запросКонфликт = запросПоId(фикстуры, 'REQ-18-CONFLICTING');
  delete запросКонфликт.context_overrides;
  delete запросКонфликт.notes;
  delete запросКонфликт.case;
  const в = evaluate({
    passport: фикстуры.passport,
    context: фикстуры.context,
    grants: грантыОбратно,
    request: запросКонфликт,
  });
  assert.equal(в.decision, 'ESCALATE_TO_OWNER');
  assert.equal(в.reason_code, 'CONFLICTING_GRANTS');
});
