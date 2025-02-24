import * as vscode from 'vscode';
import { EntityId, BrpValue, BrpError, BevyRemoteProtocol, TypePath, ServerVersion } from 'bevy-remote-protocol';
import { EntityElement } from './entities';
import { ComponentElement, InspectionElement, NamedValueElement, ValueElement } from './components';
import { Extension } from './extension';

export class ProtocolSession {
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

  private onDeath() {
    this.state = 'dead';
    Extension.setIsSessionAlive(false);
    Extension.entitiesView.description = 'Disconnected';
    Extension.componentsView.description = 'Disconnected';
  }

  async updateEntitiesElements() {
    const response = await this.protocol.query({
      option: ['bevy_ecs::name::Name', 'bevy_ecs::hierarchy::ChildOf', 'bevy_ecs::hierarchy::Children'],
    });
    if (!response.result) {
      return;
    }
    this.entityElements = response.result.map((value) => {
      return new EntityElement(value.entity, {
        name: value.components['bevy_ecs::name::Name'] as string,
        childOf: value.components['bevy_ecs::hierarchy::ChildOf'] as EntityId,
        children: value.components['bevy_ecs::hierarchy::Children'] as EntityId[],
      });
    });
  }

  async updateRegisteredComponents() {
    this.registeredComponents = (await this.protocol.list())?.result ?? [];
  }

  public async initialize() {
    await this.updateEntitiesElements();
    await this.updateRegisteredComponents();
    this.state = 'alive';
  }

  public getEntitiesElements() {
    return this.entityElements;
  }

  private async updatedInspectionElements(entityId: EntityId): Promise<ComponentElement[]> {
    if (!entityId) {
      return [];
    }

    const listResponse = await this.protocol.list(entityId);
    if (!listResponse.result) {
      if (listResponse.error) {
        throw Error(listResponse.error.message);
      }
      throw Error();
    }

    const getResponse = await this.protocol.get(entityId, listResponse.result);
    if (!getResponse.result) {
      if (getResponse.error) {
        throw Error(getResponse.error.message);
      }
      throw Error();
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
      componentTree.push(new ComponentElement(typePath, errorData));
    }
    return componentTree;
  }

  public async getInspectionElements(entityId: EntityId) {
    if (this.inspectedEntityId !== entityId) {
      this.inspectedEntityId = entityId;
      this.inspectionElements = await this.updatedInspectionElements(entityId);
      return this.inspectionElements;
    }
    if (this.inspectionElements === null) {
      this.inspectionElements = await this.updatedInspectionElements(entityId);
    }
    return this.inspectionElements;
  }

  public getSessionInfo(): string {
    return 'Bevy Remote Protocol: ' + this.protocol.url + ', Version: ' + this.protocol.serverVersion;
  }

  public isAlive() {
    return this.state === 'alive';
  }

  public async disconnect() {
    this.onDeath();
  }
}

export class SessionManager {
  private lastSession: null | ProtocolSession;

  constructor() {
    this.lastSession = null;
  }

  public async tryCreateSession() {
    // Input URL
    const url = await vscode.window.showInputBox({
      title: 'Connection to Bevy Instance',
      value: BevyRemoteProtocol.DEFAULT_URL.toString(),
    });
    if (!url) {
      return;
    }

    // Input version
    const versions = Object.keys(ServerVersion);
    const versionString = await vscode.window.showQuickPick(versions, { canPickMany: false });
    if (!versionString) {
      return;
    }
    const versionEnum = Object.values(ServerVersion)[Object.keys(ServerVersion).indexOf(versionString)];

    // Create new session
    const newSession = new ProtocolSession(new URL(url), versionEnum);
    newSession
      .initialize()
      .then(() => {
        // do not overwrite alive session
        if (this.lastSession) {
          if (this.lastSession.isAlive()) {
            return;
          }
        }

        // success
        this.lastSession = newSession;

        // Update views
        Extension.entitiesProvider.update();
        Extension.entitiesView.description = undefined;
        
        Extension.componentsProvider.update(null);
        Extension.componentsView.description = undefined;

        // Set context
        Extension.setIsSessionAlive(true);
        Extension.setAreViewsVisible(true);
      })
      .catch((reason: Error) => {
        switch (reason.message) {
          case 'fetch failed':
            vscode.window.showErrorMessage('Connection with Bevy instance is refused');
            return;
          default:
            throw reason;
        }
      });
  }

  public current() {
    return this.lastSession;
  }
}
