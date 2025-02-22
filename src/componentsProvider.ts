import * as vscode from 'vscode';
import { EntityId, TypePath } from 'bevy-remote-protocol';
import { ProtocolSession } from './session';

type Value = boolean | number | string;

export class ComponentElement {
  typePath: TypePath;
  children: NamedValueElement[] | ValueElement[];

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
  children: NamedValueElement[];
  value?: Value;

  constructor(name: string, children: typeof this.children, value?: Value) {
    this.name = name;
    this.children = children;
    this.value = value;
  }
}

export type InspectionElement = ComponentElement | ValueElement | NamedValueElement;

export class ComponentsProvider implements vscode.TreeDataProvider<InspectionElement> {
  private session: ProtocolSession;
  private focusedEntity: null | EntityId;
  private inspectionTree: ComponentElement[];
  private treeIsChangedEmitter: vscode.EventEmitter<InspectionElement | undefined | void> = new vscode.EventEmitter<
    InspectionElement | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<InspectionElement | undefined | void> = this.treeIsChangedEmitter.event;

  constructor(session: ProtocolSession) {
    this.session = session;
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

  public async focusOnEntity(entity: EntityId) {
    if (this.focusedEntity === entity) {
      return;
    }
    this.focusedEntity = entity;
    this.inspectionTree = await this.session.getComponentsTree(entity);
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
