import { test, TestContext } from 'node:test';
import { DataSyncManager } from '../src/web-components/sync';
import { BevyRemoteProtocol } from '../src/protocol';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';

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

  const registrySchema = (await protocol.registrySchema()).result;
  t.assert.ok(registrySchema);

  const queryResponse = await protocol.query({ filterWith: ['server_all_types::Special'] });
  t.assert.ok(queryResponse.result);
  const entity = queryResponse.result[0].entity;

  const componentNames = (await protocol.list(entity)).result;
  t.assert.ok(componentNames);

  const getResponse = await protocol.get(entity, componentNames);
  const componentRegistry = getResponse.result?.components;
  const componentErrors = getResponse.result?.errors;
  t.assert.ok(componentRegistry);
  if (componentErrors !== undefined) console.log(JSON.stringify(componentErrors));

  const syncManager = new DataSyncManager(componentRegistry, registrySchema);
  const result = syncManager.debugTree();
  const expectedResult =
    'ROOT:\n\
| STRUCT+SERDE       bevy_ecs::name::Name --> bevy_ecs::name::Name = "All Components"\n\
| STRUCT             server_all_types::Collections --> server_all_types::Collections:\n\
| | STRUCT           sequences --> server_all_types::Sequences:\n\
| | | ARRAY          vec --> alloc::vec::Vec<i32>:\n\
| | | | VALUE+SERDE  0 --> i32 = 1\n\
| | | | VALUE+SERDE  1 --> i32 = 2\n\
| | | | VALUE+SERDE  2 --> i32 = 3\n\
| | | ARRAY          vec_deque --> alloc::collections::VecDeque<i32>:\n\
| | | | VALUE+SERDE  0 --> i32 = 4\n\
| | | | VALUE+SERDE  1 --> i32 = 5\n\
| | | | VALUE+SERDE  2 --> i32 = 6\n\
| | STRUCT           maps --> server_all_types::Maps:\n\
| ENUM+SERDE         server_all_types::GameDifficulty --> server_all_types::GameDifficulty = {"Hard":{"enemies":4}}\n\
| ENUM               server_all_types::GameState --> server_all_types::GameState = Playing\n\
| STRUCT             server_all_types::Person --> server_all_types::Person:\n\
| | VALUE+SERDE      name --> alloc::string::String = "David"\n\
| | VALUE+SERDE      friends --> u32 = 4\n\
| | TUPLE            birth_date --> (u8, u8, u32):\n\
| | | VALUE+SERDE    0 --> u8 = 4\n\
| | | VALUE+SERDE    1 --> u8 = 8\n\
| | | VALUE+SERDE    2 --> u32 = 1998\n\
| TUPLE_STRUCT       server_all_types::SignedIntegers --> server_all_types::SignedIntegers:\n\
| | VALUE+SERDE      0 --> i8 = 0\n\
| | VALUE+SERDE      1 --> i16 = -1\n\
| | VALUE+SERDE      2 --> i32 = 2\n\
| | VALUE+SERDE      3 --> i64 = -3\n\
| | VALUE+SERDE      4 --> i128 = 4\n\
| TUPLE_STRUCT       server_all_types::SingleValue --> server_all_types::SingleValue:\n\
| | VALUE+SERDE      X --> f32 = 138\n\
| TUPLESTRUCT+SERDE  server_all_types::SingleValueSerialized --> server_all_types::SingleValueSerialized = 28\n\
| STRUCT             server_all_types::Special --> server_all_types::Special:\n\
| TUPLE_STRUCT       server_all_types::UnsignedIntegers --> server_all_types::UnsignedIntegers:\n\
| | VALUE+SERDE      0 --> u8 = 0\n\
| | VALUE+SERDE      1 --> u16 = 1\n\
| | VALUE+SERDE      2 --> u32 = 2\n\
| | VALUE+SERDE      3 --> u64 = 3\n\
| | VALUE+SERDE      4 --> u128 = 4\n\
| ENUM+SERDE         server_all_types::WindowMode --> server_all_types::WindowMode = {"Window":[512,256]}\n';
  t.assert.strictEqual(result, expectedResult);

  isTestFinished = true;
  server?.kill();
});
