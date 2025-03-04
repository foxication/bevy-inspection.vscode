import * as vscode from 'vscode';
import { EntityId, BrpValue, BrpError, BevyRemoteProtocol, TypePath, ServerVersion } from 'bevy-remote-protocol';
import { ConnectionElement as ConnectionElement, EntityElement, HierarchyElement } from './hierarchyData';
import {
  ComponentElement,
  ComponentErrorElement,
  InspectionElement,
  NamedValueElement,
  ValueElement,
} from './componentsData';

type ProtocolDisconnection = 'disconnection';
type ProtocolResult = 'success' | 'error' | ProtocolDisconnection;
export type NetworkStatus = 'offline' | 'online';

export class Connection {
  // Session data
  private protocol: BevyRemoteProtocol;
  private network: NetworkStatus;
  public isInitialized: boolean;

  // Bevy data
  private registeredComponents: TypePath[] = [];
  private entityElements = new Map<EntityId, EntityElement>();
  private inspectedEntityId: EntityId | null = null;
  private inspectionElements: InspectionElement[] | null = null;

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
    this.isInitialized = false;
    this.protocol = new BevyRemoteProtocol(url, version);
  }

  public disconnection() {
    this.network = 'offline';
    for (const element of this.entityElements.values()) {
      element.network = 'offline';
    }
    this.disconnectionEmitter.fire(this);
  }

  private errorHandler(reason: Error): ProtocolDisconnection {
    if (reason.message === 'fetch failed') {
      this.disconnection();
      return 'disconnection';
    }
    throw reason;
  }

  public async updateEntityElements(): Promise<ProtocolResult> {
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

  public async updateRegisteredComponents(): Promise<ProtocolResult> {
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
    status = await this.updateEntityElements();
    if (status !== 'success') {
      return status;
    }
    status = await this.updateRegisteredComponents();
    this.isInitialized = true;
    return status;
  }

  private async updateInspectionElements(): Promise<ProtocolResult> {
    if (this.inspectedEntityId === null) {
      return 'error';
    }

    const listResponse = await this.protocol.list(this.inspectedEntityId).catch((e) => this.errorHandler(e));
    if (listResponse === 'disconnection') {
      return 'disconnection';
    }
    if (listResponse.result === undefined) {
      return 'error';
    }

    const getResponse = await this.protocol
      .get(this.inspectedEntityId, listResponse.result)
      .catch((e) => this.errorHandler(e));
    if (getResponse === 'disconnection') {
      return 'disconnection';
    }
    if (getResponse.result === undefined) {
      return 'error';
    }

    // Parsing values
    const parseValues = (obj: object, isParentArray = false): (NamedValueElement | ValueElement)[] => {
      const elements: (NamedValueElement | ValueElement)[] = [];

      for (const entry of Object.entries(obj) as [string, BrpValue][]) {
        const name = entry[0];
        const toParse = entry[1];

        if (typeof toParse === 'object') {
          if (toParse === null) {
            elements.push(new NamedValueElement(name, [], 'NULL')); // null
            continue;
          }
          if (Array.isArray(toParse)) {
            elements.push(new NamedValueElement(name, parseValues(toParse, true))); // array...
            continue;
          }
          elements.push(new NamedValueElement(name, parseValues(toParse))); // object...
          continue;
        }
        if (isParentArray) {
          elements.push(new ValueElement(toParse)); // array value
          continue;
        }
        elements.push(new NamedValueElement(name, [], toParse)); // value
      }
      return elements;
    };

    // Parsing components
    const componentTree = [];
    for (const entry of Object.entries(getResponse.result.components) as [string, BrpValue][]) {
      const typePath = entry[0];
      const toParse = entry[1];

      if (typeof toParse === 'object') {
        if (toParse === null) {
          componentTree.push(new ComponentElement(typePath, [new ValueElement('NULL')])); // null
          continue;
        }
        if (Array.isArray(toParse)) {
          componentTree.push(new ComponentElement(typePath, parseValues(toParse, true))); // array...
          continue;
        }
        componentTree.push(new ComponentElement(typePath, parseValues(toParse))); // object...
        continue;
      }
      componentTree.push(new ComponentElement(typePath, [new ValueElement(toParse)])); // value
    }

    // Parsing components (errors)
    for (const entry of Object.entries(getResponse.result.errors) as [string, BrpError][]) {
      const typePath = entry[0];
      const toParse = entry[1];
      const errorData = [
        new NamedValueElement('code', [], toParse.code),
        new NamedValueElement('message', [], toParse.message),
      ];
      if (toParse.data !== undefined && typeof toParse.data !== 'object') {
        new NamedValueElement('message', [], toParse.data);
      }
      componentTree.push(new ComponentErrorElement(typePath, errorData));
    }

    // apply changes
    this.inspectionElements = componentTree;
    return 'success';
  }

  public async getInspectionElements(entityId: EntityId) {
    if (this.inspectedEntityId !== entityId) {
      this.inspectedEntityId = entityId;
      await this.updateInspectionElements();
    }
    if (this.inspectionElements === null) {
      return [];
    }
    return this.inspectionElements;
  }

  public getSessionInfo(): string {
    return 'Bevy Remote Protocol: ' + this.protocol.url + ', Version: ' + this.protocol.serverVersion;
  }

  public getNetworkStatus(): NetworkStatus {
    return this.network;
  }

  public destroyEntity(element: EntityElement): Promise<ProtocolResult> {
    return this.protocol
      .destroy(element.id)
      .then((response) => {
        if (response.result === null) {
          this.entityElements.delete(element.id);
          this.entityDestroyedEmitter.fire(element);
        }
      })
      .catch((e) => this.errorHandler(e))
      .then((response) => {
        if (response === 'disconnection') {
          return 'disconnection';
        }
        return 'success';
      });
  }

  public async renameEntity(element: EntityElement): Promise<ProtocolResult> {
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

  public revive() {
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
