import * as vscode from 'vscode';
import { EntityId, TypePath } from 'bevy-remote-protocol';
import { Extension } from './extension';

export function createComponentsView(componentsProvider: ComponentsProvider) {
  return vscode.window.createTreeView('inspectionView', {
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

export type InspectionElement = ComponentElement | ValueElement | NamedValueElement;

export class ComponentsProvider implements vscode.TreeDataProvider<InspectionElement> {
  private focusedEntity: null | EntityId;
  private inspectionTree: ComponentElement[];
  private treeIsChangedEmitter = new vscode.EventEmitter<ComponentElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor() {
    this.focusedEntity = null;
    this.inspectionTree = [];
  }

  async getChildren(parent?: InspectionElement | undefined): Promise<InspectionElement[]> {
    if (!parent) {
      if (this.inspectionTree.length === 0) {
        return [new NamedValueElement('No components in this entity', [])];
      }
      return this.inspectionTree;
    }
    if (parent instanceof ComponentElement || parent instanceof NamedValueElement) {
      return parent.children;
    }
    return [];
  }
  async getTreeItem(element: InspectionElement): Promise<vscode.TreeItem> {
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

  public update(entity: null | EntityId) {
    const session = Extension.sessionManager.current();
    if (!session) {
      return;
    }
    if (this.focusedEntity === entity) {
      return;
    }
    if (entity === null) {
      this.focusedEntity = null;
      this.inspectionTree = [];
      this.treeIsChangedEmitter.fire();
      return;
    }
    session.getComponentsTree(entity).then((tree) => {
      this.focusedEntity = entity;
      this.inspectionTree = tree;
      this.treeIsChangedEmitter.fire();
    });
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
