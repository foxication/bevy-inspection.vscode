import * as vscode from 'vscode';
import { createComponentsView } from './componentsView';
import { createHierarchyView, HierarchyDataProvider, EntityElement, HierarchyElement } from './hierarchyData';
import { ConnectionList, EntityFocus } from './connection-list';
import { Connection } from './connection';

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
    vscode.commands.registerCommand('extension.addConnection', () => connections.tryCreateConnection()),
    vscode.commands.registerCommand('extension.reconnectLast', () => connections.tryCreateConnection('last'))
  );

  // Extension only commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.reconnect', (connection: Connection) => connection.reconnect()),
    vscode.commands.registerCommand('extension.updateEntities', (element: HierarchyElement) =>
      element instanceof Connection
        ? element.requestEntityElements()
        : connections.get(element.host)?.requestEntityElements()
    ),
    vscode.commands.registerCommand('extension.disonnect', (connection: Connection) => connection.disconnect()),
    vscode.commands.registerCommand('extension.removeConnection', (connection: Connection) =>
      connections.removeConnection(connection.getHost())
    ),
    vscode.commands.registerCommand('extension.destroyEntity', (element: EntityElement) =>
      connections.get(element.host)?.requestDestroyOfEntity(element)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) =>
      connections.get(element.host)?.requestRenameOfEntity(element)
    )
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
      if (connection === undefined) return;
      hierarchyData.update(typeof destroyed.childOf === 'number' ? connection.getById(destroyed.childOf) : connection);
    });

    connection.onEntityRenamed((renamed) => {
      hierarchyData.update(renamed);
    });

    connection.onDisconnection((connection) => {
      hierarchyData.update(undefined);

      vscode.window.showInformationMessage('Bevy instance has been disconnected', 'Reconnect').then((reaction) => {
        if (reaction === 'Reconnect') {
          connections.tryCreateConnection('last');
        }
      });
      if (connections.focus?.host === connection.getHost()) {
        componentsView.description = 'Disconnected';
        connections.stopWatch();
      }
    });

    connection.onReconnection(() => {
      hierarchyData.update(undefined);
      if (connections.focus?.host === connection.getHost()) {
        componentsView.description = undefined;
      }
    });
  });
  connections.onAddError(() => {
    vscode.window.showErrorMessage('Bevy instance refused to connect');
  });
  connections.onRemoved(() => {
    areThereConnections(connections.all().length > 0);
    hierarchyData.update(undefined);
  });
  connections.onGetWatchResult((getWatchResult) => {
    componentsView.updateComponents(getWatchResult.components, getWatchResult.removed);
  });

  hierarchyData.onDidChangeTreeData(() => {}); // hierarchyView is already listening
  hierarchyView.onDidChangeSelection((event) => {
    switch (event.selection.length) {
      // case 0: {
      //   connections.updateFocus(null);
      //   componentsView.title = undefined;
      //   break;
      // }
      case 1: {
        const selection = event.selection[0];
        if (!(selection instanceof EntityElement)) {
          break;
        }
        if (connections.get(selection.host)?.getNetworkStatus() !== 'online') {
          break;
        }
        connections.updateFocus(new EntityFocus(selection.host, selection.id));
        componentsView.title = 'Components of ' + (selection.name ?? selection.id);
        componentsView.description = undefined;
        break;
      }
    }
  });

  connections.onFocusChanged((focus) => {
    componentsView.updateAll();
    if (focus !== null) connections.startWatch(focus);
  });
}
