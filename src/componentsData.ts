import * as vscode from 'vscode';
import * as Elements from './elements';
import { ConnectionList } from './connection-list';
import { short } from 'bevy-remote-protocol';

export class ComponentsDataProvider implements vscode.TreeDataProvider<Elements.InspectionElement> {
  private connections: ConnectionList;
  private treeIsChangedEmitter = new vscode.EventEmitter<Elements.ComponentAndChildren | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor(connections: ConnectionList) {
    this.connections = connections;
  }

  getChildren(parent?: Elements.InspectionElement | undefined): Elements.InspectionElement[] {
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
        return [new Elements.NamedValueElement('No components in this entity', [])];
      }
      return tree;
    }
    if (
      parent instanceof Elements.ComponentAndChildren ||
      parent instanceof Elements.ComponentError ||
      parent instanceof Elements.NamedValueElement
    ) {
      return parent.children;
    }
    return [];
  }

  getTreeItem(element: Elements.InspectionElement): vscode.TreeItem {
    if (element instanceof Elements.ComponentAndChildren) {
      const treeItem = new vscode.TreeItem(short(element.typePath));
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      treeItem.tooltip = element.typePath;
      treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-log-unverified');
      return treeItem;
    }
    if (element instanceof Elements.ComponentError) {
      const treeItem = new vscode.TreeItem(short(element.typePath));
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      }
      treeItem.tooltip = element.typePath;
      treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-log');
      treeItem.description = 'error';
      return treeItem;
    }
    if (element instanceof Elements.AnyValue) {
      const treeItem = new vscode.TreeItem(element.value.toString());
      treeItem.iconPath = getThemeIconOnType(element.value);
      return treeItem;
    }
    if (element instanceof Elements.NamedValueElement) {
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

function getThemeIconOnType(value: Elements.ValueType): vscode.ThemeIcon | undefined {
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
