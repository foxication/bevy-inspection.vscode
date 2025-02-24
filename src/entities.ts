import * as vscode from 'vscode';
import { EntityId } from 'bevy-remote-protocol';
import { getClientCollection } from './extension';

export function createEntitiesView(entitiesProvider: EntitiesProvider) {
  return vscode.window.createTreeView('entitiesView', {
    treeDataProvider: entitiesProvider,
    canSelectMany: false,
    showCollapseAll: true,
    dragAndDropController: undefined, // TODO
  });
}

export class EntityElement {
  id: EntityId;
  name?: string;
  childOf?: EntityId;
  children?: EntityId[];

  constructor(id: EntityId, options?: { name?: string; childOf?: EntityId; children?: EntityId[] }) {
    this.id = id;
    this.name = options?.name;
    this.childOf = options?.childOf;
    this.children = options?.children;
  }
}

export class EntitiesProvider implements vscode.TreeDataProvider<EntityElement> {
  private treeIsChangedEmitter = new vscode.EventEmitter<EntityElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  getChildren(element?: EntityElement | undefined): EntityElement[] {
    const session = getClientCollection().current();
    if (!session) {
      return [];
    }

    if (!element) {
      return session.getEntitiesElements().filter((value) => {
        if (!value.childOf) {
          return value;
        }
      });
    }
    if (element instanceof EntityElement) {
      return session.getEntitiesElements().filter((value) => {
        if (value.childOf === element.id) {
          return value;
        }
      });
    }

    return [];
  }

  getTreeItem(element: EntityElement): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.name ?? element.id.toString(),
      typeof element.children !== 'undefined' ? vscode.TreeItemCollapsibleState.Expanded : undefined
    );
    treeItem.id = element.id.toString();
    if (!element.children) {
      treeItem.iconPath = new vscode.ThemeIcon('circle-outline');
    }
    if (element.name) {
      treeItem.description = element.id.toString();
    }
    treeItem.tooltip = element.id.toString();
    treeItem.contextValue = 'entityElement';
    return treeItem;
  }

  update(options: { parentId?: EntityId; skipQuery?: boolean } | null) {
    const client = getClientCollection().current();
    if (client === null) {
      return;
    }

    (options?.skipQuery === true ? (async (): Promise<void> => {})() : client.updateEntitiesElements()).then(() => {
      const parentElement = client.getEntitiesElements().find((item) => item.id === options?.parentId);
      this.treeIsChangedEmitter.fire(parentElement ?? undefined);
    });
  }
}
