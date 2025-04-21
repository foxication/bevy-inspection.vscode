// Bevy Remote Protocol Client
// https://docs.rs/bevy/latest/bevy/remote/index.html

import { URL } from 'url';
import {
  BrpResponse,
  EntityId,
  TypePath,
  BrpGetWatchResult,
  BrpGetWatchStrictResult,
  BrpListWatchResult,
  BrpErrors,
  BrpComponentRegistry,
  BrpRegistrySchema,
  BrpValue,
  BrpDiscover,
  BrpError,
} from './types';
import { TextDecoder } from 'util';

export const DEFAULT_BEVY_URL = new URL('http://127.0.0.1:15702');

function requestWrapper(
  id: number,
  rpcMethod: string,
  rpcParams: unknown,
  signal?: AbortSignal
): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: rpcMethod,
      params: rpcParams,
    }),
    signal,
  };
}

async function request<R>(
  url: URL,
  id: number,
  method: string,
  params?: unknown
): Promise<BrpResponse<R> | BrpError> {
  try {
    const fetched = await fetch(url, requestWrapper(id, method, params));
    return await JSON.parse(await fetched.text());
  } catch (reason) {
    if (reason instanceof Error && reason.message === 'fetch failed') return 'disconnection';
    return 'unspecified_error';
  }
}

const decoder = new TextDecoder();
async function requestStream<R>(
  url: URL,
  id: number,
  method: string,
  params: unknown,
  signal: AbortSignal,
  observer: (arg: R) => void
): Promise<null | BrpError> {
  let response;
  try {
    response = await fetch(url, requestWrapper(id, method, params, signal));
    if (!response.body) return null;
  } catch (reason) {
    if (reason instanceof Error && reason.message === 'fetch failed') return 'disconnection';
    return 'unspecified_error';
  }

  try {
    // https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Using_readable_streams
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      const decoded = decoder.decode(value);
      const parsed = JSON.parse(decoded.substring(decoded.indexOf('{')));
      if (parsed.result) observer(parsed.result);
      if (done) break;
    }
  } catch {
    /* ignore */
  }
  return null;
}

abstract class BevyRemoteProtocolEssential {
  private id: number;
  public url: URL;

  constructor(url: URL) {
    this.id = 0;
    this.url = url;
  }

  get nextId() {
    return this.id++; // starting from 0
  }

  abstract get title(): string;
  abstract get version(): string;
}

export async function initializeBevyRemoteProtocol(
  url: URL
): Promise<BevyRemoteProtocolV016 | BrpError> {
  const response: BrpResponse<BrpDiscover> | BrpError = await request(url, 0, 'rpc.discover');
  if (typeof response === 'string') return response;
  if (response.result === undefined) return 'unspecified_error';
  if (response.result.info.version.startsWith('0.16')) {
    return new BevyRemoteProtocolV016(
      url,
      response.result.info.title,
      response.result.info.version
    );
  }
  return 'unspecified_error';
}

export class BevyRemoteProtocolV016 extends BevyRemoteProtocolEssential {
  constructor(url: URL, private _title: string, private _version: string) {
    super(url);
  }
  get title() {
    return this._title;
  }
  get version() {
    return this._version;
  }

  /**
   * Retrieve the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `false` by default.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `strict` (optional): A flag to enable strict mode which will fail if any one of the
   *   components is not present or can not be reflected.
   *
   * `result`:
   * - `components`: A map associating each type name to its value on the requested entity.
   * - `errors`: A map associating each type name with an error if it was not on the entity
   *   or could not be reflected.
   */
  public async get(
    entity: EntityId,
    components: TypePath[]
  ): Promise<BrpResponse<{ components: BrpComponentRegistry; errors: BrpErrors }> | BrpError> {
    return request(this.url, this.nextId, 'bevy/get', { entity, components, strict: false });
  }

  /**
   * Retrieve the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `true` by default.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `strict` (optional): A flag to enable strict mode which will fail if any one of the
   *   components is not present or can not be reflected.
   *
   * `result`: A map associating each type name to its value on the requested entity.
   */
  public async getStrict(
    entity: EntityId,
    components: TypePath[]
  ): Promise<BrpResponse<BrpComponentRegistry> | BrpError> {
    return request(this.url, this.nextId, 'bevy/get', { entity, components, strict: true });
  }

  /**
   * Perform a query over components in the ECS, returning all matching entities and their associated
   * component values.
   *
   * All of the arrays that comprise this request are optional, and when they are not provided, they
   * will be treated as if they were empty.
   *
   * `params`:
   * - `components` (optional): An array of [fully-qualified type names] of components to fetch.
   * - `option` (optional): An array of fully-qualified type names of components to fetch optionally.
   * - `has` (optional): An array of fully-qualified type names of components whose presence will be
   *   reported as boolean values.
   * - `with` (optional): An array of fully-qualified type names of components that must be present
   *   on entities in order for them to be included in results.
   * - `without` (optional): An array of fully-qualified type names of components that must *not* be
   *   present on entities in order for them to be included in results.
   *
   * `result`: An array, each of which is an object containing:
   * - `entity`: The ID of a query-matching entity.
   * - `components`: A map associating each type name from `components`/`option` to its value on the matching
   *   entity if the component is present.
   * - `has`: A map associating each type name from `has` to a boolean value indicating whether or not the
   *   entity has that component. If `has` was empty or omitted, this key will be omitted in the response.
   */
  public async query({
    components,
    option,
    has,
    filterWith,
    filterWithout,
  }: {
    components?: TypePath[];
    option?: TypePath[];
    has?: TypePath[];
    filterWith?: TypePath[];
    filterWithout?: TypePath[];
  }): Promise<
    | BrpResponse<
        [{ entity: EntityId; components: BrpComponentRegistry; has: { [key: TypePath]: boolean } }]
      >
    | BrpError
  > {
    return request(this.url, this.nextId, 'bevy/query', {
      data: { components, option, has },
      filter: { with: filterWith, without: filterWithout },
    });
  }

  /**
   * Create a new entity with the provided components and return the resulting entity ID.
   *
   * `params`:
   * - `components`: A map associating each component's [fully-qualified type name] with its value.
   *
   * `result`:
   * - `entity`: The ID of the newly spawned entity.
   */
  public async spawn(
    components: BrpComponentRegistry
  ): Promise<BrpResponse<{ entity: EntityId }> | BrpError> {
    return request(this.url, this.nextId, 'bevy/spawn', { components });
  }

  /**
   * Despawn the entity with the given ID.
   *
   * `params`:
   * - `entity`: The ID of the entity to be despawned.
   *
   * `result`: null.
   */
  public async destroy(entity: EntityId): Promise<BrpResponse<null> | BrpError> {
    return request(this.url, this.nextId, 'bevy/destroy', { entity });
  }

  /**
   * Delete one or more components from an entity.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components should be removed.
   * - `components`: An array of [fully-qualified type names] of components to be removed.
   *
   * `result`: null.
   */
  public async remove(
    entity: EntityId,
    components: TypePath[]
  ): Promise<BrpResponse<null> | BrpError> {
    return request(this.url, this.nextId, 'bevy/remove', { entity, components });
  }

  /**
   * Insert one or more components into an entity.
   *
   * `params`:
   * - `entity`: The ID of the entity to insert components into.
   * - `components`: A map associating each component's fully-qualified type name with its value.
   *
   * `result`: null.
   */
  public async insert(
    entity: EntityId,
    components: BrpComponentRegistry
  ): Promise<BrpResponse<null> | BrpError> {
    return request(this.url, this.nextId, 'bevy/insert', { entity, components });
  }

  /**
   * Mutate a field in a component.
   *
   * `params`:
   * - `entity`: The ID of the entity with the component to mutate.
   * - `component`: The component’s fully-qualified type name.
   * - `path`: The path of the field within the component. See `GetPath` for more information on formatting this string.
   * - `value`: The value to insert at `path`.
   *
   * `result`: null.
   */
  public async mutateComponent(
    entity: EntityId,
    component: TypePath,
    path: string,
    value: BrpValue
  ): Promise<BrpResponse<null> | BrpError> {
    return request(this.url, this.nextId, 'bevy/mutate_component', {
      entity,
      component,
      path,
      value,
    });
  }

  /**
   * Assign a new parent to one or more entities.
   *
   * `params`:
   * - `entities`: An array of entity IDs of entities that will be made children of the `parent`.
   * - `parent` (optional): The entity ID of the parent to which the child entities will be assigned.
   *   If excluded, the given entities will be removed from their parents.
   *
   * `result`: null.
   */
  public async reparent(
    entities: EntityId[],
    parent?: EntityId
  ): Promise<BrpResponse<null> | BrpError> {
    return request(this.url, this.nextId, 'bevy/reparent', { entities, parent });
  }

  /**
   * List all registered components or all components present on an entity.
   *
   * When `params` is not provided, this lists all registered components. If `params` is provided,
   * this lists only those components present on the provided entity.
   *
   * `params` (optional):
   * - `entity`: The ID of the entity whose components will be listed.
   *
   * `result`: An array of fully-qualified type names of components.
   */
  public async list(entity?: EntityId): Promise<BrpResponse<TypePath[]> | BrpError> {
    if (entity) return request(this.url, this.nextId, 'bevy/list', { entity });
    return request(this.url, this.nextId, 'bevy/list');
  }

  /**
   * Watch the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `false` by default.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `signal`: A signal object that allows you to abort it if required via an {@link AbortController} object.
   * - `observer`: A handler of chunks of Response.
   *
   * `result`:
   * - `components`: A map of components added or changed in the last tick associating each type
   *   name to its value on the requested entity.
   * - `removed`: An array of fully-qualified type names of components removed from the entity
   *   in the last tick.
   * - `errors`: A map associating each type name with an error if it was not on the entity
   *   or could not be reflected.
   */
  public async getWatch(
    entity: EntityId,
    components: TypePath[],
    signal: AbortSignal,
    observer: (arg: BrpGetWatchResult) => void
  ): Promise<null | BrpError> {
    return requestStream(
      this.url,
      this.nextId,
      'bevy/get+watch',
      { entity, components, strict: false },
      signal,
      observer
    );
  }

  /**
   * Watch the values of one or more components from an entity.
   *
   * This function passes a flag `strict` as `true` by default.
   * Response will fail if any one of the components is not present or can not be refleceted.
   *
   * `params`:
   * - `entity`: The ID of the entity whose components will be fetched.
   * - `components`: An array of [fully-qualified type names] of components to fetch.
   * - `signal`: A signal object that allows you to abort it if required via an {@link AbortController} object.
   * - `observer`: A handler of chunks of Response.
   *
   * `result`:
   * - `components`: A map of components added or changed in the last tick associating each type
   *   name to its value on the requested entity.
   * - `removed`: An array of fully-qualified type names of components removed from the entity
   *   in the last tick.
   */
  public async getWatchStrict(
    entity: EntityId,
    components: TypePath[],
    signal: AbortSignal,
    observer: (arg: BrpGetWatchStrictResult) => void
  ): Promise<null | BrpError> {
    return requestStream(
      this.url,
      this.nextId,
      'bevy/get+watch',
      { entity, components, strict: true },
      signal,
      observer
    );
  }

  /**
   * Watch all components present on an entity.
   *
   * When `entity` is not provided, this lists all registered components. If `entity` is provided,
   * this lists only those components present on the provided entity.
   *
   * `params`:
   * - `signal`: A signal object that allows you to abort it if required via an {@link AbortController} object.
   * - `observer`: A handler of chunks of Response.
   * - `entity`: (optional) The ID of the entity whose components will be listed.
   *
   * `result`:
   * - `added`: An array of fully-qualified type names of components added to the entity in the
   *   last tick.
   * - `removed`: An array of fully-qualified type names of components removed from the entity
   *   in the last tick.
   */
  public async listWatch(
    signal: AbortSignal,
    observer: (arg: BrpListWatchResult) => void,
    entity?: EntityId
  ): Promise<null | BrpError> {
    return requestStream(
      this.url,
      this.nextId,
      'bevy/list+watch',
      entity === undefined ? null : { entity },
      signal,
      observer
    );
  }

  /**
   * Undocumented: bevy/get_resource
   */

  /**
   * Undocumented: bevy/insert_resource
   */

  /**
   * Undocumented: bevy/remove_resource
   */

  /**
   * Undocumented: bevy/mutate_resource
   */

  /**
   * Undocumented: bevy/list_resources
   */

  /**
   * Undocumented: bevy/registry/schema
   */

  /**
   * Export registry schema of all registered components and resources.
   *
   * `result`: A map of registries associating each full TypePath to its schema. Each registry
   * contains information, such as:
   * - TypePath
   * - ShortPath
   * - Kind
   * - Type
   *
   * It may give you optional fields of information:
   * - CrateName
   * - ModulePath
   * - Required
   * - Items...
   */
  public async registrySchema(): Promise<BrpResponse<BrpRegistrySchema> | BrpError> {
    return request(this.url, this.nextId, 'bevy/registry/schema');
  }

  /**
   * Undocumented: rpc.discover
   */
  public async rpcDiscover(): Promise<BrpResponse<BrpDiscover> | BrpError> {
    return request(this.url, this.nextId, 'rpc.discover');
  }
}
