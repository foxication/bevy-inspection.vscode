import * as vscode from 'vscode';
import { EntityId, BevyRemoteProtocol, TypePath, ServerVersion, BrpObject } from './protocol';
import { ConnectionElement, EntityElement, HierarchyElement } from './hierarchyData';
import { EntityFocus } from './connection-list';

type ProtocolDisconnection = 'disconnection';
type ProtocolResult = 'success' | 'error' | ProtocolDisconnection;
export type NetworkStatus = 'offline' | 'online';

// Inspection data
// export type JsonValue = string | number | boolean | null;
// export type JsonMap = { [key: string]: JsonAll };
// export type JsonAll = JsonValue | JsonMap | JsonAll[];

export class Connection {
  private protocol: BevyRemoteProtocol;
  private network: NetworkStatus;

  // Bevy data
  private registeredComponents: TypePath[] = [];
  private entityElements = new Map<EntityId, EntityElement>();
  private inspectionElements: BrpObject = {};

  // Events
  private hierarchyUpdatedEmitter = new vscode.EventEmitter<Connection>();
  readonly onHierarchyUpdated = this.hierarchyUpdatedEmitter.event;
  private entityRenamedEmitter = new vscode.EventEmitter<EntityElement>();
  readonly onEntityRenamed = this.entityRenamedEmitter.event;
  private entityDestroyedEmitter = new vscode.EventEmitter<EntityElement>();
  readonly onEntityDestroyed = this.entityDestroyedEmitter.event;
  private disconnectionEmitter = new vscode.EventEmitter<Connection>();
  readonly onDisconnection = this.disconnectionEmitter.event;
  private reconnectionEmitter = new vscode.EventEmitter<Connection>();
  readonly onReconnection = this.reconnectionEmitter.event;

  constructor(url: URL, version: ServerVersion) {
    this.network = 'offline';
    this.protocol = new BevyRemoteProtocol(url, version);
  }

  public disconnect() {
    this.network = 'offline';
    for (const element of this.entityElements.values()) {
      element.network = 'offline';
    }
    this.disconnectionEmitter.fire(this);
  }

  private errorHandler(reason: Error): ProtocolDisconnection {
    if (reason.message === 'fetch failed') {
      this.disconnect();
      return 'disconnection';
    }
    throw reason;
  }

  public async requestEntityElements(): Promise<ProtocolResult> {
    const response = await this.protocol
      .query({
        option: ['bevy_ecs::name::Name', 'bevy_ecs::hierarchy::ChildOf', 'bevy_ecs::hierarchy::Children'],
      })
      .catch((e) => this.errorHandler(e));
    if (response === 'disconnection') {
      return response;
    }
    if (response.result === undefined) {
      return 'error';
    }
    this.entityElements = new Map(
      response.result.map((value) => {
        return [
          value.entity,
          new EntityElement(this.getProtocol().url.host, this.getNetworkStatus(), value.entity, {
            name: value.components['bevy_ecs::name::Name'] as string,
            childOf: value.components['bevy_ecs::hierarchy::ChildOf'] as EntityId,
            children: value.components['bevy_ecs::hierarchy::Children'] as EntityId[],
          }),
        ];
      })
    );
    this.hierarchyUpdatedEmitter.fire(this);
    return 'success';
  }

  public async requestRegisteredComponents(): Promise<ProtocolResult> {
    const response = await this.protocol.list().catch((e) => this.errorHandler(e));
    if (response === 'disconnection') {
      return response;
    }
    if (response.result === undefined) {
      return 'error';
    }

    this.registeredComponents = response.result;
    return 'success';
  }

  public async initialize(): Promise<ProtocolResult> {
    this.network = 'online';

    let status;
    status = await this.requestEntityElements();
    if (status !== 'success') {
      return status;
    }
    status = await this.requestRegisteredComponents();
    return status;
  }

  public async requestInspectionElements(focus: EntityFocus): Promise<ProtocolResult> {
    const listResponse = await this.protocol.list(focus.entityId).catch((e) => this.errorHandler(e));
    if (listResponse === 'disconnection') return 'disconnection';
    if (listResponse.result === undefined) return 'error';

    const getResponse = await this.protocol.get(focus.entityId, listResponse.result).catch((e) => this.errorHandler(e));
    if (getResponse === 'disconnection') return 'disconnection';
    if (getResponse.result === undefined) return 'error';

    this.inspectionElements = getResponse.result.components;
    return 'success';
  }

  public getInspectionElementsSimple() {
    return this.inspectionElements;
  }

  public getSessionInfo(): string {
    return 'Bevy Remote Protocol: ' + this.protocol.url + ', Version: ' + this.protocol.serverVersion;
  }

  public getNetworkStatus(): NetworkStatus {
    return this.network;
  }

  public async requestDestroyOfEntity(element: EntityElement): Promise<ProtocolResult> {
    const response = await this.protocol.destroy(element.id).catch((e) => this.errorHandler(e));
    if (response === 'disconnection') {
      return 'disconnection';
    }
    if (response.result === null) {
      this.entityElements.delete(element.id);
      this.entityDestroyedEmitter.fire(element);
    }
    return 'success';
  }

  public async requestRenameOfEntity(element: EntityElement): Promise<ProtocolResult> {
    const newName = await vscode.window.showInputBox({ title: 'Rename Entity', value: element.name }); // Prompt
    if (newName === undefined) {
      return 'error';
    }
    const response = await this.protocol
      .insert(element.id, { 'bevy_ecs::name::Name': newName })
      .catch((e) => this.errorHandler(e));
    if (response === 'disconnection') {
      return 'disconnection';
    }
    if (response.result === null && response.error === undefined) {
      element.name = newName;
      this.entityRenamedEmitter.fire(element);
      return 'success';
    }
    return 'error';
  }

  public cloneProtocol() {
    return new BevyRemoteProtocol(this.protocol.url, this.protocol.serverVersion);
  }

  public getProtocol() {
    return this.protocol;
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

  public getChildrenOf(parent: HierarchyElement): EntityElement[] {
    if (parent instanceof ConnectionElement) {
      return Array.from(this.entityElements.values()).filter((element) => element.childOf === undefined);
    }
    return parent.children?.map((id) => this.entityElements.get(id)).filter((element) => element !== undefined) ?? [];
  }
}
