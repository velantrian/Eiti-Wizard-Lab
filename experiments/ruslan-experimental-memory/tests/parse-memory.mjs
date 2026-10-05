// Разбор экспериментальной карты памяти. Читает только файлы внутри
// experiments/ruslan-experimental-memory/. LLM не используется.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROVENANCE = new Set([
  'OWNER_ASSERTED',
  'MODEL_SUMMARY',
  'MODEL_DERIVED_HYPOTHESIS',
  'UNKNOWN',
  'NOT_RECORDED',
]);

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

export function разобратьКлючЗначение(строка) {
  const обрезанная = строка.trim();
  const сопоставление = обрезанная.match(
    /^([A-Z][A-Z0-9_]*)=(.*?)(?:\s*\|\s*([A-Z_]+))?\s*$/,
  );
  if (!сопоставление) return null;
  const provenance = сопоставление[3] || null;
  if (provenance && !PROVENANCE.has(provenance)) return null;
  return {
    key: сопоставление[1],
    value: сопоставление[2].trim(),
    provenance,
  };
}

export function разобратьКарту(текст) {
  const keys = {};
  const sections = {};
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
    }
  }

  return { keys, sections };
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
  };
}
