import * as vscode from 'vscode';
import { ConnectionList } from './connection-list';
import { short, TypePath } from 'bevy-remote-protocol';

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

export class ComponentsDataProvider implements vscode.TreeDataProvider<InspectionElement> {
  private connections: ConnectionList;
  private treeIsChangedEmitter = new vscode.EventEmitter<ComponentElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor(connections: ConnectionList) {
    this.connections = connections;
  }

  getChildren(parent?: InspectionElement | undefined): InspectionElement[] {
    if (this.connections.focus === null) {
      return [];
    }
    const connection = this.connections.get(this.connections.focus.host);
    if (connection === undefined) {
      return [];
    }
    if (!parent) {
      const tree = connection.getInspectionElements();
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
      const treeItem = new vscode.TreeItem(short(element.typePath));
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      treeItem.tooltip = element.typePath;
      treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-log-unverified');
      return treeItem;
    }
    if (element instanceof ComponentErrorElement) {
      const treeItem = new vscode.TreeItem(short(element.typePath));
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
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

  update() {
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
