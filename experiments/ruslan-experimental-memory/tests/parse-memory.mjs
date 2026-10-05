// Разбор экспериментальной карты памяти. Читает только файлы внутри
// experiments/ruslan-experimental-memory/. LLM не используется.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROVENANCE = new Set([
  'OWNER_ASSERTED',
  'OBSERVED_FROM_PROJECT_SOURCE',
  'MODEL_SUMMARY',
  'MODEL_DERIVED_HYPOTHESIS',
  'UNKNOWN',
  'NOT_RECORDED',
]);

const ДОП_ПОЛЯ = new Set(['SOURCE_CLASS', 'SOURCE_REF', 'OBSERVED_AT']);

const ЭТОТ_ФАЙЛ = fileURLToPath(import.meta.url);
export const КОРЕНЬ_ЭКСПЕРИМЕНТА = path.resolve(path.dirname(ЭТОТ_ФАЙЛ), '..');

function нормализовать(п) {
  return path.resolve(п);
}

export function путьВнутриЭксперимента(абсолютныйПуть) {
  const корень = нормализовать(КОРЕНЬ_ЭКСПЕРИМЕНТА);
  const цель = нормализовать(абсолютныйПуть);
  const префикс = корень.endsWith(path.sep) ? корень : корень + path.sep;
  return цель === корень || цель.startsWith(префикс);
}

export function запрещённыйВнешнийПуть(абсолютныйПуть) {
  const цель = нормализовать(абсолютныйПуть).replaceAll('\\', '/');
  return (
    цель.includes('/docs/memory/') ||
    цель.endsWith('/docs/memory') ||
    цель.includes('/experiments/owner-authority-sandbox/') ||
    цель.endsWith('/experiments/owner-authority-sandbox')
  );
}

export function читатьТолькоЭксперимент(относительныйИлиАбсолютный) {
  const абсолютный = path.isAbsolute(относительныйИлиАбсолютный)
    ? нормализовать(относительныйИлиАбсолютный)
    : нормализовать(path.join(КОРЕНЬ_ЭКСПЕРИМЕНТА, относительныйИлиАбсолютный));
  if (!путьВнутриЭксперимента(абсолютный)) {
    throw new Error(`READ_DENIED_OUTSIDE_EXPERIMENT: ${абсолютный}`);
  }
  if (запрещённыйВнешнийПуть(абсолютный)) {
    throw new Error(`READ_DENIED_FORBIDDEN_TREE: ${абсолютный}`);
  }
  return fs.readFileSync(абсолютный, 'utf8');
}

function разобратьХвостProvenance(хвост) {
  const части = хвост.split(/\s*\|\s*/).map((ч) => ч.trim()).filter(Boolean);
  let provenance = null;
  const extras = {};
  for (const часть of части) {
    if (PROVENANCE.has(часть) && !provenance) {
      provenance = часть;
      continue;
    }
    const доп = часть.match(/^([A-Z_]+)=(.*)$/);
    if (доп && ДОП_ПОЛЯ.has(доп[1])) {
      extras[доп[1]] = доп[2].trim();
      continue;
    }
    return null;
  }
  return { provenance, extras };
}

export function разобратьКлючЗначение(строка) {
  const обрезанная = строка.trim();
  const бар = обрезанная.indexOf('|');
  let левая;
  let хвост = '';
  if (бар === -1) {
    левая = обрезанная;
  } else {
    левая = обрезанная.slice(0, бар).trim();
    хвост = обрезанная.slice(бар + 1).trim();
  }
  const сопоставление = левая.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!сопоставление) return null;
  let provenance = null;
  let extras = {};
  if (хвост) {
    const разобранныйХвост = разобратьХвостProvenance(хвост);
    if (!разобранныйХвост) return null;
    provenance = разобранныйХвост.provenance;
    extras = разобранныйХвост.extras;
  }
  if (provenance && !PROVENANCE.has(provenance)) return null;
  return {
    key: сопоставление[1],
    value: сопоставление[2].trim(),
    provenance,
    extras,
  };
}

export function разобратьМаркерСписка(строка) {
  const сопоставление = строка.trim().match(/^- \[([A-Z_]+)\]\s+(.*)$/);
  if (!сопоставление) return null;
  const provenance = сопоставление[1];
  if (!PROVENANCE.has(provenance)) return null;
  const остаток = сопоставление[2].trim();
  const бар = остаток.indexOf(' | ');
  let text = остаток;
  let extras = {};
  if (бар !== -1) {
    text = остаток.slice(0, бар).trim();
    const хвост = разобратьХвостProvenance(остаток.slice(бар + 3).trim());
    if (хвост) extras = хвост.extras;
  }
  return { provenance, text, extras };
}

export function разобратьКарту(текст) {
  const keys = {};
  const sections = {};
  const bullets = [];
  let текущаяСекция = 'ROOT';
  sections[текущаяСекция] = [];

  for (const сырая of текст.split(/\r?\n/)) {
    const строка = сырая.trim();
    const заголовок = строка.match(/^##\s+([A-Z0-9_]+)\s*$/);
    if (заголовок) {
      текущаяСекция = заголовок[1];
      if (!sections[текущаяСекция]) sections[текущаяСекция] = [];
      continue;
    }
    const kv = разобратьКлючЗначение(строка);
    if (kv) {
      keys[kv.key] = kv;
      continue;
    }
    if (строка.startsWith('- ')) {
      sections[текущаяСекция].push(строка.slice(2).trim());
      const bullet = разобратьМаркерСписка(строка);
      if (bullet) {
        bullets.push({ section: текущаяСекция, ...bullet, raw: строка });
      }
    }
  }

  return { keys, sections, bullets };
}

export function загрузитьКартуПамяти() {
  const текст = читатьТолькоЭксперимент('RUSLAN_EXPERIMENTAL_MEMORY.md');
  return разобратьКарту(текст);
}

export function значение(карта, ключ) {
  const запись = карта.keys[ключ];
  if (!запись) throw new Error(`MISSING_KEY: ${ключ}`);
  return запись.value;
}

export function списокЧекпоинтов() {
  const каталог = path.join(КОРЕНЬ_ЭКСПЕРИМЕНТА, 'checkpoints');
  if (!путьВнутриЭксперимента(каталог)) {
    throw new Error('READ_DENIED_OUTSIDE_EXPERIMENT: checkpoints');
  }
  return fs
    .readdirSync(каталог)
    .filter((имя) => имя.endsWith('.md'))
    .sort();
}

export function извлечьОтветыДляResume(карта) {
  return {
    current_project: значение(карта, 'CURRENT_PROJECT'),
    current_thread: значение(карта, 'CURRENT_THREAD'),
    current_goal: значение(карта, 'CURRENT_GOAL'),
    current_status: значение(карта, 'CURRENT_STATUS'),
    last_stop_point: значение(карта, 'LAST_STOP_POINT'),
    last_completed_step: значение(карта, 'LAST_COMPLETED_STEP'),
    current_blocker: значение(карта, 'CURRENT_BLOCKER'),
    next_bounded_action: значение(карта, 'NEXT_BOUNDED_ACTION'),
    do_not_touch_canon: значение(карта, 'DO_NOT_TOUCH_CANON'),
    do_not_touch_official_memory: значение(карта, 'DO_NOT_TOUCH_OFFICIAL_MEMORY'),
    do_not_merge: значение(карта, 'DO_NOT_MERGE'),
    do_not_mix_owner_authority: значение(карта, 'DO_NOT_MIX_OWNER_AUTHORITY_SANDBOX'),
    do_not_add_graph: значение(карта, 'DO_NOT_ADD_GRAPH'),
    do_not_add_rag: значение(карта, 'DO_NOT_ADD_RAG'),
    do_not_add_sqlite: значение(карта, 'DO_NOT_ADD_SQLITE'),
    do_not_add_ingestion: значение(карта, 'DO_NOT_ADD_AUTO_INGESTION'),
    do_not_add_authority: значение(карта, 'DO_NOT_ADD_REAL_AUTHORITY_OR_GRANTS'),
    do_not_canon_integration: значение(карта, 'DO_NOT_CANON_INTEGRATION'),
    do_not_start_v02: значение(карта, 'DO_NOT_START_V02'),
    allowed_read_root: значение(карта, 'ALLOWED_READ_ROOT'),
    structured_resume_test: значение(карта, 'STRUCTURED_RESUME_TEST'),
    cross_session_ai_resume_test: значение(карта, 'CROSS_SESSION_AI_RESUME_TEST'),
  };
}
