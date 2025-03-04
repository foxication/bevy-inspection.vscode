import * as vscode from 'vscode';
import { ConnectionList } from './client-list';
import { EntityId, TypePath } from 'bevy-remote-protocol';

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

export class CurrentEntityFocus {
  private _host: string;
  private _entityId: EntityId;

  constructor(host: string, entityId: EntityId) {
    this._host = host;
    this._entityId = entityId;
  }

  get host() {
    return this._host;
  }

  get entityId() {
    return this._entityId;
  }
}

export class ComponentsDataProvider implements vscode.TreeDataProvider<InspectionElement> {
  private connections: ConnectionList;
  private _focus: null | CurrentEntityFocus;
  private treeIsChangedEmitter = new vscode.EventEmitter<ComponentElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor(connections: ConnectionList) {
    this.connections = connections;
    this._focus = null;
  }

  get focus() {
    return this._focus;
  }

  async getChildren(parent?: InspectionElement | undefined): Promise<InspectionElement[]> {
    if (this._focus === null) {
      return [];
    }
    const connection = this.connections.get(this._focus.host);
    if (connection === undefined) {
      return [];
    }
    if (!parent) {
      const tree = await connection.getInspectionElements(this._focus.entityId);
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
    const getShortPath = (path: string) => {
      return (/[^::]*$/.exec(path.split('<')[0]) ?? '???')[0];
    };
    if (element instanceof ComponentElement) {
      const treeItem = new vscode.TreeItem(getShortPath(element.typePath));
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      treeItem.tooltip = element.typePath;
      treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-log-unverified');
      return treeItem;
    }
    if (element instanceof ComponentErrorElement) {
      const treeItem = new vscode.TreeItem(getShortPath(element.typePath));
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

  public update(newFocus: CurrentEntityFocus | null) {
    // Check if focus changed
    if (this._focus === newFocus) {
      return;
    }

    // Scenario when focus is null
    if (newFocus === null) {
      this._focus = null;
      this.treeIsChangedEmitter.fire();
      return;
    }

    // Check if connection exists and is online
    const connection = this.connections.get(newFocus.host);
    if (connection === undefined || connection.getNetworkStatus() === 'offline') {
      return;
    }

    // Change focus of inspection and emmit (what is async?)
    this._focus = new CurrentEntityFocus(newFocus.host, newFocus.entityId);
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
