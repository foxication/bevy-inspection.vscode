import * as vscode from 'vscode';
import { BrpError, BrpValue, EntityId, TypePath } from 'bevy-remote-protocol';
import { InspectionSession } from './extension';

type Value = boolean | number | string;

export class Component {
  typePath: TypePath;
  children: NamedValue[] | ComponentValue[];

  constructor(name: string, children: typeof this.children) {
    this.typePath = name;
    this.children = children;
  }
}

export class ComponentValue {
  value: Value;

  constructor(value: Value) {
    this.value = value;
  }
}

export class NamedValue {
  name: string;
  children: NamedValue[];
  value?: Value;

  constructor(name: string, children: typeof this.children, value?: Value) {
    this.name = name;
    this.children = children;
    this.value = value;
  }
}

export type InspectionElement = Component | ComponentValue | NamedValue;

export class ComponentsDataProvider implements vscode.TreeDataProvider<InspectionElement> {
  private session: InspectionSession;
  private focusedEntity: null | EntityId;
  private inspectionTree: Component[];
  private treeIsChangedEmitter: vscode.EventEmitter<InspectionElement | undefined | void> = new vscode.EventEmitter<
    InspectionElement | undefined | void
  >();
  readonly onDidChangeTreeData: vscode.Event<InspectionElement | undefined | void> = this.treeIsChangedEmitter.event;

  constructor(session: InspectionSession) {
    this.session = session;
    this.focusedEntity = null;
    this.inspectionTree = [];
  }

  async getChildren(parent?: InspectionElement | undefined): Promise<InspectionElement[]> {
    if (!parent) {
      if (this.inspectionTree.length === 0) {
        return [new NamedValue('No components in this entity', [])];
      }
      return this.inspectionTree;
    }
    if (parent instanceof Component || parent instanceof NamedValue) {
      return parent.children;
    }
    return [];
  }
  async getTreeItem(element: InspectionElement): Promise<vscode.TreeItem> {
    if (element instanceof Component) {
      const shortPath = (/[^::]*$/.exec(element.typePath) ?? '???')[0];
      const treeItem = new vscode.TreeItem(shortPath);
      if (element.children.length > 0) {
        treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
      }
      treeItem.tooltip = element.typePath;
      treeItem.iconPath = new vscode.ThemeIcon('debug-breakpoint-log-unverified');
      return treeItem;
    }
    if (element instanceof ComponentValue) {
      const treeItem = new vscode.TreeItem(element.value.toString());
      treeItem.iconPath = getThemeIconOnType(element.value);
      return treeItem;
    }
    if (element instanceof NamedValue) {
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
    await this.requestData();
    this.treeIsChangedEmitter.fire();
  }
  async requestData() {
    if (!this.focusedEntity) {
      return [];
    }

    const listResponse = await this.session.protocol.list(this.focusedEntity);
    if (!listResponse.result) {
      if (listResponse.error) {
        throw Error(listResponse.error.message);
      }
      throw Error();
    }

    const getResponse = await this.session.protocol.get(this.focusedEntity, listResponse.result);
    if (!getResponse.result) {
      if (getResponse.error) {
        throw Error(getResponse.error.message);
      }
      throw Error();
    }

    // Parsing result
    this.inspectionTree = [];
    for (const entry of Object.entries(getResponse.result.components) as [string, BrpValue][]) {
      const typePath = entry[0];
      const toParse = entry[1];

      if (Array.isArray(toParse) || typeof toParse === 'object') {
        if (toParse === null) {
          this.inspectionTree.push(new Component(typePath, [new ComponentValue('NULL')]));
          continue;
        }
        this.inspectionTree.push(new Component(typePath, parseNamedValues(toParse)));
        continue;
      }
      this.inspectionTree.push(new Component(typePath, [new ComponentValue(toParse)]));
    }

    // Parsing errors
    for (const entry of Object.entries(getResponse.result.errors) as [string, BrpError][]) {
      const typePath = entry[0];
      const toParse = entry[1];
      const errorData = [new NamedValue('code', [], toParse.code), new NamedValue('message', [], toParse.message)];
      if (toParse.data !== undefined && typeof toParse.data !== 'object') {
        new NamedValue('message', [], toParse.data);
      }
      this.inspectionTree.push(new Component(typePath, errorData));
    }
    console.log(getResponse.result.errors);
  }
}

function parseNamedValues(obj: object): NamedValue[] {
  const collection: NamedValue[] = [];

  for (const entry of Object.entries(obj) as [string, BrpValue][]) {
    const name = entry[0];
    const toParse = entry[1];

    if (Array.isArray(toParse) || typeof toParse === 'object') {
      if (toParse === null) {
        collection.push(new NamedValue(name, [], 'NULL'));
        continue;
      }
      collection.push(new NamedValue(name, parseNamedValues(toParse)));
      continue;
    }
    collection.push(new NamedValue(name, [], toParse));
  }
  return collection;
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
