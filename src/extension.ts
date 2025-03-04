import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { createComponentsView } from './componentsView';
import {
  ClientElement,
  createHierarchyView as createHierarchyView,
  HierarchyDataProvider,
  EntityElement,
} from './hierarchyData';
import { ClientList } from './client-list';
import { ComponentsDataProvider, CurrentEntityFocus as EntityFocus } from './componentsData';

// Context
function areThereClients(value: boolean) {
  vscode.commands.executeCommand('setContext', 'extension.areThereClients', value);
}

async function debugLog() {
  const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
  console.log('COMPONENTS:');
  console.log((await protocol.list())?.result);
}

export function activate(context: vscode.ExtensionContext) {
  // Context
  areThereClients(false);

  // Views
  const clients = new ClientList();
  const hierarchyData = new HierarchyDataProvider(clients);
  const hierarchyView = createHierarchyView(hierarchyData);
  const componentsData = new ComponentsDataProvider(clients);
  const componentsView = createComponentsView(context, componentsData);

  // Userspace commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.debugLog', () => debugLog()),
    vscode.commands.registerCommand('extension.addClient', () => clients.tryCreateClient()),
    vscode.commands.registerCommand('extension.reviveLastClient', () => clients.tryCreateClient('last'))
  );

  // Extension only commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.reviveClient', (element: ClientElement) =>
      clients.get(element.host)?.revive()
    ),
    vscode.commands.registerCommand('extension.updateEntities', (element: ClientElement | EntityElement) =>
      clients.get(element.host)?.updateEntityElements()
    ),
    vscode.commands.registerCommand('extension.stopClient', (element: ClientElement) =>
      clients.get(element.host)?.death()
    ),
    vscode.commands.registerCommand('extension.forgotClient', (element: ClientElement) =>
      clients.removeClient(element.host)
    ),
    vscode.commands.registerCommand('extension.destroyEntity', (element: EntityElement) =>
      clients.get(element.host)?.destroyEntity(element)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) =>
      clients.get(element.host)?.renameEntity(element)
    )
  );

  hierarchyData.onDidChangeTreeData(() => {});

  hierarchyView.onDidChangeSelection((event) => {
    switch (event.selection.length) {
      case 0: {
        componentsData.update(null);
        componentsView.title = undefined;
        break;
      }
      case 1: {
        const selection = event.selection[0];
        if (!(selection instanceof EntityElement)) {
          break;
        }
        if (clients.get(selection.host)?.getNetworkStatus() !== 'online') {
          break;
        }
        componentsData.update(new EntityFocus(selection.host, selection.id));
        componentsView.title = 'Components of ' + (selection.name ?? selection.id);
        componentsView.description = undefined;
        break;
      }
    }
  });

  clients.onClientAdded((client) => {
    // Update views
    hierarchyView.description = undefined;
    hierarchyData.updateClients();

    // Set context
    areThereClients(true);

    // Connect all events
    client.onHierarchyUpdated((client) => {
      hierarchyData.updateInClient(client.getProtocol().url.host);
    });

    client.onEntityDestroyed((destroyed) => {
      if (destroyed.childOf === undefined) {
        return;
      }
      const scope = clients.get(destroyed.host)?.getById(destroyed.childOf);
      if (scope === undefined) {
        return;
      }
      hierarchyData.updateInScope(scope);
    });

    client.onEntityRenamed((renamed) => {
      if (renamed.childOf === undefined) {
        return;
      }
      const scope = clients.get(renamed.host)?.getById(renamed.childOf);
      if (scope === undefined) {
        return;
      }
      hierarchyData.updateInScope(scope);
    });

    client.onDeath((client) => {
      hierarchyData.updateClients();

      if (client.isInitialized) {
        vscode.window.showInformationMessage('Bevy instance has been disconnected', 'Reconnect').then((reaction) => {
          if (reaction === 'Reconnect') {
            clients.tryCreateClient('last');
          }
        });
        if (componentsData.focus?.host === client.getProtocol().url.host) {
          componentsView.description = 'Disconnected';
        }
      } else {
        vscode.window.showInformationMessage('Bevy instance refused to connect');
      }
    });

    client.onRevive(() => {
      hierarchyData.updateClients();
      if (componentsData.focus?.host === client.getProtocol().url.host) {
        componentsView.description = undefined;
      }
    });
  });

  clients.onClientRemoved(() => {
    areThereClients(clients.all().length > 0);
    hierarchyData.updateClients();
  });
}
