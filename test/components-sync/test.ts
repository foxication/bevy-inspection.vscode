import { test, TestContext } from 'node:test';
import { DataPathSegment, DataSyncManager } from '../../src/web-components/sync';
import { BevyRemoteProtocol, BrpValue, TypePath } from '../../src/protocol';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { inspect } from 'util';

test('components synchronization', async (t: TestContext) => {
  const manifestPath = 'test/server-all-types/Cargo.toml';
  // compile "server-all-types"
  console.log('Compilation of "server-all-types" in progress...');
  await t.test('server compilation', async (t: TestContext) => {
    const compilation = await spawnSync('cargo', ['build', '--manifest-path', manifestPath]);
    t.assert.strictEqual(compilation.status, 0);
  });

  // run "server-all-types"
  let isTestFinished = false;
  let server: ChildProcessWithoutNullStreams | undefined;
  await t.test('server start', async (t: TestContext) => {
    server = spawn('cargo', ['run', '--manifest-path', manifestPath]);
    server.on('exit', (code) => {
      t.assert.ok(isTestFinished, `server exited before tests are finished: ${code ?? 0}`);
    });
  });

  await t.test('on working server', async (t: TestContext) => {
    // create protocol
    const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, '0.16');

    // wait for connection
    await t.test('connection with server', { timeout: 30 * 1000 }, async (t: TestContext) => {
      const attemptInterval = 500;
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      t.assert.ok(server);
      while (!server.exitCode) {
        await sleep(attemptInterval);
        const components = await protocol.list().catch(() => null);
        if (components) if (components.result) break;
      }
    });

    let entity: number | undefined;
    let componentNames: TypePath[] | undefined;
    let syncManager: DataSyncManager | undefined;

    await t.test('Data tree creation', async (t: TestContext) => {
      // Receive registry schema
      const registrySchema = (await protocol.registrySchema()).result;
      t.assert.ok(registrySchema);

      // Receive all components of special entity
      const queryResponse = await protocol.query({ filterWith: ['server_all_types::Special'] });
      t.assert.ok(queryResponse.result);
      entity = queryResponse.result[0].entity;

      componentNames = (await protocol.list(entity)).result;
      t.assert.ok(componentNames);

      const getResponse = await protocol.get(entity, componentNames);
      assertEqualOrCreateFile(t, getResponse.result ?? {}, 'sync-get-response');
      const componentRegistry = getResponse.result?.components;
      t.assert.ok(componentRegistry);

      // Render debug tree
      syncManager = new DataSyncManager(componentRegistry, registrySchema);
      const treeResult = syncManager.debugTree();
      assertEqualOrCreateFile(t, treeResult, 'sync-initial-tree');
    });

    await t.test('Handle changes of mutate_components', async (t: TestContext) => {
      t.assert.ok(entity);

      const assertEqualComponents = async (
        direction: DataPathSegment[],
        title: string,
        toLogResponse: boolean = false
      ) => {
        t.assert.ok(entity);
        t.assert.ok(componentNames);
        t.assert.ok(syncManager);
        if (typeof direction[0] !== 'string') t.assert.fail("filter doesn't include componentName");

        // Apply changes
        const componentTypePath = direction[0];
        const getResponse = await protocol.get(entity, [componentTypePath]);
        syncManager.mapOfComponents[componentTypePath] = getResponse.result?.components[componentTypePath] ?? {};
        if (toLogResponse) console.log(inspect(getResponse.result, false, null, true));

        // Update tree
        syncManager.sync();

        // Check`
        assertEqualOrCreateFile(t, syncManager.debugTree(direction), title);
      };
      const mutate = async (componentTypePath: TypePath, path: string, value: BrpValue) => {
        t.assert.ok(entity);
        const response = await protocol.mutateComponent(entity, componentTypePath, path, value);
        if (response.error) console.error(`Error: ${JSON.stringify(response.error)}`);
      };

      const collectionsTypePath = 'server_all_types::Collections';
      const personTypePath = 'server_all_types::Person';
      const gameStateTypePath = 'server_all_types::GameState';

      // Serialized
      await mutate(collectionsTypePath, '.sequences.array[2]', 3000000);
      await mutate(collectionsTypePath, '.sequences.vec[1]', 2000000);
      await mutate(collectionsTypePath, '.sequences.vec_deque[1]', 5000000);
      await mutate(collectionsTypePath, '.maps.hash_set[1]', 123456); // unsupported
      await mutate(collectionsTypePath, '.maps.hash_map[Second]', 2222); // unsupported
      await mutate(collectionsTypePath, '.tuples.0.2', 200);
      await mutate(collectionsTypePath, '.tuples.1.4', -300);
      await mutate(collectionsTypePath, '.tuples.1.4', -300);
      await assertEqualComponents([collectionsTypePath], 'sync-mutation-1');
      await mutate(personTypePath, '.name', 'Mr. Night');
      await assertEqualComponents([personTypePath], 'sync-mutation-2');

      // List
      await mutate(collectionsTypePath, '.sequences.vec', [10, 20, 30, 40, 50, 60, 70]);
      await mutate(collectionsTypePath, '.sequences.vec_deque', [200]); // unsupported
      await assertEqualComponents([collectionsTypePath, 'sequences'], 'sync-list-length');

      // Enum
      await mutate(gameStateTypePath, '', 'Pause');
      await assertEqualComponents([gameStateTypePath], 'sync-enum-1');
      await mutate(gameStateTypePath, '', { Loading: 123 });
      await assertEqualComponents([gameStateTypePath], 'sync-enum-2');
      await mutate(gameStateTypePath, '', 'Playing');
      await assertEqualComponents([gameStateTypePath], 'sync-enum-3');

      // Set
      await mutate(collectionsTypePath, '.sets.hash_set', [1, 2, 3, 4, 5]);
      await assertEqualComponents([collectionsTypePath, 'sets'], 'sync-set-1');
      await mutate(collectionsTypePath, '.sets.hash_set', [6]); // unsupported
      await assertEqualComponents([collectionsTypePath, 'sets'], 'sync-set-2');
    });
  });
  isTestFinished = true;
  server?.kill();
});

function assertEqualOrCreateFile(t: TestContext, actual: object | string, name: string) {
  if (typeof actual === 'string') {
    const filename = 'test/components-sync/' + name + '.txt';
    if (existsSync(filename)) {
      const expected = readFileSync(filename).toString('utf8');
      t.assert.strictEqual(actual, expected);
      return;
    }
    writeFileSync(filename, actual);
    console.log(`New test file created: ${filename}`);
    return;
  }
  const filename = 'test/components-sync/' + name + '.json';
  if (existsSync(filename)) {
    const expected = readFileSync(filename).toString('utf8');
    t.assert.deepStrictEqual(actual, JSON.parse(expected));
    return;
  }
  writeFileSync(filename, JSON.stringify(actual));
  console.log(`New test file created: ${filename}`);
}
