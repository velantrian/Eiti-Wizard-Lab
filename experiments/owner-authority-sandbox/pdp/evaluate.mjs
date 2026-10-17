// Чистый детерминированный PDP эксперимента v0.1.
// Нет сети, FS, Date.now(), process.env, shell, LLM, коннекторов.
// Входы не мутируются. Порядок грантов не влияет на решение.
import {
  ОБЯЗАТЕЛЬНЫЕ_МЕТКИ,
  ИЗВЕСТНЫЕ_ДЕЙСТВИЯ,
  ОСНОВЫ_НЕ_ЯВЛЯЮЩИЕСЯ_AUTHORITY,
  МЕТКИ_ПРОВАЙДЕРА_ИЛИ_МОДЕЛИ_ПРЕФИКСЫ,
  КОДЫ_ПРИЧИН,
} from './constants.mjs';

const ОСНОВЫ_GRANT = new Set(['GRANT', '', null, undefined]);

function клон(значение) {
  return structuredClone(значение);
}

function меткаПровайдераИлиМодели(субъект) {
  if (typeof субъект !== 'string') return false;
  return МЕТКИ_ПРОВАЙДЕРА_ИЛИ_МОДЕЛИ_ПРЕФИКСЫ.some((префикс) => субъект.startsWith(префикс));
}

function синтетическийВход(паспорт, контекст, гранты, запрос) {
  return Boolean(
    паспорт && паспорт.synthetic === true && паспорт.sensitivity === 'TEST_ONLY'
    && контекст && контекст.synthetic === true && контекст.sensitivity === 'TEST_ONLY'
    && гранты && гранты.synthetic === true && гранты.sensitivity === 'TEST_ONLY'
    && запрос && запрос.synthetic === true && запрос.sensitivity === 'TEST_ONLY',
  );
}

function собратьМетки(решение, доп = {}) {
  return Object.freeze({
    ...ОБЯЗАТЕЛЬНЫЕ_МЕТКИ,
    SIMULATED_ALLOW: решение === 'ALLOW' ? 'YES' : 'NO',
    REAL_AUTHORIZATION: 'NO',
    TEST_GRANT: 'YES',
    OWNER_AUTHORITY: 'NO',
    MODEL_OUTPUT: 'NOT_OWNER_PERMISSION',
    OWNER_PERMISSION: 'NO',
    PEP_EXECUTED: 'NO',
    NETWORK_USED: 'NO',
    CONNECTORS_USED: 'NO',
    ...доп,
  });
}

function записьРешения({
  decision,
  reason_code,
  reason_note,
  matching_grant_ids,
  request_id,
}) {
  const ids = [...matching_grant_ids].sort();
  return Object.freeze({
    synthetic: true,
    sensitivity: 'TEST_ONLY',
    authoritative: false,
    experimental_only: true,
    real_authorization: false,
    owner_authority: false,
    pep_executed: false,
    network_used: false,
    connectors_used: false,
    simulated_allow: decision === 'ALLOW',
    test_grant: true,
    decision,
    reason_code,
    reason_note,
    matching_grant_ids: Object.freeze(ids),
    request_id: request_id ?? null,
    labels: собратьМетки(decision),
  });
}

function разобратьВремя(изо) {
  if (typeof изо !== 'string') return Number.NaN;
  return Date.parse(изо);
}

function грантИстёк(грант, сейчасМс) {
  const неПосле = разобратьВремя(грант.not_after);
  const неДо = разобратьВремя(грант.not_before);
  if (Number.isNaN(сейчасМс) || Number.isNaN(неПосле) || Number.isNaN(неДо)) return true;
  return сейчасМс > неПосле || сейчасМс < неДо;
}

function грантОтозван(грант) {
  return грант.status === 'REVOKED';
}

function грантАктивенПоСтатусу(грант) {
  return грант.status === 'ACTIVE';
}

function субъектыСовпадают(паспорт, контекст, субъектЗапроса) {
  if (субъектЗапроса !== паспорт.authenticated_subject) return false;
  if (субъектЗапроса !== паспорт.subject_id) return false;
  if (субъектЗапроса !== контекст.authenticated_subject) return false;
  const эквиваленты = Array.isArray(паспорт.equivalent_subjects) ? паспорт.equivalent_subjects : [];
  if (!эквиваленты.includes(субъектЗапроса)) return false;
  const запрещены = Array.isArray(паспорт.not_equivalent) ? паспорт.not_equivalent : [];
  if (запрещены.includes(субъектЗапроса)) return false;
  return true;
}

function контекстУстарел(контекст, запрос) {
  if (запрос.requires_fresh_context === false) return false;
  if (контекст.stale === true) return true;
  const сейчас = разобратьВремя(контекст.now);
  const выдан = разобратьВремя(контекст.context_issued_at);
  const окно = Number(контекст.required_freshness_seconds);
  if (Number.isNaN(сейчас) || Number.isNaN(выдан) || !Number.isFinite(окно)) return true;
  return (сейчас - выдан) > (окно * 1000);
}

function грантСовпадает(грант, запрос) {
  if (грант.subject !== запрос.subject) return false;
  if (грант.action !== запрос.action) return false;
  if (грант.resource !== запрос.resource) return false;
  return true;
}

function известноеДействие(действие, каталог) {
  return каталог.includes(действие);
}

/**
 * Чистая оценка синтетического запроса.
 * @param {{ passport: object, context: object, grants: object, request: object, knownActions?: string[] }} вход
 */
export function evaluate(вход) {
  const паспорт = клон(вход?.passport);
  const контекст = клон(вход?.context);
  const пакетГрантов = клон(вход?.grants);
  const запрос = клон(вход?.request);
  const каталог = Object.freeze([...(вход?.knownActions ?? ИЗВЕСТНЫЕ_ДЕЙСТВИЯ)]);

  const idЗапроса = запрос?.id ?? null;

  if (!синтетическийВход(паспорт, контекст, пакетГрантов, запрос)) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.NON_SYNTHETIC_INPUT_REFUSED,
      reason_note: 'Вход не синтетический или sensitivity не TEST_ONLY. Реальные owner-данные и гранты запрещены.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  if (typeof запрос.subject !== 'string' || typeof запрос.action !== 'string' || typeof запрос.resource !== 'string') {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.INVALID_INPUT,
      reason_note: 'Запрос без subject/action/resource отклонён fail-closed.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  if (!известноеДействие(запрос.action, каталог)) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.UNKNOWN_ACTION,
      reason_note: 'Неизвестное действие. Каталог симуляции не авторизует произвольные операции.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  if (меткаПровайдераИлиМодели(запрос.subject)) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.PROVIDER_MODEL_LABEL_IS_NOT_SUBJECT,
      reason_note: 'Метка провайдера/модели не равна authenticated_subject и не входит в equivalent_subjects. MODEL_OUTPUT != OWNER_PERMISSION.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  if (!субъектыСовпадают(паспорт, контекст, запрос.subject)) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.SUBJECT_MISMATCH,
      reason_note: 'Субъект запроса не совпадает с аутентифицированным/эквивалентным синтетическим субъектом.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  const основа = запрос.authority_basis ?? 'GRANT';
  if (основа === 'AMBIGUOUS') {
    return записьРешения({
      decision: 'ESCALATE_TO_OWNER',
      reason_code: КОДЫ_ПРИЧИН.AMBIGUOUS_AUTHORITY,
      reason_note: 'Основа authority неоднозначна. Эскалация к owner (синтетическая, без канала).',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  const запрещённаяОснова = ОСНОВЫ_НЕ_ЯВЛЯЮЩИЕСЯ_AUTHORITY[основа];
  if (запрещённаяОснова) {
    return записьРешения({
      decision: 'DENY',
      reason_code: запрещённаяОснова.reason_code,
      reason_note: запрещённаяОснова.reason_note,
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  if (!ОСНОВЫ_GRANT.has(основа)) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.INVALID_INPUT,
      reason_note: 'Неизвестная основа authority отклонена fail-closed.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  if (контекстУстарел(контекст, запрос)) {
    return записьРешения({
      decision: 'ESCALATE_TO_OWNER',
      reason_code: КОДЫ_ПРИЧИН.STALE_REQUIRED_CONTEXT,
      reason_note: 'Обязательный синтетический контекст устарел. Эскалация, не авторизация.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }

  const список = Array.isArray(пакетГрантов.grants) ? пакетГрантов.grants : [];
  const сейчасМс = разобратьВремя(контекст.now);
  const совпавшие = список.filter((г) => грантСовпадает(г, запрос));
  const idsСовпавших = совпавшие.map((г) => г.id);

  const валидныеDeny = совпавшие.filter((г) => г.effect === 'DENY' && грантАктивенПоСтатусу(г) && !грантОтозван(г) && !грантИстёк(г, сейчасМс));
  if (валидныеDeny.length > 0) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.DENY_PRECEDENCE,
      reason_note: 'Совпадающий DENY-грант имеет приоритет над ALLOW. Это синтетический deny-overrides, не PEP.',
      matching_grant_ids: idsСовпавших,
      request_id: idЗапроса,
    });
  }

  const неоднозначные = совпавшие.filter((г) => г.ambiguous === true && грантАктивенПоСтатусу(г) && !грантОтозван(г) && !грантИстёк(г, сейчасМс));
  if (неоднозначные.length > 0) {
    return записьРешения({
      decision: 'ESCALATE_TO_OWNER',
      reason_code: КОДЫ_ПРИЧИН.AMBIGUOUS_AUTHORITY,
      reason_note: 'Совпадающий грант помечен как неоднозначный. TEST_GRANT != OWNER_AUTHORITY.',
      matching_grant_ids: idsСовпавших,
      request_id: idЗапроса,
    });
  }

  const валидныеAllow = совпавшие.filter((г) => г.effect === 'ALLOW' && грантАктивенПоСтатусу(г) && !грантОтозван(г) && !грантИстёк(г, сейчасМс) && г.ambiguous !== true);

  if (валидныеAllow.length > 1) {
    return записьРешения({
      decision: 'ESCALATE_TO_OWNER',
      reason_code: КОДЫ_ПРИЧИН.CONFLICTING_GRANTS,
      reason_note: 'Несколько валидных ALLOW-грантов на один запрос. Конфликт не разрешается автоматически.',
      matching_grant_ids: idsСовпавших,
      request_id: idЗапроса,
    });
  }

  if (валидныеAllow.length === 1) {
    return записьРешения({
      decision: 'ALLOW',
      reason_code: КОДЫ_ПРИЧИН.EXACT_VALID_GRANT,
      reason_note: 'Ровно один валидный синтетический TEST_GRANT. SIMULATED_ALLOW != REAL_AUTHORIZATION. TEST_GRANT != OWNER_AUTHORITY.',
      matching_grant_ids: idsСовпавших,
      request_id: idЗапроса,
    });
  }

  const истекшие = совпавшие.filter((г) => грантИстёк(г, сейчасМс));
  const отозванные = совпавшие.filter((г) => грантОтозван(г));
  if (совпавшие.length === 0) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.NO_GRANT,
      reason_note: 'Нет синтетического гранта на действие и ресурс.',
      matching_grant_ids: [],
      request_id: idЗапроса,
    });
  }
  if (истекшие.length === совпавшие.length) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.GRANT_EXPIRED,
      reason_note: 'Совпадающий грант истёк относительно context.now.',
      matching_grant_ids: idsСовпавших,
      request_id: idЗапроса,
    });
  }
  if (отозванные.length === совпавшие.length) {
    return записьРешения({
      decision: 'DENY',
      reason_code: КОДЫ_ПРИЧИН.GRANT_REVOKED,
      reason_note: 'Совпадающий грант отозван.',
      matching_grant_ids: idsСовпавших,
      request_id: idЗапроса,
    });
  }
  return записьРешения({
    decision: 'DENY',
    reason_code: КОДЫ_ПРИЧИН.NO_VALID_GRANT,
    reason_note: 'Совпадения есть, но ни один грант не валиден.',
    matching_grant_ids: idsСовпавших,
    request_id: idЗапроса,
  });
}

export function applyContextOverrides(контекст, переопределения) {
  if (!переопределения || typeof переопределения !== 'object') return клон(контекст);
  return { ...клон(контекст), ...клон(переопределения) };
}
