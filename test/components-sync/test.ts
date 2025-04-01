import { test, TestContext } from 'node:test';
import { DataSyncManager } from '../../src/web-components/sync';
import { BevyRemoteProtocol } from '../../src/protocol';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

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

    // Receive registry schema
    const registrySchema = (await protocol.registrySchema()).result;
    t.assert.ok(registrySchema);

    // Receive all components of special entity
    const queryResponse = await protocol.query({ filterWith: ['server_all_types::Special'] });
    t.assert.ok(queryResponse.result);
    const entity = queryResponse.result[0].entity;

    const componentNames = (await protocol.list(entity)).result;
    t.assert.ok(componentNames);

    const assertEqualOrCreateFile = (actual: object | string, name: string) => {
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
    };

    let getResponse = await protocol.get(entity, componentNames);
    assertEqualOrCreateFile(getResponse.result ?? {}, 'sync-get-response');
    const componentRegistry = getResponse.result?.components;
    t.assert.ok(componentRegistry);

    // Render debug tree
    const syncManager = new DataSyncManager(componentRegistry, registrySchema);
    const treeResult = syncManager.debugTree();
    assertEqualOrCreateFile(treeResult, 'sync-initial-tree');

    // Value modification
    const mutatedComponent = 'server_all_types::Collections';
    await protocol.mutateComponent(entity, mutatedComponent, '.sequences.array[2]', 3000000);
    await protocol.mutateComponent(entity, mutatedComponent, '.sequences.vec[1]', 2000000);
    await protocol.mutateComponent(entity, mutatedComponent, '.sequences.vec_deque[1]', 5000000);
    // await protocol.mutateComponent(entity, mutatedComponent, '.maps.hash_map[Second]', 2222);
    // await protocol.mutateComponent(entity, mutatedComponent, '.maps.hash_set[1]', 123456);
    await protocol.mutateComponent(entity, mutatedComponent, '.tuples.0.2', 200);
    await protocol.mutateComponent(entity, mutatedComponent, '.tuples.1.4', -300);
    getResponse = await protocol.get(entity, [mutatedComponent]);
    t.assert.ok(getResponse.result);

    syncManager.mapOfComponents[mutatedComponent] = getResponse.result.components[mutatedComponent];
    syncManager.sync();
    assertEqualOrCreateFile(syncManager.debugTree([mutatedComponent]), 'sync-mutated-tree');

    // Array insert

    // Array remove

    // Enum modification
  });
  isTestFinished = true;
  server?.kill();
});
