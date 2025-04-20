import * as vscode from 'vscode';
import { EntityId } from './protocol';
import { ConnectionList } from './connection-list';
import { Connection, NetworkStatus } from './connection';

export function createHierarchyView(hierarchyData: HierarchyDataProvider) {
  return vscode.window.createTreeView('hierarchyView', {
    treeDataProvider: hierarchyData,
    canSelectMany: false,
    showCollapseAll: true,
    dragAndDropController: undefined, // TODO
  });
}

export class EntityElement {
  constructor(
    public host: string,
    public network: NetworkStatus,
    public id: EntityId,
    public childOf: EntityId | string,
    public children: EntityId[],
    public name?: string
  ) {}
}

export type HierarchyElement = EntityElement | Connection;

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
      return this.connections.all();
    }

    if (element instanceof Connection) return element.getChildren();
    return this.connections.get(element.host)?.getChildrenOf(element) ?? [];
  }

  getTreeItem(element: HierarchyElement): vscode.TreeItem {
    if (element instanceof Connection) {
      const hasEntities = element.get().size > 0;
      const collapsible = hasEntities ? vscode.TreeItemCollapsibleState.Expanded : undefined;
      const treeItem = new vscode.TreeItem(element.getHost(), collapsible);

      // Context + description
      if (element.getNetworkStatus() === 'online') {
        treeItem.contextValue = 'connectionElementOnline';
        treeItem.description = 'Version: ' + element.getVersion();
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

  update(data: HierarchyElement | undefined) {
    this.treeIsChangedEmitter.fire(data);
  }
}
