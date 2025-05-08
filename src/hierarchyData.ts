import * as vscode from 'vscode';
import { EntityId, TypePath } from './protocol';
import { ConnectionList } from './connection-list';
import { Connection, NetworkStatus } from './connection';

export function createHierarchyView(hierarchyData: HierarchyDataProvider) {
  return vscode.window.createTreeView('hierarchyView', {
    treeDataProvider: hierarchyData,
    canSelectMany: false,
    showCollapseAll: true,
    dragAndDropController: undefined, // TODO
  });
}

export class EntityElement {
  constructor(
    public host: string,
    public network: NetworkStatus,
    public id: EntityId,
    public childOf: EntityId | undefined,
    public children: EntityId[],
    public components: TypePath[],
    public name?: string
  ) {}
}

export type HierarchyElement = EntityElement | Connection;

export class HierarchyDataProvider implements vscode.TreeDataProvider<HierarchyElement> {
  private connections: ConnectionList;
  private treeIsChangedEmitter = new vscode.EventEmitter<HierarchyElement | undefined | void>();
  readonly onDidChangeTreeData = this.treeIsChangedEmitter.event;

  constructor(connections: ConnectionList) {
    this.connections = connections;
  }

  getChildren(element?: HierarchyElement | undefined): HierarchyElement[] {
    // render all connections and entities
    if (!element) {
      return this.connections.all();
    }

    if (element instanceof Connection) return element.getChildren();
    return this.connections.get(element.host)?.getChildrenOf(element) ?? [];
  }

  getTreeItem(element: HierarchyElement): vscode.TreeItem {
    if (element instanceof Connection) {
      const hasEntities = element.get().size > 0;
      const collapsible = hasEntities ? vscode.TreeItemCollapsibleState.Expanded : undefined;
      const treeItem = new vscode.TreeItem(element.getHost(), collapsible);

      // Context + description
      if (element.getNetworkStatus() === 'online') {
        treeItem.contextValue = 'connectionElementOnline';
        treeItem.description = 'Version: ' + element.getVersion();
      } else {
        treeItem.contextValue = 'connectionElementOffline';
        treeItem.description = 'Disconnected';
      }
      return treeItem;
    }

    // if element instanceof EntityElement
    const collapsible =
      element.children.length === 0 ? undefined : vscode.TreeItemCollapsibleState.Expanded;
    const treeItem = new vscode.TreeItem(element.id.toString(), collapsible);
    if (element.name !== undefined) treeItem.description = element.name;
    treeItem.id = element.host + '/' + element.id.toString();
    treeItem.tooltip = treeItem.id;
    switch (element.network) {
      case 'offline':
        treeItem.contextValue = 'entityElementOffline';
        treeItem.iconPath = new vscode.ThemeIcon('debug-disconnect');
        break;
      case 'online':
        treeItem.contextValue = 'entityElementOnline';
        treeItem.iconPath = iconFromComponents(element.components);
        break;
    }
    return treeItem;
  }

  update(data: HierarchyElement | undefined) {
    this.treeIsChangedEmitter.fire(data);
  }
}

export const componentsWithIcons = [
  'bevy_ecs::observer::runner::Observer',
  'bevy_ecs::system::system_registry::SystemIdMarker',
  'bevy_window::monitor::Monitor',
  'bevy_window::window::Window',
  'bevy_picking::pointer::PointerId',
  'bevy_ui::ui_node::Node',
  'bevy_ui::widget::text::Text',
  'bevy_pbr::light::point_light::PointLight',
  'bevy_render::camera::camera::Camera',
  'bevy_render::mesh::components::Mesh3d',
  'bevy_transform::components::transform::Transform',
] as const;

function iconFromComponents(components: TypePath[]) {
  const highest = componentsWithIcons.find((key) => components.includes(key));
  switch (highest) {
    case 'bevy_ecs::observer::runner::Observer':
      return new vscode.ThemeIcon('compass');
    case 'bevy_ecs::system::system_registry::SystemIdMarker':
      return new vscode.ThemeIcon('chip');
    case 'bevy_window::monitor::Monitor':
      return new vscode.ThemeIcon('device-desktop');
    case 'bevy_window::window::Window':
      return new vscode.ThemeIcon('window');
    case 'bevy_picking::pointer::PointerId':
      return new vscode.ThemeIcon('inspect');
    case 'bevy_ui::ui_node::Node':
      return new vscode.ThemeIcon('layout');
    case 'bevy_ui::widget::text::Text':
      return new vscode.ThemeIcon('symbol-text');
    case 'bevy_pbr::light::point_light::PointLight':
      return new vscode.ThemeIcon('lightbulb');
    case 'bevy_render::camera::camera::Camera':
      return new vscode.ThemeIcon('device-camera');
    case 'bevy_render::mesh::components::Mesh3d':
      return new vscode.ThemeIcon('symbol-method', new vscode.ThemeColor('icon.foreground'));
    case 'bevy_transform::components::transform::Transform':
      return new vscode.ThemeIcon('move');
  }
  return new vscode.ThemeIcon('debug-breakpoint-unverified');
}
