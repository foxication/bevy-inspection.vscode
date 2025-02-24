import * as vscode from 'vscode';
import { EntityId, TypePath } from 'bevy-remote-protocol';
import { EntityElement } from './entities';
import { ClientCollection } from './client-collection';

export function createComponentsView(componentsProvider: ComponentsProvider) {
  return vscode.window.createTreeView('componentsView', {
    treeDataProvider: componentsProvider,
    canSelectMany: false,
    showCollapseAll: true,
  });
}

type Value = boolean | number | string;

export class ComponentElement {
  typePath: TypePath;
  children: (NamedValueElement | ValueElement)[];

  constructor(name: string, children: typeof this.children) {
    this.typePath = name;
    this.children = children;
  }
}

export class ComponentErrorElement {
  typePath: TypePath;
  children: (NamedValueElement | ValueElement)[];

  constructor(name: string, children: typeof this.children) {
    this.typePath = name;
    this.children = children;
  }
}

export class ValueElement {
  value: Value;

  constructor(value: Value) {
    this.value = value;
  }
}

export class NamedValueElement {
  name: string;
  children: (NamedValueElement | ValueElement)[];
  value?: Value;

  constructor(name: string, children: typeof this.children, value?: Value) {
    this.name = name;
    this.children = children;
    this.value = value;
  }
}

export type InspectionElement = ComponentElement | ComponentErrorElement | ValueElement | NamedValueElement;

export class ComponentsProvider implements vscode.TreeDataProvider<InspectionElement> {
  private clientCollection: ClientCollection;
  private focusedEntityId: null | EntityId;
  private treeIsChangedEmitter = new vscode.EventEmitter<ComponentElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor(clientCollection: ClientCollection) {
    this.clientCollection = clientCollection;
    this.focusedEntityId = null;
  }

  async getChildren(parent?: InspectionElement | undefined): Promise<InspectionElement[]> {
    const session = this.clientCollection.current();
    if (session === null) {
      return [];
    }
    if (this.focusedEntityId === null) {
      return [];
    }
    if (!parent) {
      const tree = await session.getInspectionElements(this.focusedEntityId);
      if (tree.length === 0) {
        return [new NamedValueElement('No components in this entity', [])];
      }
      return tree;
    }
    if (
      parent instanceof ComponentElement ||
      parent instanceof ComponentErrorElement ||
      parent instanceof NamedValueElement
    ) {
      return parent.children;
    }
    return [];
  }

  getTreeItem(element: InspectionElement): vscode.TreeItem {
    if (element instanceof ComponentElement) {
      const shortPath = (/[^::]*$/.exec(element.typePath) ?? '???')[0];
      const treeItem = new vscode.TreeItem(shortPath);
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      treeItem.tooltip = element.typePath;
      treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-log-unverified');
      return treeItem;
    }
    if (element instanceof ComponentErrorElement) {
      const shortPath = (/[^::]*$/.exec(element.typePath) ?? '???')[0];
      const treeItem = new vscode.TreeItem(shortPath);
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      treeItem.tooltip = element.typePath;
      treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-log');
      treeItem.description = 'error';
      return treeItem;
    }
    if (element instanceof ValueElement) {
      const treeItem = new vscode.TreeItem(element.value.toString());
      treeItem.iconPath = getThemeIconOnType(element.value);
      return treeItem;
    }
    if (element instanceof NamedValueElement) {
      let treeItem;
      if (element.value !== undefined) {
        treeItem = new vscode.TreeItem(element.value.toString());
        treeItem.description = element.name;
        treeItem.iconPath = getThemeIconOnType(element.value);
      } else {
        treeItem = new vscode.TreeItem(element.name);
      }
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      return treeItem;
    }
    throw Error('unknown type of ComponentTreeElement');
  }

  public update(entity: null | EntityElement) {
    // Check if update needed
    const session = this.clientCollection.current();
    if (!session || !session.isAlive()) {
      return;
    }
    if (this.focusedEntityId === (entity === null ? null : entity.id)) {
      return;
    }

    // Make empty
    if (entity === null) {
      this.focusedEntityId = null;
      this.treeIsChangedEmitter.fire();
      return;
    }

    // Or change to entity (notice - it is async)
    this.focusedEntityId = entity.id;
    this.treeIsChangedEmitter.fire();
  }
}

function getThemeIconOnType(value: Value): vscode.ThemeIcon | undefined {
  switch (typeof value) {
    case 'string':
      switch (value) {
        case 'NULL':
          return new vscode.ThemeIcon('error');
        case 'ERROR':
          return new vscode.ThemeIcon('error');
        default:
          return new vscode.ThemeIcon('symbol-text');
      }
    case 'number':
      return new vscode.ThemeIcon('symbol-number');
    case 'boolean':
      return new vscode.ThemeIcon('symbol-boolean');
  }
}
