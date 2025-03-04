import * as vscode from 'vscode';
import { EntityId, ServerVersion } from 'bevy-remote-protocol';
import { ClientList } from './client-list';
import { NetworkStatus } from './client';

export function createHierarchyView(hierarchyData: HierarchyDataProvider) {
  return vscode.window.createTreeView('hierarchyView', {
    treeDataProvider: hierarchyData,
    canSelectMany: false,
    showCollapseAll: true,
    dragAndDropController: undefined, // TODO
  });
}

export class ClientElement {
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
    clientHost: string,
    network: NetworkStatus,
    id: EntityId,
    options?: { name?: string; childOf?: EntityId; children?: EntityId[] }
  ) {
    this.host = clientHost;
    this.network = network;
    this.id = id;
    this.name = options?.name;
    this.childOf = options?.childOf;
    this.children = options?.children;
  }
}

export type HierarchyElement = EntityElement | ClientElement;

export class HierarchyDataProvider implements vscode.TreeDataProvider<HierarchyElement> {
  private clients: ClientList;
  private treeIsChangedEmitter = new vscode.EventEmitter<HierarchyElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor(clients: ClientList) {
    this.clients = clients;
  }

  getChildren(element?: HierarchyElement | undefined): HierarchyElement[] {
    // render all clients and entities
    if (!element) {
      return this.clients.all().map((client) => {
        const protocol = client.getProtocol();
        return new ClientElement(protocol.url.host, protocol.serverVersion, client.getNetworkStatus());
      });
    }

    const client = this.clients.get(element.host);
    if (client === undefined) {
      return [];
    }

    // render entities of client | entity
    if (element instanceof ClientElement || element instanceof EntityElement) {
      return client.getChildrenOf(element);
    }

    return [];
  }

  getTreeItem(element: HierarchyElement): vscode.TreeItem {
    if (element instanceof ClientElement) {
      const client = this.clients.get(element.host);
      if (client === undefined) {
        return new vscode.TreeItem('No such client');
      }

      const hasEntities = client.get().size > 0;
      const collapsible = hasEntities ? vscode.TreeItemCollapsibleState.Expanded : undefined;
      const treeItem = new vscode.TreeItem(element.host.toString(), collapsible);

      // Context + description
      if (client.getNetworkStatus() === 'online') {
        treeItem.contextValue = 'clientElementOnline';
        treeItem.description = 'Version: ' + element.version;
      } else {
        treeItem.contextValue = 'clientElementOffline';
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
          treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-data-unverified');
          break;
        case 'online':
          treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-data-disabled');
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

  updateClients() {
    this.treeIsChangedEmitter.fire();
  }

  updateInClient(host: string) {
    this.treeIsChangedEmitter.fire(this.clients.getAsElement(host));
  }

  updateInScope(parent: EntityElement) {
    this.treeIsChangedEmitter.fire(parent);
  }
}
