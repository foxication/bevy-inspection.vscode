import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { createComponentsView } from './componentsView';
import {
  ConnectionElement,
  createHierarchyView as createHierarchyView,
  HierarchyDataProvider,
  EntityElement,
} from './hierarchyData';
import { ConnectionList, EntityFocus } from './connection-list';
import { ComponentsDataProvider } from './componentsData';

// Context
function areThereConnections(value: boolean) {
  vscode.commands.executeCommand('setContext', 'extension.areThereConnections', value);
}

async function debugLog() {
  const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
  console.log('COMPONENTS:');
  console.log((await protocol.list())?.result);
}

export function activate(context: vscode.ExtensionContext) {
  // Context
  areThereConnections(false);

  // Views
  const connections = new ConnectionList();
  const hierarchyData = new HierarchyDataProvider(connections);
  const hierarchyView = createHierarchyView(hierarchyData);
  const componentsData = new ComponentsDataProvider(connections);
  const componentsView = createComponentsView(context, componentsData);

  // Userspace commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.debugLog', () => debugLog()),
    vscode.commands.registerCommand('extension.addConnection', () => connections.tryCreateConnection()),
    vscode.commands.registerCommand('extension.reconnectLast', () => connections.tryCreateConnection('last'))
  );

  // Extension only commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.reconnect', (element: ConnectionElement) =>
      connections.get(element.host)?.reconnect()
    ),
    vscode.commands.registerCommand('extension.updateEntities', (element: ConnectionElement | EntityElement) =>
      connections.get(element.host)?.requestEntityElements()
    ),
    vscode.commands.registerCommand('extension.disonnect', (element: ConnectionElement) =>
      connections.get(element.host)?.disconnect()
    ),
    vscode.commands.registerCommand('extension.removeConnection', (element: ConnectionElement) =>
      connections.removeConnection(element.host)
    ),
    vscode.commands.registerCommand('extension.destroyEntity', (element: EntityElement) =>
      connections.get(element.host)?.requestDestroyOfEntity(element)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) =>
      connections.get(element.host)?.requestRenameOfEntity(element)
    )
  );

  // Events sorted by call order
  connections.onConnectionAdded((connection) => {
    // Update views
    hierarchyView.description = undefined;
    hierarchyData.updateConnections();

    // Set context
    areThereConnections(true);

    // Connect all events
    connection.onHierarchyUpdated((connection) => {
      hierarchyData.updateInConnection(connection.getProtocol().url.host);
    });

    connection.onEntityDestroyed((destroyed) => {
      if (destroyed.childOf === undefined) {
        return;
      }
      const scope = connections.get(destroyed.host)?.getById(destroyed.childOf);
      if (scope === undefined) {
        return;
      }
      hierarchyData.updateInScope(scope);
    });

    connection.onEntityRenamed((renamed) => {
      if (renamed.childOf === undefined) {
        return;
      }
      const scope = connections.get(renamed.host)?.getById(renamed.childOf);
      if (scope === undefined) {
        return;
      }
      hierarchyData.updateInScope(scope);
    });

    connection.onDisconnection((connection) => {
      hierarchyData.updateConnections();

      if (connection.isInitialized) {
        vscode.window.showInformationMessage('Bevy instance has been disconnected', 'Reconnect').then((reaction) => {
          if (reaction === 'Reconnect') {
            connections.tryCreateConnection('last');
          }
        });
        if (connections.focus?.host === connection.getProtocol().url.host) {
          componentsView.description = 'Disconnected';
        }
      } else {
        vscode.window.showInformationMessage('Bevy instance refused to connect');
      }
    });

    connection.onReconnection(() => {
      hierarchyData.updateConnections();
      if (connections.focus?.host === connection.getProtocol().url.host) {
        componentsView.description = undefined;
      }
    });
  });
  connections.onConnectionRemoved(() => {
    areThereConnections(connections.all().length > 0);
    hierarchyData.updateConnections();
  });

  hierarchyData.onDidChangeTreeData(() => {}); // hierarchyView is already listening
  hierarchyView.onDidChangeSelection((event) => {
    switch (event.selection.length) {
      case 0: {
        connections.updateFocus(null);
        componentsView.title = undefined;
        break;
      }
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

  connections.onFocusChanged(() => componentsData.update());
  componentsData.onDidChangeTreeData(() => componentsView.update());
}
