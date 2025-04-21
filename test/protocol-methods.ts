import assert from 'assert';
import test from 'node:test';
import { isBrpArray, isBrpIterable, isBrpObject, isPrimitive } from '../src/protocol';

test('isPrimitive & isBrpIterable & isBrpObject & isBrpArray', () => {
  const _string = 'hello';
  const _number = 123123;
  const _float = 213.1231;
  const _null = null;
  const _brpObject1 = {};
  const _brpObject2 = { something: 123 };
  const _array1 = [];
  const _array2 = [1, 12, 123];

  assert.strictEqual(isPrimitive(_string), true);
  assert.strictEqual(isPrimitive(_number), true);
  assert.strictEqual(isPrimitive(_float), true);
  assert.strictEqual(isPrimitive(_null), true);
  assert.strictEqual(isPrimitive(_brpObject1), false);
  assert.strictEqual(isPrimitive(_brpObject2), false);
  assert.strictEqual(isPrimitive(_array1), false);
  assert.strictEqual(isPrimitive(_array2), false);

  assert.strictEqual(isBrpIterable(_string), false);
  assert.strictEqual(isBrpIterable(_number), false);
  assert.strictEqual(isBrpIterable(_float), false);
  assert.strictEqual(isBrpIterable(_null), false);
  assert.strictEqual(isBrpIterable(_brpObject1), true);
  assert.strictEqual(isBrpIterable(_brpObject2), true);
  assert.strictEqual(isBrpIterable(_array1), true);
  assert.strictEqual(isBrpIterable(_array2), true);

  assert.strictEqual(isBrpObject(_string), false);
  assert.strictEqual(isBrpObject(_number), false);
  assert.strictEqual(isBrpObject(_float), false);
  assert.strictEqual(isBrpObject(_null), false);
  assert.strictEqual(isBrpObject(_brpObject1), true);
  assert.strictEqual(isBrpObject(_brpObject2), true);
  assert.strictEqual(isBrpObject(_array1), false);
  assert.strictEqual(isBrpObject(_array2), false);

  assert.strictEqual(isBrpArray(_string), false);
  assert.strictEqual(isBrpArray(_number), false);
  assert.strictEqual(isBrpArray(_float), false);
  assert.strictEqual(isBrpArray(_null), false);
  assert.strictEqual(isBrpArray(_brpObject1), false);
  assert.strictEqual(isBrpArray(_brpObject2), false);
  assert.strictEqual(isBrpArray(_array1), true);
  assert.strictEqual(isBrpArray(_array2), true);
});
