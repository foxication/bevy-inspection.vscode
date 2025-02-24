import * as vscode from 'vscode';
import { EntityId } from 'bevy-remote-protocol';
import { Extension } from './extension';

export function createEntitiesView(entitiesProvider: EntitiesProvider) {
  const view = vscode.window.createTreeView('entitiesView', {
    treeDataProvider: entitiesProvider,
    canSelectMany: false,
    showCollapseAll: true,
    dragAndDropController: undefined, // TODO
  });
  view.onDidChangeSelection((event) => {
    if (event.selection.length > 1) {
      return;
    }
    const selected = event.selection[0];
    Extension.componentsProvider.update(selected);
  });
  return view;
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
    const session = Extension.sessionManager.current();
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
      element.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );
    if (!element.children) {
      treeItem.iconPath = new vscode.ThemeIcon('circle-outline');
    }
    if (element.name) {
      treeItem.description = element.id.toString();
    }
    treeItem.tooltip = element.id.toString();
    return treeItem;
  }

  update() {
    this.treeIsChangedEmitter.fire();
    Extension.entitiesView.message = Extension.sessionManager.current()?.getSessionInfo();
  }
}
