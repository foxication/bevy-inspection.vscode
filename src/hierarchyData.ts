import * as vscode from 'vscode';
import { EntityId, ServerVersion } from './protocol';
import { ConnectionList } from './connection-list';
import { NetworkStatus } from './connection';

export function createHierarchyView(hierarchyData: HierarchyDataProvider) {
  return vscode.window.createTreeView('hierarchyView', {
    treeDataProvider: hierarchyData,
    canSelectMany: false,
    showCollapseAll: true,
    dragAndDropController: undefined, // TODO
  });
}

export class ConnectionElement {
  host: string;
  version: ServerVersion;
  network: NetworkStatus;

  constructor(host: string, version: ServerVersion, network: NetworkStatus) {
    this.host = host;
    this.version = version;
    this.network = network;
  }
}

export class EntityElement {
  host: string;
  network: NetworkStatus;
  id: EntityId;
  name?: string;
  childOf?: EntityId;
  children?: EntityId[];

  constructor(
    host: string,
    network: NetworkStatus,
    id: EntityId,
    options?: { name?: string; childOf?: EntityId; children?: EntityId[] }
  ) {
    this.host = host;
    this.network = network;
    this.id = id;
    this.name = options?.name;
    this.childOf = options?.childOf;
    this.children = options?.children;
  }
}

export type HierarchyElement = EntityElement | ConnectionElement;

export class HierarchyDataProvider implements vscode.TreeDataProvider<HierarchyElement> {
  private connections: ConnectionList;
  private treeIsChangedEmitter = new vscode.EventEmitter<HierarchyElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor(connections: ConnectionList) {
    this.connections = connections;
  }

  getChildren(element?: HierarchyElement | undefined): HierarchyElement[] {
    // render all connections and entities
    if (!element) {
      return this.connections.all().map((connection) => {
        const protocol = connection.getProtocol();
        return new ConnectionElement(protocol.url.host, protocol.serverVersion, connection.getNetworkStatus());
      });
    }

    const connection = this.connections.get(element.host);
    if (connection === undefined) {
      return [];
    }

    // render entities of connection | entity
    if (element instanceof ConnectionElement || element instanceof EntityElement) {
      return connection.getChildrenOf(element);
    }

    return [];
  }

  getTreeItem(element: HierarchyElement): vscode.TreeItem {
    if (element instanceof ConnectionElement) {
      const connection = this.connections.get(element.host);
      if (connection === undefined) {
        return new vscode.TreeItem('No such connection');
      }

      const hasEntities = connection.get().size > 0;
      const collapsible = hasEntities ? vscode.TreeItemCollapsibleState.Expanded : undefined;
      const treeItem = new vscode.TreeItem(element.host.toString(), collapsible);

      // Context + description
      if (connection.getNetworkStatus() === 'online') {
        treeItem.contextValue = 'connectionElementOnline';
        treeItem.description = 'Version: ' + element.version;
      } else {
        treeItem.contextValue = 'connectionElementOffline';
        treeItem.description = 'Disconnected';
      }
      return treeItem;
    }

    // if element instanceof EntityElement
    const collapsible =
      element.children === undefined || element.children.length === 0
        ? undefined
        : vscode.TreeItemCollapsibleState.Expanded;
    const treeItem = new vscode.TreeItem(element.name ?? element.id.toString(), collapsible);
    treeItem.id = element.host + '/' + element.id.toString();
    if (collapsible === undefined) {
      switch (element.network) {
        case 'offline':
          treeItem.iconPath = new vscode.ThemeIcon('debug-disconnect');
          break;
        case 'online':
          treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-unverified');
          break;
      }
    }
    if (element.name) {
      treeItem.description = element.id.toString();
    }
    treeItem.tooltip = treeItem.id;
    switch (element.network) {
      case 'offline':
        treeItem.contextValue = 'entityElementOffline';
        break;
      case 'online':
        treeItem.contextValue = 'entityElementOnline';
        break;
    }
    return treeItem;
  }

  updateConnections() {
    this.treeIsChangedEmitter.fire();
  }

  updateInConnection(host: string) {
    this.treeIsChangedEmitter.fire(this.connections.getAsElement(host));
  }

  updateInScope(parent: EntityElement) {
    this.treeIsChangedEmitter.fire(parent);
  }
}
