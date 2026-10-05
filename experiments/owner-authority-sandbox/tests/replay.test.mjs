// Отдельный повтор: три независимых вызова с полным клоном входа.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../pdp/evaluate.mjs';
import { загрузитьФикстуры, запросПоId } from '../harness/helpers.mjs';

test('повтор с полным structuredClone входа идентичен', () => {
  const фикстуры = загрузитьФикстуры();
  const собрать = () => {
    const request = запросПоId(фикстуры, 'REQ-19-REPLAY');
    delete request.context_overrides;
    delete request.notes;
    delete request.case;
    return evaluate({
      passport: structuredClone(фикстуры.passport),
      context: structuredClone(фикстуры.context),
      grants: structuredClone(фикстуры.grants),
      request,
      knownActions: [...фикстуры.knownActions.actions],
    });
  };
  const а = собрать();
  const б = собрать();
  const в = собрать();
  assert.equal(JSON.stringify(а), JSON.stringify(б));
  assert.equal(JSON.stringify(б), JSON.stringify(в));
});
