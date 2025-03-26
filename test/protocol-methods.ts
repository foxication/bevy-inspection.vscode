import assert from 'assert';
import test from 'node:test';
import { short, BrpStructure } from '../src/protocol';

test('short TypePath', () => {
  assert.strictEqual(short('Crypto'), 'Crypto');
  assert.strictEqual(short('bevy_ecs::something::Crypto'), 'Crypto');
  assert.strictEqual(short('bevy_ecs::something::Crypto<hell::Satan>'), 'Crypto');
});
test('BrpValueWrapped methods', () => {
  // basic
  assert.strictEqual(new BrpStructure(1).get(), 1);
  assert.strictEqual(new BrpStructure('hello').get(), 'hello');
  assert.strictEqual(new BrpStructure(true).get(), true);
  assert.strictEqual(new BrpStructure(null).get(), null);

  // objects
  const data0 = new BrpStructure({ word1: 'hello', word2: 'world' });
  assert.deepStrictEqual(data0.get(), { word1: 'hello', word2: 'world' });
  assert.strictEqual(data0.get(['word1']), 'hello');
  assert.strictEqual(data0.get(['word2']), 'world');

  // arrays
  const data1 = new BrpStructure(['hello', 'world']);
  assert.deepStrictEqual(data1.get(), ['hello', 'world']);
  assert.strictEqual(data1.get([0]), 'hello');
  assert.strictEqual(data1.get([1]), 'world');

  // hybrid
  assert.strictEqual(new BrpStructure({ person: [0, 1, 2, 3, 4, 5] }).get(['person', 1]), 1);
  assert.strictEqual(new BrpStructure([0, 1, { person: 'Vladimir' }, 3, 4, 5]).get([2, 'person']), 'Vladimir');

  // mutation
  const data2 = new BrpStructure({ first: 'Hello,', middle: 'cruel', last: 'world!' });
  data2.set(['middle'], 'fantasy');
  assert.deepStrictEqual(data2.get(), { first: 'Hello,', middle: 'fantasy', last: 'world!' });

  data2.set(['middle'], ['f', 'u', 'n']);
  assert.deepStrictEqual(data2.get(), { first: 'Hello,', middle: ['f', 'u', 'n'], last: 'world!' });

  const data3 = new BrpStructure(null);
  data3.set([], { description: 'replaced' });
  assert.deepStrictEqual(data3.get(), { description: 'replaced' });

  const data4 = new BrpStructure(null);
  data4.set(undefined, { info: 'replaced' });
  assert.deepStrictEqual(data4.get(), { info: 'replaced' });

  // don't change input data
  const data5 = new BrpStructure({ hello: 'some', cruel: 'things', world: 'hide' });
  const path = ['hello'];
  data5.has(path);
  data5.get(path);
  data5.set(path, 'all');
  assert.deepStrictEqual(path, ['hello']);

  // has
  const data6 = new BrpStructure({
    hello: { hello: 'glad to see' },
    world: { first: 'everything', second: 'universe' },
  });
  assert.ok(data6.has(['hello']));
  assert.ok(data6.has(['world']));
  assert.ok(data6.has(['world', 'second']));

  assert.strictEqual(data6.has(['some']), false);
  assert.strictEqual(data6.has(['world', 'third']), false);

  // keys
  assert.deepStrictEqual(data2.keys(), ['first', 'middle', 'last']);
  assert.deepStrictEqual(data2.keys(['middle']), [0, 1, 2]);

  // values
  assert.deepStrictEqual(data2.values(), ['Hello,', ['f', 'u', 'n'], 'world!']);
  assert.deepStrictEqual(data2.values(['middle']), ['f', 'u', 'n']);
});
