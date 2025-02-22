import { EntityId, BrpValue, BrpError, BevyRemoteProtocol, TypePath, ServerVersion } from 'bevy-remote-protocol';
import { EntityNode } from './entitiesProvider';
import { ComponentElement, NamedValueElement, ValueElement } from './componentsProvider';

export class ProtocolSession {
  private onDeath: () => void;

  private protocol: BevyRemoteProtocol;
  public state: 'empty' | 'dead' | 'alive';
  public registeredComponents: TypePath[] = [];
  public allEntitiesNodes: EntityNode[] = [];

  constructor(state: typeof this.state, url: URL, version: ServerVersion, onDeath: () => void) {
    this.state = state;
    this.protocol = new BevyRemoteProtocol(url, version);
    this.onDeath = onDeath;
  }
  getSessionInfo(): string {
    return 'Bevy Remote Protocol: ' + this.protocol.url + ', Version: ' + this.protocol.serverVersion;
  }
  async postConstructor() {
    const response = await this.protocol.query({
      option: ['bevy_ecs::name::Name', 'bevy_ecs::hierarchy::ChildOf', 'bevy_ecs::hierarchy::Children'],
    });
    if (!response.result) {
      return;
    }
    this.allEntitiesNodes = response.result.map((value) => {
      return new EntityNode(value.entity, {
        name: value.components['bevy_ecs::name::Name'] as string,
        childOf: value.components['bevy_ecs::hierarchy::ChildOf'] as EntityId,
        children: value.components['bevy_ecs::hierarchy::Children'] as EntityId[],
      });
    });
    this.registeredComponents = (await this.protocol.list())?.result ?? [];
    this.state = 'alive';
  }
  isAlive() {
    return this.state === 'alive';
  }

  async stop() {
    this.state = 'dead';
    this.onDeath();
  }

  async getComponentsTree(entity: EntityId): Promise<ComponentElement[]> {
    if (!entity) {
      return [];
    }

    const listResponse = await this.protocol.list(entity);
    if (!listResponse.result) {
      if (listResponse.error) {
        throw Error(listResponse.error.message);
      }
      throw Error();
    }

    const getResponse = await this.protocol.get(entity, listResponse.result);
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
}
