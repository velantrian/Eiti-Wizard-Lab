// Загрузка синтетических фикстур и запись evidence только в каталог evidence/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ЗДЕСЬ = path.dirname(fileURLToPath(import.meta.url));
export const КОРЕНЬ_ПЕСОЧНИЦЫ = path.resolve(ЗДЕСЬ, '..');
export const КАТАЛОГ_EVIDENCE = path.join(КОРЕНЬ_ПЕСОЧНИЦЫ, 'evidence');
export const КАТАЛОГ_GENERATED = path.join(КАТАЛОГ_EVIDENCE, 'generated');

export function читатьJson(относительный) {
  const полный = path.join(КОРЕНЬ_ПЕСОЧНИЦЫ, относительный);
  return JSON.parse(fs.readFileSync(полный, 'utf8'));
}

export function загрузитьФикстуры() {
  return {
    passport: читатьJson('fixtures/synthetic_passport.json'),
    context: читатьJson('fixtures/synthetic_context.json'),
    grants: читатьJson('fixtures/synthetic_grants.json'),
    knownActions: читатьJson('simulations/known_actions.json'),
    requests: читатьJson('simulations/requests.json'),
  };
}

export function запросПоId(пакет, id) {
  const найден = пакет.requests.requests.find((р) => р.id === id);
  if (!найден) throw new Error(`Нет синтетического запроса ${id}`);
  return structuredClone(найден);
}

export function записатьEvidence(имяФайла, запись) {
  const безопасноеИмя = path.basename(имяФайла);
  const полный = path.resolve(КАТАЛОГ_GENERATED, безопасноеИмя);
  const корень = path.resolve(КАТАЛОГ_GENERATED) + path.sep;
  if (!полный.startsWith(корень) && полный !== path.resolve(КАТАЛОГ_GENERATED)) {
    throw new Error('Запись evidence вне experiments/owner-authority-sandbox/evidence/generated/ запрещена');
  }
  fs.mkdirSync(КАТАЛОГ_GENERATED, { recursive: true });
  fs.writeFileSync(полный, JSON.stringify(запись, null, 2) + '\n');
  return полный;
}
