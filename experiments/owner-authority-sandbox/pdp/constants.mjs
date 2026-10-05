// Обязательные метки эксперимента v0.1 (не авторитет, не граница безопасности).
export const ОБЯЗАТЕЛЬНЫЕ_МЕТКИ = Object.freeze({
  EXPERIMENTAL_ONLY: 'YES',
  SYNTHETIC_ONLY: 'YES',
  AUTHORITATIVE: 'NO',
  TECHNICALLY_ISOLATED: 'NO',
  REAL_OWNER_DATA_ALLOWED: 'NO',
  REAL_GRANTS_ALLOWED: 'NO',
  REAL_PEP_ALLOWED: 'NO',
  AUTONOMOUS_EFFECTS_ALLOWED: 'NO',
  'TEST_GRANT != OWNER_AUTHORITY': 'YES',
  'SIMULATED_ALLOW != REAL_AUTHORIZATION': 'YES',
  'MODEL_OUTPUT != OWNER_PERMISSION': 'YES',
  THIS_DIRECTORY_IS_NOT_A_SECURITY_BOUNDARY: 'YES',
});

export const РЕШЕНИЯ = Object.freeze(['ALLOW', 'DENY', 'ESCALATE_TO_OWNER']);

export const ИЗВЕСТНЫЕ_ДЕЙСТВИЯ = Object.freeze([
  'sandbox.note.create',
  'sandbox.note.read',
  'sandbox.note.delete',
  'sandbox.note.expired',
  'sandbox.note.revoked',
  'sandbox.note.conflict',
  'sandbox.note.ambiguous',
  'sandbox.note.deny-precedence',
  'sandbox.note.ungranted',
  'sandbox.export.bundle',
]);

export const ОСНОВЫ_НЕ_ЯВЛЯЮЩИЕСЯ_AUTHORITY = Object.freeze({
  OWNER_GOAL: {
    reason_code: 'OWNER_GOAL_IS_NOT_ACTION_AUTHORITY',
    reason_note: 'OWNER_GOAL != ACTION_AUTHORITY: цель синтетической персоны не даёт права на действие.',
  },
  OWNER_PREFERENCE: {
    reason_code: 'OWNER_PREFERENCE_IS_NOT_DELEGATION',
    reason_note: 'OWNER_PREFERENCE != DELEGATION: предпочтение не является делегированием.',
  },
  PAST_OWNER_ACCEPTANCE: {
    reason_code: 'PAST_OWNER_ACCEPTANCE_IS_NOT_FUTURE_PERMISSION',
    reason_note: 'PAST_OWNER_ACCEPTANCE != FUTURE_PERMISSION: прошлое согласие не разрешает будущее действие.',
  },
  MODEL_CONFIDENCE: {
    reason_code: 'MODEL_CONFIDENCE_IS_NOT_OWNER_INTENT',
    reason_note: 'MODEL_CONFIDENCE != OWNER_INTENT: уверенность модели не является намерением владельца.',
  },
  CONTEXT_ACCESS: {
    reason_code: 'CONTEXT_ACCESS_IS_NOT_ACTION_AUTHORITY',
    reason_note: 'CONTEXT_ACCESS != ACTION_AUTHORITY: доступ к контексту не даёт права действовать.',
  },
  TOOL_AVAILABLE: {
    reason_code: 'TOOL_AVAILABLE_IS_NOT_TOOL_AUTHORIZED',
    reason_note: 'TOOL_AVAILABLE != TOOL_AUTHORIZED: наличие инструмента не означает его авторизацию.',
  },
});

export const МЕТКИ_ПРОВАЙДЕРА_ИЛИ_МОДЕЛИ_ПРЕФИКСЫ = Object.freeze(['provider:', 'model:']);

export const КОДЫ_ПРИЧИН = Object.freeze({
  NON_SYNTHETIC_INPUT_REFUSED: 'NON_SYNTHETIC_INPUT_REFUSED',
  INVALID_INPUT: 'INVALID_INPUT',
  UNKNOWN_ACTION: 'UNKNOWN_ACTION',
  SUBJECT_MISMATCH: 'SUBJECT_MISMATCH',
  PROVIDER_MODEL_LABEL_IS_NOT_SUBJECT: 'PROVIDER_MODEL_LABEL_IS_NOT_SUBJECT',
  AMBIGUOUS_AUTHORITY: 'AMBIGUOUS_AUTHORITY',
  STALE_REQUIRED_CONTEXT: 'STALE_REQUIRED_CONTEXT',
  DENY_PRECEDENCE: 'DENY_PRECEDENCE',
  CONFLICTING_GRANTS: 'CONFLICTING_GRANTS',
  EXACT_VALID_GRANT: 'EXACT_VALID_GRANT',
  NO_GRANT: 'NO_GRANT',
  GRANT_EXPIRED: 'GRANT_EXPIRED',
  GRANT_REVOKED: 'GRANT_REVOKED',
  NO_VALID_GRANT: 'NO_VALID_GRANT',
});
