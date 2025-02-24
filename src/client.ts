import * as vscode from 'vscode';
import { EntityId, BrpValue, BrpError, BevyRemoteProtocol, TypePath, ServerVersion } from 'bevy-remote-protocol';
import { EntityElement } from './entities';
import {
  ComponentElement,
  ComponentErrorElement,
  InspectionElement,
  NamedValueElement,
  ValueElement,
} from './components';
import { Extension } from './extension';

type StatusDisconnection = 'disconnection';
type ProtocolStatus = 'success' | 'error' | StatusDisconnection;

export class Client {
  // Session data
  private protocol: BevyRemoteProtocol;
  private state: 'dead' | 'alive';

  // Bevy data
  private registeredComponents: TypePath[] = [];
  private entityElements: EntityElement[] = [];
  private inspectedEntityId: EntityId | null = null;
  private inspectionElements: InspectionElement[] | null = null;

  constructor(url: URL, version: ServerVersion) {
    this.state = 'dead';
    this.protocol = new BevyRemoteProtocol(url, version);
  }

  public death() {
    const wasAlive = this.state === 'alive';
    this.state = 'dead';
    Extension.setIsSessionAlive(false);
    Extension.entitiesView.description = 'Disconnected';
    Extension.componentsView.description = 'Disconnected';

    if (wasAlive) {
      vscode.window.showInformationMessage('Bevy instance has been disconnected', 'Reconnect').then((reaction) => {
        if (reaction === 'Reconnect') {
          Extension.clientCollection.tryCreateSession('last');
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
      return new EntityElement(value.entity, {
        name: value.components['bevy_ecs::name::Name'] as string,
        childOf: value.components['bevy_ecs::hierarchy::ChildOf'] as EntityId,
        children: value.components['bevy_ecs::hierarchy::Children'] as EntityId[],
      });
    });
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
    const status1 = await this.updateEntitiesElements();
    const status2 = await this.updateRegisteredComponents();

    if (status1 === 'disconnection' || status2 === 'disconnection') {
      return 'disconnection';
    }
    if (status1 === 'error' || status2 === 'error') {
      return 'error';
    }

    this.state = 'alive';
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

  public isAlive() {
    return this.state === 'alive';
  }

  public destroyEntity(element: EntityElement): Promise<ProtocolStatus> {
    return this.protocol
      .destroy(element.id)
      .then((response) => {
        if (response.result === null) {
          this.entityElements = this.entityElements.filter((item) => item.id !== element.id);
          Extension.entitiesProvider.update({ parentId: element.childOf, skipQuery: true });
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
    const newName = await vscode.window.showInputBox({}); // Prompt
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
      Extension.entitiesProvider.update({ parentId: element.childOf, skipQuery: true }); // Update view
      return 'success';
    }
    return 'error';
  }

  public cloneWithProtocol() {
    return new Client(this.protocol.url, this.protocol.serverVersion);
  }
}
