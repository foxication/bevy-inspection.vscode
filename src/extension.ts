import * as vscode from 'vscode';
import { createComponentsView } from './componentsView';
import {
  createHierarchyView,
  HierarchyDataProvider,
  EntityElement,
  HierarchyElement,
} from './hierarchyData';
import { ConnectionList } from './connection-list';
import { Connection } from './connection';
import { EntityFocus } from './common';

// Context
function areThereConnections(value: boolean) {
  vscode.commands.executeCommand('setContext', 'extension.areThereConnections', value);
}

export function activate(context: vscode.ExtensionContext) {
  // Context
  areThereConnections(false);

  // Views
  const connections = new ConnectionList();
  const hierarchyData = new HierarchyDataProvider(connections);
  const hierarchyView = createHierarchyView(hierarchyData);
  const componentsView = createComponentsView(context, connections);

  // Userspace commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.debugOutput', () => componentsView.debugOutput()),
    vscode.commands.registerCommand('extension.addConnection', () =>
      connections.tryCreateConnection()
    ),
    vscode.commands.registerCommand('extension.reconnectLast', () =>
      connections.tryCreateConnection('last')
    )
  );

  // Extension only commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.reconnect', (connection: Connection) =>
      connection.reconnect()
    ),
    vscode.commands.registerCommand('extension.updateEntities', (element: HierarchyElement) =>
      element instanceof Connection
        ? element.requestEntityElements()
        : connections.get(element.host)?.requestEntityElements()
    ),
    vscode.commands.registerCommand('extension.disonnect', (connection: Connection) =>
      connection.disconnect()
    ),
    vscode.commands.registerCommand('extension.removeConnection', (connection: Connection) => {
      if (connection.getNetworkStatus() === 'online') connection.disconnect();
      connections.removeConnection(connection.getHost());
    }),
    vscode.commands.registerCommand('extension.destroyEntity', (element: EntityElement) =>
      connections.get(element.host)?.requestDestroyOfEntity(element)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) =>
      connections.get(element.host)?.requestRenameOfEntity(element)
    )
  );

  // Webview commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.copyLabel', (context: { label: string }) => {
      vscode.env.clipboard.writeText(context.label);
    }),
    vscode.commands.registerCommand('extension.copyType', (context: { type: string }) => {
      vscode.env.clipboard.writeText(context.type);
    }),
    vscode.commands.registerCommand('extension.copyValue', (context: { path: string }) => {
      componentsView.copyValueToClipboard(context.path);
    }),
    vscode.commands.registerCommand('extension.copyDetails', (context: { details: string }) => {
      componentsView.copyDetailsToClipboard(context.details);
    }),
    vscode.commands.registerCommand('extension.copyError', (context: { errorPath: string }) => {
      componentsView.copyErrorToClipboard(context.errorPath);
    }),
    vscode.commands.registerCommand(
      'extension.removeComponent',
      (context: { component: string }) => {
        const focus = connections.focus;
        if (focus === undefined) return;
        const connection = connections.get(focus.host);
        if (connection === undefined) return;

        connection.getProtocol().remove(focus.entityId, [context.component]);
      }
    ),
    vscode.commands.registerCommand('extension.manualUpdate', () => {
      componentsView.manualUpdate();
    }),
    vscode.commands.registerCommand('extension.liveUpdate', () => {
      componentsView.liveUpdate();
    })
  );

  // Events sorted by call order
  connections.onAdded((connection) => {
    // Update views
    hierarchyView.description = undefined;
    hierarchyData.update(undefined);

    // Set context
    areThereConnections(true);

    // Connect all events
    connection.onHierarchyUpdated((connection) => {
      hierarchyData.update(connection);
    });

    connection.onEntityDestroyed((destroyed) => {
      const connection = connections.get(destroyed.host);
      if (connection === undefined) {
        return console.error('Connection.onEntityDestroyed: no connection');
      }
      hierarchyData.update(
        typeof destroyed.childOf === 'number' ? connection.getById(destroyed.childOf) : connection
      );
    });

    connection.onEntityRenamed((renamed) => {
      hierarchyData.update(renamed);
    });

    connection.onDisconnection((connection) => {
      hierarchyData.update(undefined);

      vscode.window
        .showInformationMessage('Bevy App has been disconnected', 'Reconnect')
        .then((reaction) => {
          if (reaction === 'Reconnect') {
            connections.tryCreateConnection('last');
          }
        });

      // this seems to be workaround as connection status is not binded between connection and view
      if (connections.focus?.host === connection.getHost()) {
        componentsView.updateDescription(false);
        componentsView.updateAllAsOffline(connections.focus);
      }
    });

    connection.onReconnection(() => {
      hierarchyData.update(undefined);
      if (connections.focus?.host === connection.getHost()) componentsView.updateDescription(true);
      if (connections.focus !== undefined) componentsView.updateAll(connections.focus);
    });
  });
  connections.onRemoved(() => {
    areThereConnections(connections.all().length > 0);
    hierarchyData.update(undefined);
  });

  hierarchyData.onDidChangeTreeData(() => {}); // hierarchyView is already listening
  hierarchyView.onDidChangeSelection((event) => {
    switch (event.selection.length) {
      case 0: {
        break;
      }
      case 1: {
        const selection = event.selection[0];
        if (!(selection instanceof EntityElement)) break;
        connections.updateFocus(new EntityFocus(selection.host, selection.id));
        break;
      }
      default: {
        // TODO
        break;
      }
    }
  });

  connections.onFocusChanged((focus) => {
    componentsView.updateAll(focus);
  });

  componentsView.onEntityChanges(([focus, list, changes]) => {
    const entity = connections.get(focus.host)?.getById(focus.entityId);
    if (entity === undefined) return; // expected when refresh hierarchy of entities

    // Name component removed
    if (!list.includes('bevy_ecs::name::Name') && entity.name !== undefined) {
      entity.name = undefined;
      hierarchyData.update(entity);
      return;
    }

    // Name component changed
    if (Object.keys(changes).includes('bevy_ecs::name::Name')) {
      entity.name = changes['bevy_ecs::name::Name'] as string;
      hierarchyData.update(entity);
      return;
    }
  });
}
