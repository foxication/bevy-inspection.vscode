import * as vscode from 'vscode';
import { EntityId } from 'bevy-remote-protocol';
import { InspectionSession } from './extension';

export class EntityNode {
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

export type HierarchyElement = EntityNode;

export class HierarchyProvider implements vscode.TreeDataProvider<HierarchyElement> {
  private session: InspectionSession;

  constructor(session: InspectionSession) {
    this.session = session;
  }

  // core (entry, children)
  async getChildren(element?: HierarchyElement | undefined): Promise<HierarchyElement[]> {
    if (!element) {
      return this.session.allEntitiesNodes.filter((value) => {
        if (!value.childOf) {
          return value;
        }
      });
    }
    if (element instanceof EntityNode) {
      return this.session.allEntitiesNodes.filter((value) => {
        if (value.childOf === element.id) {
          return value;
        }
      });
    }

    return [];
  }

  // core (visuals)
  async getTreeItem(element: HierarchyElement): Promise<vscode.TreeItem> {
    const treeItem = new vscode.TreeItem(
      element.name ?? element.id.toString(),
      element.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
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
}
