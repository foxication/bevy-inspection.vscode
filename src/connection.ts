import * as vscode from 'vscode';
import {
  EntityId,
  TypePath,
  BrpObject,
  BrpRegistrySchema,
  BrpResponseErrors,
  BevyRemoteProtocolV016,
  BrpResponse,
  BrpError,
  BrpResponseError,
} from './protocol';
import { EntityElement } from './hierarchyData';

type ProtocolResult = 'success' | 'disconnection';
export type NetworkStatus = 'offline' | 'online';

// Inspection data
// export type JsonValue = string | number | boolean | null;
// export type JsonMap = { [key: string]: JsonAll };
// export type JsonAll = JsonValue | JsonMap | JsonAll[];

export class Connection {
  private network: NetworkStatus;

  // Bevy data
  private registeredComponents: TypePath[] = [];
  private registrySchema: BrpRegistrySchema = {};
  private entityElements = new Map<EntityId, EntityElement>();
  private inspectionList: TypePath[] = [];
  private inspectionTree: BrpObject = {};
  private inspectionErrors: BrpResponseErrors = {};

  // Events
  private hierarchyUpdatedEmitter = new vscode.EventEmitter<Connection>();
  readonly onHierarchyUpdated = this.hierarchyUpdatedEmitter.event;
  private entityRenamedEmitter = new vscode.EventEmitter<[EntityElement, boolean]>();
  readonly onEntityRenamed = this.entityRenamedEmitter.event;
  private entityDestroyedEmitter = new vscode.EventEmitter<EntityElement>();
  readonly onEntityDestroyed = this.entityDestroyedEmitter.event;
  private disconnectionEmitter = new vscode.EventEmitter<Connection>();
  readonly onDisconnection = this.disconnectionEmitter.event;
  private reconnectionEmitter = new vscode.EventEmitter<Connection>();
  readonly onReconnection = this.reconnectionEmitter.event;

  constructor(private protocol: BevyRemoteProtocolV016) {
    this.network = 'offline';
  }

  public disconnect() {
    this.network = 'offline';
    for (const element of this.entityElements.values()) {
      element.network = 'offline';
    }
    this.disconnectionEmitter.fire(this);
  }

  private isCorrectResponseOrDisconnect<R>(
    response: BrpResponse<R> | BrpError
  ): response is { jsonrpc: string; id: number; result: R; error?: BrpResponseError } {
    if (typeof response === 'string' || response.result === undefined) {
      this.disconnect();
      return false;
    }
    return true;
  }

  public async requestEntityElements(): Promise<ProtocolResult> {
    const response = await this.protocol.query({
      option: [
        'bevy_ecs::name::Name',
        'bevy_ecs::hierarchy::ChildOf',
        'bevy_ecs::hierarchy::Children',
      ],
    });
    if (!this.isCorrectResponseOrDisconnect(response)) return 'disconnection';
    this.entityElements = new Map(
      response.result.map((value) => {
        return [
          value.entity,
          new EntityElement(
            this.getHost(),
            this.getNetworkStatus(),
            value.entity,
            value.components['bevy_ecs::hierarchy::ChildOf'] as EntityId,
            value.components['bevy_ecs::hierarchy::Children'] as EntityId[],
            value.components['bevy_ecs::name::Name'] as string
          ),
        ];
      })
    );
    this.hierarchyUpdatedEmitter.fire(this);
    return 'success';
  }

  public async requestRegisteredComponents(): Promise<ProtocolResult> {
    const response = await this.protocol.list();
    if (!this.isCorrectResponseOrDisconnect(response)) return 'disconnection';
    this.registeredComponents = response.result;
    return 'success';
  }

  public async requestRegistrySchema(): Promise<ProtocolResult> {
    const response = await this.protocol.registrySchema();
    if (!this.isCorrectResponseOrDisconnect(response)) return 'disconnection';
    this.registrySchema = response.result;
    return 'success';
  }

  public async initialize(): Promise<ProtocolResult> {
    this.network = 'online';

    for (const status of [
      await this.requestEntityElements(),
      await this.requestRegisteredComponents(),
      await this.requestRegistrySchema(),
    ]) {
      if (status !== 'success') return status;
    }
    return 'success';
  }

  public async requestInspectionElements(entity: EntityId): Promise<ProtocolResult> {
    const listResponse = await this.protocol.list(entity);
    if (!this.isCorrectResponseOrDisconnect(listResponse)) return 'disconnection';

    const getResponse = await this.protocol.get(entity, listResponse.result);
    if (!this.isCorrectResponseOrDisconnect(getResponse)) return 'disconnection';

    this.inspectionList = listResponse.result;
    this.inspectionTree = getResponse.result.components;
    this.inspectionErrors = getResponse.result.errors;
    return 'success';
  }

  public getInspectionElements() {
    return this.inspectionTree;
  }

  public getInspectionErrors() {
    return this.inspectionErrors;
  }

  public getInspectionList() {
    return this.inspectionList;
  }

  public getRegistrySchema() {
    return this.registrySchema;
  }

  public getNetworkStatus(): NetworkStatus {
    return this.network;
  }

  public async requestDestroyOfEntity(element: EntityElement): Promise<ProtocolResult> {
    const response = await this.protocol.destroy(element.id);
    if (!this.isCorrectResponseOrDisconnect(response)) return 'disconnection';
    if (response.result === null) {
      this.entityElements.delete(element.id);
      this.entityDestroyedEmitter.fire(element);
    }
    return 'success';
  }

  public async requestRenameOfEntity(element: EntityElement): Promise<ProtocolResult> {
    const newName = await vscode.window.showInputBox({
      title: 'Rename Entity',
      value: element.name,
    }); // Prompt
    if (newName === undefined) {
      return 'success'; // ignore bad prompt
    }
    const response = await this.protocol.insert(element.id, { 'bevy_ecs::name::Name': newName });
    if (!this.isCorrectResponseOrDisconnect(response)) return 'disconnection';
    const isInserted = element.name === undefined;
    element.name = newName;
    this.entityRenamedEmitter.fire([element, isInserted]);
    return 'success';
  }

  public getProtocol() {
    return this.protocol;
  }

  public getTitle() {
    return this.protocol.title;
  }

  public getHost() {
    return this.protocol.url.host;
  }

  public getVersion() {
    return this.protocol.version;
  }

  public reconnect() {
    this.initialize().then((status) => {
      if (status === 'success') {
        this.reconnectionEmitter.fire(this);
      }
    });
  }

  public get() {
    return this.entityElements;
  }

  public getById(id: EntityId): EntityElement | undefined {
    return this.entityElements.get(id);
  }

  public getChildren(): EntityElement[] {
    return Array.from(this.entityElements.values()).filter(
      (element) => element.childOf === undefined
    );
  }

  public getChildrenOf(parent: EntityElement): EntityElement[] {
    return (
      parent.children
        ?.map((id) => this.entityElements.get(id))
        .filter((element) => element !== undefined) ?? []
    );
  }
}
