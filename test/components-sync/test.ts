import { test, TestContext } from 'node:test';
import { DataPathSegment, DataSyncManager } from '../../src/web-components/sync';
import { BevyRemoteProtocol, BrpComponentRegistry, BrpValue, TypePath } from '../../src/protocol';
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
      syncManager = new DataSyncManager(componentRegistry, registrySchema, undefined);
      const treeResult = syncManager.debugTree();
      assertEqualOrCreateFile(t, treeResult, 'sync-initial-tree');
    });

    await t.test('Handle changes of mutate_components', async (t: TestContext) => {
      t.assert.ok(entity);
      t.assert.ok(syncManager);

      const collectionsTypePath = 'server_all_types::Collections';
      const personTypePath = 'server_all_types::Person';
      const gameStateTypePath = 'server_all_types::GameState';
      const singleValueTypePath = 'server_all_types::SingleValue';
      const insertedTypePath = 'server_all_types::Inserted';
      const insertedAlterTypePath = 'server_all_types::InsertedAlter';
      const allTypePaths = [
        collectionsTypePath,
        personTypePath,
        gameStateTypePath,
        singleValueTypePath,
        insertedTypePath,
        insertedAlterTypePath,
      ];

      const assertEqualComponents = async (
        direction: DataPathSegment[],
        title: string,
        toUpdateComponents: boolean = true,
        onlyLog: boolean = false
      ) => {
        t.assert.ok(entity);
        t.assert.ok(componentNames);
        t.assert.ok(syncManager);

        // Apply changes
        if (typeof direction[0] === 'string' && toUpdateComponents) {
          const componentTypePath = direction[0];
          const getResponse = await protocol.get(entity, [componentTypePath]);
          if (getResponse.result?.components[componentTypePath] !== undefined) {
            syncManager.mapOfComponents[componentTypePath] = getResponse.result?.components[componentTypePath];
          } else {
            delete syncManager.mapOfComponents[componentTypePath];
          }
          if (onlyLog) console.log(inspect(getResponse.result, false, null, true));
        }

        // Apply changes to All components
        if (typeof direction[0] !== 'string' && toUpdateComponents) {
          const getResponse = await protocol.get(entity, allTypePaths);
          for (const typePath of allTypePaths) {
            if (getResponse.result?.components[typePath] !== undefined) {
              syncManager.mapOfComponents[typePath] = getResponse.result?.components[typePath];
            } else {
              delete syncManager.mapOfComponents[typePath];
            }
          }
          if (onlyLog) console.log(inspect(getResponse.result, false, null, true));
        }

        // Update tree
        syncManager.sync();

        // Check`
        if (!onlyLog) assertEqualOrCreateFile(t, syncManager.debugTree(direction), title);
      };
      const mutateComplex = async (componentTypePath: TypePath, path: string, value: BrpValue) => {
        t.assert.ok(entity);
        const response = await protocol.mutateComponent(entity, componentTypePath, path, value);
        if (response.error) console.error(`Error: ${JSON.stringify(response.error)}`);
      };
      const insertComponents = async (components: BrpComponentRegistry) => {
        t.assert.ok(entity);
        const response = await protocol.insert(entity, components);
        if (response.error) console.error(`Error: ${JSON.stringify(response.error)}`);
      };
      const removeComponents = async (components: TypePath[]) => {
        t.assert.ok(entity);
        const response = await protocol.remove(entity, components);
        if (response.error) console.error(`Error: ${JSON.stringify(response.error)}`);
      };

      // Serialized
      await mutateComplex(collectionsTypePath, '.sequences.array[2]', 3000000);
      await mutateComplex(collectionsTypePath, '.sequences.vec[1]', 2000000);
      await mutateComplex(collectionsTypePath, '.sequences.vec_deque[1]', 5000000);
      await mutateComplex(collectionsTypePath, '.tuples.0.2', 200);
      await mutateComplex(collectionsTypePath, '.tuples.1.4', -300);
      await mutateComplex(collectionsTypePath, '.tuples.1.4', -300);
      await assertEqualComponents([collectionsTypePath], 'sync-mutation-1');
      await mutateComplex(personTypePath, '.name', 'Mr. Night');
      await assertEqualComponents([personTypePath], 'sync-mutation-2');
      (syncManager.mapOfComponents[collectionsTypePath] ?? {})['sets']['hash_set'][1] = 123456; // unsupported
      (syncManager.mapOfComponents[collectionsTypePath] ?? {})['maps']['hash_map']['Second'] = 22222; // unsupported
      await assertEqualComponents([collectionsTypePath], 'sync-mutation-3', false);

      // List
      await mutateComplex(collectionsTypePath, '.sequences.vec', [10, 20, 30, 40, 50, 60, 70]);
      await assertEqualComponents([collectionsTypePath, 'sequences', 'vec'], 'sync-list-1');
      (syncManager.mapOfComponents[collectionsTypePath] ?? {})['sequences']['vec'] = [200]; // unsupported
      await assertEqualComponents([collectionsTypePath, 'sequences', 'vec'], 'sync-list-2', false);

      // Set
      await mutateComplex(collectionsTypePath, '.sets.hash_set', [1, 2, 3, 4, 5]);
      await assertEqualComponents([collectionsTypePath, 'sets'], 'sync-set-1');
      (syncManager.mapOfComponents[collectionsTypePath] ?? {})['sets']['hash_set'] = [6]; // unsupported
      await assertEqualComponents([collectionsTypePath, 'sets'], 'sync-set-2', false);

      // Enum
      await mutateComplex(gameStateTypePath, '', 'Pause');
      await assertEqualComponents([gameStateTypePath], 'sync-enum-1');
      await mutateComplex(gameStateTypePath, '', { Loading: 123 });
      await assertEqualComponents([gameStateTypePath], 'sync-enum-2');
      await mutateComplex(gameStateTypePath, '.0', 456);
      await assertEqualComponents([gameStateTypePath], 'sync-enum-3');
      await mutateComplex(gameStateTypePath, '', 'Playing');
      await assertEqualComponents([gameStateTypePath], 'sync-enum-4');

      // Map
      (syncManager.mapOfComponents[collectionsTypePath] ?? {})['maps']['hash_map'] = { A: 29, C: 31 }; // unsupported
      await assertEqualComponents([collectionsTypePath, 'maps', 'hash_map'], 'sync-map-1', false);
      (syncManager.mapOfComponents[collectionsTypePath] ?? {})['maps']['hash_map'] = { A: 29, B: 30, C: 31 }; // unsupported
      await assertEqualComponents([collectionsTypePath, 'maps', 'hash_map'], 'sync-map-2', false);

      // Components
      await insertComponents({ [insertedTypePath]: null, [insertedAlterTypePath]: 42 });
      await assertEqualComponents([], 'sync-components-1');
      await removeComponents([insertedTypePath, insertedAlterTypePath]);
      await assertEqualComponents([], 'sync-components-2');

      // Single-element Tuple
      await mutateComplex(singleValueTypePath, '', 276);
      await assertEqualComponents([singleValueTypePath], 'sync-tuple');
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
