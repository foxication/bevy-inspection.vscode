import * as vscode from 'vscode';
import { EntityId, BrpValue, BrpError, BevyRemoteProtocol, TypePath, ServerVersion } from 'bevy-remote-protocol';
import { EntityElement } from './hierarchy';
import {
  ComponentElement,
  ComponentErrorElement,
  InspectionElement,
  NamedValueElement,
  ValueElement,
} from './components';

type StatusDisconnection = 'disconnection';
type ProtocolStatus = 'success' | 'error' | StatusDisconnection;

export type ConnectionState = 'dead' | 'alive';
export class Client {
  // Session data
  private protocol: BevyRemoteProtocol;
  private state: ConnectionState;

  // Bevy data
  private registeredComponents: TypePath[] = [];
  private entityElements: EntityElement[] = [];
  private inspectedEntityId: EntityId | null = null;
  private inspectionElements: InspectionElement[] | null = null;

  // Events
  private entitiesUpdatedEmitter = new vscode.EventEmitter<Client>();
  readonly onEntitiesUpdated = this.entitiesUpdatedEmitter.event;
  private entityRenamedEmitter = new vscode.EventEmitter<EntityElement>();
  readonly onEntityRenamed = this.entityRenamedEmitter.event;
  private entityDestroyedEmitter = new vscode.EventEmitter<EntityElement>();
  readonly onEntityDestroyed = this.entityDestroyedEmitter.event;
  private userAskedForReconnection = new vscode.EventEmitter<Client>();
  readonly onUserAskedForReconnection = this.userAskedForReconnection.event;
  private deathEmitter = new vscode.EventEmitter<Client>();
  readonly onDeath = this.deathEmitter.event;

  constructor(url: URL, version: ServerVersion) {
    this.state = 'dead';
    this.protocol = new BevyRemoteProtocol(url, version);
  }

  public death() {
    const wasAlive = this.state === 'alive';
    this.state = 'dead';
    this.entityElements = this.entityElements.map((element) => {
      element.state = 'dead';
      return element;
    });
    this.deathEmitter.fire(this);

    if (wasAlive) {
      vscode.window.showInformationMessage('Bevy instance has been disconnected', 'Reconnect').then((reaction) => {
        if (reaction === 'Reconnect') {
          this.userAskedForReconnection.fire(this);
        }
      });
    } else {
      vscode.window.showInformationMessage('Bevy instance refused to connect');
    }
  }

  private errorHandler(reason: Error): StatusDisconnection {
    if (reason.message === 'fetch failed') {
      this.death();
      return 'disconnection';
    }
    throw reason;
  }

  public async updateEntitiesElements(): Promise<ProtocolStatus> {
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
    this.entityElements = response.result.map((value) => {
      return new EntityElement(this.getProtocol().url.host, this.getState(), value.entity, {
        name: value.components['bevy_ecs::name::Name'] as string,
        childOf: value.components['bevy_ecs::hierarchy::ChildOf'] as EntityId,
        children: value.components['bevy_ecs::hierarchy::Children'] as EntityId[],
      });
    });
    this.entitiesUpdatedEmitter.fire(this);
    return 'success';
  }

  public async updateRegisteredComponents(): Promise<ProtocolStatus> {
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

  public async initialize(): Promise<ProtocolStatus> {
    this.state = 'alive';

    const status1 = await this.updateEntitiesElements();
    const status2 = await this.updateRegisteredComponents();

    if (status1 === 'disconnection' || status2 === 'disconnection') {
      return 'disconnection';
    }
    if (status1 === 'error' || status2 === 'error') {
      return 'error';
    }
    return 'success';
  }

  public getEntitiesElements() {
    return this.entityElements;
  }

  private async updateInspectionElements(): Promise<ProtocolStatus> {
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
      const collection: (NamedValueElement | ValueElement)[] = [];

      for (const entry of Object.entries(obj) as [string, BrpValue][]) {
        const name = entry[0];
        const toParse = entry[1];

        if (typeof toParse === 'object') {
          if (toParse === null) {
            collection.push(new NamedValueElement(name, [], 'NULL')); // null
            continue;
          }
          if (Array.isArray(toParse)) {
            collection.push(new NamedValueElement(name, parseValues(toParse, true))); // array...
            continue;
          }
          collection.push(new NamedValueElement(name, parseValues(toParse))); // object...
          continue;
        }
        if (isParentArray) {
          collection.push(new ValueElement(toParse)); // array value
          continue;
        }
        collection.push(new NamedValueElement(name, [], toParse)); // value
      }
      return collection;
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

  public getState(): ConnectionState {
    return this.state;
  }

  public destroyEntity(element: EntityElement): Promise<ProtocolStatus> {
    return this.protocol
      .destroy(element.id)
      .then((response) => {
        if (response.result === null) {
          this.entityElements = this.entityElements.filter((item) => item.id !== element.id);
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

  public async renameEntity(element: EntityElement): Promise<ProtocolStatus> {
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
      element.name = newName; // Optimization
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
}
