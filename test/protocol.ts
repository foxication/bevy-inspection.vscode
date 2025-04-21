// Test of basic usage of library
import test from 'node:test';
import assert from 'assert';
import {
  BrpGetWatchResult,
  BrpGetWatchStrictResult,
  BrpListWatchResult,
  BrpValue,
  BevyVersion,
} from '../src/protocol/types';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { BevyRemoteProtocol } from '../src/protocol/protocol';

testWithServer('test/server/manifest/v0.15/Cargo.toml', '0.15');
testWithServer('test/server/manifest/main/Cargo.toml', '0.16');

export function testWithServer(manifestPath: string, version: BevyVersion) {
  test(`testing ${manifestPath}`, async (t) => {
    let isCompiled = false;
    await t.test('server compilation', async () => {
      const compilation = await spawnSync('cargo', ['build', '--manifest-path', manifestPath]);
      if (compilation.status !== 0) {
        assert.fail(
          'compilation error(' + compilation.status?.toString() + '):\n' + compilation.output
        );
      }
      isCompiled = true;
    });

    let isRunning = false;
    let isTestFinished = false;
    let server: ChildProcessWithoutNullStreams | undefined;
    await t.test('server start', { skip: !isCompiled }, async () => {
      server = spawn('cargo', ['run', '--manifest-path', manifestPath]);
      server.on('exit', (code) => {
        assert.ok(isTestFinished, `server exited before tests are finished: ${code ?? 0}`);
      });
      isRunning = true;
    });

    const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, version);

    const is0x15 = protocol.serverVersion === '0.15';
    // const isV0_16 = protocol.serverVersion === ServerVersion.V0_16;

    let isConnected = false;
    await t.test('connection with server', { skip: !isRunning, timeout: 30 * 1000 }, async () => {
      const attemptInterval = 500;
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      assert.ok(server);
      while (!server.exitCode) {
        await sleep(attemptInterval);
        const components = await protocol.list().catch(() => null);
        if (components) if (components.result) break;
      }
      isConnected = true;
    });

    await t.test('testing protocol', { skip: !isConnected }, async (t) => {
      await t.test('get & get_strict', async () => testGet(protocol));
      await t.test('query_empty', async () => testQueryEmpty(protocol));
      await t.test('query_by_components', async () => testQueryByComponents(protocol));
      await t.test('list_entity', async () => testListEntity(protocol));
      await t.test('list_all', async () => testListAll(protocol));
      await t.test('insert & remove', async () => testInsertThenRemove(protocol));
      await t.test('spawn & destroy', async () => testSpawnThenDestroy(protocol));
      await t.test('reparent', { skip: is0x15 }, async () => testReparent(protocol));
      await t.test('get+watch', async () => testGetWatch(protocol));
      await t.test('get+watch (strict)', async () => testGetWatchStrict(protocol));
      await t.test('list+watch', async () => testListWatch(protocol));
      await t.test('list+watch (all)', { todo: true }, async () => {});
      await t.test('registry_schema', { skip: is0x15 }, async () => testRegistrySchema(protocol));
    });

    isTestFinished = true;
    server?.kill();
  });
}

export async function testGet(protocol: BevyRemoteProtocol): Promise<void> {
  const reference0x15 = {
    components: {
      [protocol.commonTypePaths('Name')]: 'Parent Node',
      'server::FavoriteEntity': null,
      'server::Position': {
        x: 0,
        y: 0,
        z: 0,
      },
      'server::Shape': 'Circle',
    },
    errors: {},
  };

  const reference0x16 = {
    components: {
      [protocol.commonTypePaths('Children')]: [],
      [protocol.commonTypePaths('Name')]: 'Parent Node',
      'server::FavoriteEntity': null,
      'server::Position': {
        x: 0,
        y: 0,
        z: 0,
      },
      'server::Shape': 'Circle',
    },
    errors: {},
  };

  // recieve entityId of favorite entity
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0]
    .entity;
  assert.ok(entity);

  // recieve components of favorite entity
  const typePaths = await (await protocol.list(entity)).result;
  assert.ok(typePaths);

  // get
  if (protocol.serverVersion === '0.15') {
    const res = await protocol.get(
      entity,
      typePaths.filter((value) => {
        return value !== protocol.commonTypePaths('Children');
      })
    );
    assert.ifError(res.error);
    assert.deepEqual(res.result, reference0x15);
  }
  if (protocol.serverVersion === '0.16') {
    const res = await protocol.get(entity, typePaths);
    assert.ifError(res.error);
    assert.ok(res.result);
    if (protocol.commonTypePaths('Children') in res.result.components) {
      res.result.components[protocol.commonTypePaths('Children')] = [];
    }
    assert.deepEqual(res.result, reference0x16);
  }

  // get (strict)
  if (protocol.serverVersion === '0.15') {
    const res = await protocol.getStrict(
      entity,
      typePaths.filter((value) => {
        return value !== protocol.commonTypePaths('Children');
      })
    );
    assert.ifError(res.error);
    assert.deepEqual(res.result, reference0x15.components);
  }
  if (protocol.serverVersion === '0.16') {
    const res = await protocol.getStrict(entity, typePaths);
    assert.ifError(res.error);
    assert.ok(res.result);
    if (protocol.commonTypePaths('Children') in res.result) {
      res.result[protocol.commonTypePaths('Children')] = [];
    }
    assert.deepEqual(res.result, reference0x16.components);
  }
}

export async function testQueryEmpty(protocol: BevyRemoteProtocol): Promise<void> {
  const response = await protocol.query({});
  assert.ifError(response.error);
  assert.ok(response.result);

  for (let i = 0, l = response.result.length; i < l; i++) {
    response.result[i].entity = 0;
  }
  assert.deepEqual(
    response.result,
    Array(response.result.length).fill({ components: {}, entity: 0 })
  );
}

export async function testQueryByComponents(protocol: BevyRemoteProtocol): Promise<void> {
  const response = await protocol.query({ components: ['server::FavoriteEntity'] });
  assert.ok(response.result);
  assert.ifError(response.error);

  assert.strictEqual(response.result.length, 1);
  response.result[0].entity = 0;
  assert.deepEqual(response.result, [
    { components: { 'server::FavoriteEntity': null }, entity: 0 },
  ]);
}

export async function testListEntity(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0]
    .entity;
  assert.ok(entity);

  const response = await protocol.list(entity);
  assert.deepEqual(
    response.result?.sort(),
    [
      protocol.commonTypePaths('Children'),
      protocol.commonTypePaths('Name'),
      'server::FavoriteEntity',
      'server::Position',
      'server::Shape',
    ].sort()
  );
}

export async function testListAll(protocol: BevyRemoteProtocol): Promise<void> {
  const response = await protocol.list();
  assert.ifError(response.error);
  if (protocol.serverVersion === '0.15') {
    assert.deepEqual(response.result?.sort(), [
      protocol.commonTypePaths('Name'),
      'server::Description',
      'server::ExistenceTime',
      'server::FavoriteEntity',
      'server::LovelyOne',
      'server::Position',
      'server::Shape',
    ]);
  }
  if (protocol.serverVersion === '0.16') {
    assert.deepEqual(response.result?.sort(), [
      'bevy_ecs::hierarchy::ChildOf',
      protocol.commonTypePaths('Children'),
      protocol.commonTypePaths('Name'),
      'server::Description',
      'server::ExistenceTime',
      'server::FavoriteEntity',
      'server::LovelyOne',
      'server::Position',
      'server::Shape',
    ]);
  }
}

export async function testInsertThenRemove(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0]
    .entity;
  assert.ok(entity);

  let resTypes = await protocol.list(entity);
  assert.deepEqual(
    resTypes.result?.sort(),
    [
      protocol.commonTypePaths('Children'),
      protocol.commonTypePaths('Name'),
      'server::FavoriteEntity',
      'server::Position',
      'server::Shape',
    ].sort()
  );

  let resNull = await protocol.insert(entity, {
    'server::Description': 'Testing insertion and removing',
  });
  assert.ifError(resNull.result);
  assert.ifError(resNull.error);

  resTypes = await protocol.list(entity);
  assert.deepEqual(
    resTypes.result?.sort(),
    [
      protocol.commonTypePaths('Children'),
      protocol.commonTypePaths('Name'),
      'server::Description',
      'server::FavoriteEntity',
      'server::Position',
      'server::Shape',
    ].sort()
  );

  resNull = await protocol.remove(entity, ['server::Description']);
  assert.ifError(resNull.result);
  assert.ifError(resNull.error);

  resTypes = await protocol.list(entity);
  assert.deepEqual(
    resTypes.result?.sort(),
    [
      protocol.commonTypePaths('Children'),
      protocol.commonTypePaths('Name'),
      'server::FavoriteEntity',
      'server::Position',
      'server::Shape',
    ].sort()
  );
}

export async function testSpawnThenDestroy(protocol: BevyRemoteProtocol): Promise<void> {
  const lengthBefore = (await protocol.query({})).result?.length;
  assert.ok(lengthBefore);

  const spawnRes = await protocol.spawn({
    [protocol.commonTypePaths('Name')]: 'Newborn Node',
    'server::Description': 'just created node by brp.spawn()',
    'server::Position': {
      x: 5,
      y: 5,
      z: 7,
    },
  });
  assert.ok(spawnRes.result);
  assert.ok(typeof spawnRes.result.entity === 'number');
  assert.ifError(spawnRes.error);
  assert.strictEqual((await protocol.query({})).result?.length, lengthBefore + 1);

  const destroyRes = await protocol.destroy(spawnRes.result.entity);
  assert.ifError(destroyRes.result);
  assert.ifError(destroyRes.error);
  assert.strictEqual((await protocol.query({})).result?.length, lengthBefore);
}

export async function testReparent(protocol: BevyRemoteProtocol): Promise<void> {
  const parent = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0]
    .entity;
  assert.ok(parent);

  const child0 = (await protocol.spawn({ 'bevy_ecs::name::Name': 'test child 1' })).result?.entity;
  assert.ok(child0);
  const child1 = (await protocol.spawn({ 'bevy_ecs::name::Name': 'test child 2' })).result?.entity;
  assert.ok(child1);
  protocol.reparent([child0, child1], parent);

  const response = await protocol.query({
    components: [protocol.commonTypePaths('Children')],
    filterWith: ['server::FavoriteEntity'],
  });
  assert.ok(response.result);

  const children: BrpValue = response.result[0].components[protocol.commonTypePaths('Children')];
  assert.ok(Array.isArray(children) && children.every((item) => typeof item === 'number'));
  assert.ok(children.includes(child0));
  assert.ok(children.includes(child1));

  await protocol.destroy(child0);
  await protocol.destroy(child1);
}

export async function testGetWatch(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::Description'] })).result?.[0].entity;
  assert.ok(entity);

  let changed: BrpGetWatchResult | undefined;
  const apply = { 'server::Description': 'here is updated description' };
  const controller = new AbortController();
  const observer = (arg: BrpGetWatchResult) => {
    changed = arg;
    controller.abort();
  };

  const promise = protocol.getWatch(entity, ['server::Description'], controller.signal, observer);
  await protocol.insert(entity, apply);

  await promise;
  assert.deepEqual(changed, {
    components: apply,
    errors: {},
    removed: [],
  });
}

export async function testGetWatchStrict(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::Description'] })).result?.[0].entity;
  assert.ok(entity);

  const apply = { 'server::Description': 'here is updated description' };
  const controller = new AbortController();
  const observer = (changed: BrpGetWatchStrictResult) => {
    assert.deepEqual(changed, { components: apply, removed: [] });
    controller.abort();
  };

  const promise = protocol.getWatchStrict(
    entity,
    ['server::Description'],
    controller.signal,
    observer
  );
  await protocol.insert(entity, apply);
  await promise;
}

export async function testListWatch(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0]
    .entity;
  assert.ok(entity);

  const toInsert = { 'server::Description': 'added new component (Description)' };
  const controller = new AbortController();
  const observer = (changed: BrpListWatchResult) => {
    assert.deepEqual(changed, { components: toInsert, removed: [] });
    controller.abort();
  };

  const promise = protocol.listWatch(controller.signal, observer, entity);
  await protocol.insert(entity, toInsert);
  await promise;

  // clear changes
  await protocol.remove(entity, ['server::Description']);
}

export async function testListWatchAll(protocol: BevyRemoteProtocol): Promise<void> {
  const entity = (await protocol.query({ filterWith: ['server::FavoriteEntity'] })).result?.[0]
    .entity;
  assert.ok(entity);

  const controller = new AbortController();
  const observer = (changed: BrpListWatchResult) => {
    assert.deepEqual(changed, undefined); // TODO: response
  };

  const promise = protocol.listWatch(controller.signal, observer);
  // TODO: register new component
  await promise;
  // TODO: clear changes
}

export async function testRegistrySchema(protocol: BevyRemoteProtocol): Promise<void> {
  const response = await protocol.registrySchema();
  const expected = {
    'server::Description': {
      crateName: 'server',
      items: false,
      kind: 'TupleStruct',
      modulePath: 'server',
      prefixItems: [{ type: { $ref: '#/$defs/alloc::string::String' } }],
      reflectTypes: ['Component', 'Serialize', 'Deserialize'],
      shortPath: 'Description',
      type: 'array',
      typePath: 'server::Description',
    },
    'server::FavoriteEntity': {
      additionalProperties: false,
      crateName: 'server',
      kind: 'Struct',
      modulePath: 'server',
      reflectTypes: ['Component', 'Serialize', 'Deserialize'],
      shortPath: 'FavoriteEntity',
      type: 'object',
      typePath: 'server::FavoriteEntity',
    },
    'server::LovelyOne': {
      additionalProperties: false,
      crateName: 'server',
      kind: 'Struct',
      modulePath: 'server',
      reflectTypes: ['Component', 'Serialize', 'Deserialize'],
      shortPath: 'LovelyOne',
      type: 'object',
      typePath: 'server::LovelyOne',
    },
  };
  assert.ok(response.result);

  // Check if custom types are registered
  assert.deepEqual(response.result['server::Description'], expected['server::Description']);
  assert.deepEqual(response.result['server::FavoriteEntity'], expected['server::FavoriteEntity']);
  assert.deepEqual(response.result['server::LovelyOne'], expected['server::LovelyOne']);

  // Check essential BrpRegistry fields
  assert.strictEqual(response.result['server::Description'].typePath, 'server::Description');
  assert.strictEqual(response.result['server::Description'].shortPath, 'Description');
  assert.strictEqual(response.result['server::Description'].kind, 'TupleStruct');
  assert.strictEqual(response.result['server::Description'].type, 'array');
}
