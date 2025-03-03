import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { ComponentsProvider, createComponentsView, InspectionFocus } from './components';
import { ClientElement, createEntitiesView, HierarchyProvider, EntityElement } from './hierarchy';
import { ClientCollection } from './client-collection';

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
  const clientCollection = new ClientCollection();
  const entitiesProvider = new HierarchyProvider(clientCollection);
  const entitiesView = createEntitiesView(entitiesProvider);
  const componentsProvider = new ComponentsProvider(context.extensionUri, clientCollection);
  context.subscriptions.push(createComponentsView(componentsProvider));

  // Userspace commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.debugLog', () => debugLog()),
    vscode.commands.registerCommand('extension.addClient', () => clientCollection.tryCreateClient()),
    vscode.commands.registerCommand('extension.reviveLastClient', () => clientCollection.tryCreateClient('last'))
  );

  // Extension only commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.reviveClient', (element: ClientElement) =>
      clientCollection.get(element.host)?.revive()
    ),
    vscode.commands.registerCommand('extension.refreshWorld', (element: ClientElement | EntityElement) =>
      clientCollection.get(element.host)?.updateEntitiesElements()
    ),
    vscode.commands.registerCommand('extension.killClient', (element: ClientElement) =>
      clientCollection.get(element.host)?.death()
    ),
    vscode.commands.registerCommand('extension.forgotClient', (element: ClientElement) =>
      clientCollection.removeClient(element.host)
    ),
    vscode.commands.registerCommand('extension.destroyEntity', (element: EntityElement) =>
      clientCollection.get(element.host)?.destroyEntity(element)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) =>
      clientCollection.get(element.host)?.renameEntity(element)
    )
  );

  entitiesProvider.onDidChangeTreeData(() => {});

  entitiesView.onDidChangeSelection((event) => {
    if (event.selection.length === 0) {
      componentsProvider.update(null);
    }
    if (event.selection.length === 1) {
      const selection = event.selection[0];
      // ClientElement is skipped!
      if (selection instanceof EntityElement) {
        componentsProvider.update(new InspectionFocus(selection.host, selection.id));
      }
    }
  });

  clientCollection.onClientAdded((client) => {
    // Update views
    entitiesView.description = undefined;
    componentsProvider.setDescription(undefined);
    entitiesProvider.updateClients();

    // Set context
    areThereClients(true);

    // Connect all events
    client.onEntitiesUpdated((client) => {
      entitiesProvider.updateInClient(client.getProtocol().url.host);
    });

    client.onEntityDestroyed((destroyed) => {
      if (destroyed.childOf === undefined) {
        return;
      }
      const scope = clientCollection.get(destroyed.host)?.getById(destroyed.childOf);
      if (scope === undefined) {
        return;
      }
      entitiesProvider.updateInScope(scope);
    });

    client.onEntityRenamed((renamed) => {
      if (renamed.childOf === undefined) {
        return;
      }
      const scope = clientCollection.get(renamed.host)?.getById(renamed.childOf);
      if (scope === undefined) {
        return;
      }
      entitiesProvider.updateInScope(scope);
    });

    client.onDeath((client) => {
      entitiesProvider.updateClients();

      if (client.isInitialized) {
        vscode.window.showInformationMessage('Bevy instance has been disconnected', 'Reconnect').then((reaction) => {
          if (reaction === 'Reconnect') {
            clientCollection.tryCreateClient('last');
          }
        });
      } else {
        vscode.window.showInformationMessage('Bevy instance refused to connect');
      }
    });

    client.onRevive(() => {
      entitiesProvider.updateClients();
    });
  });

  clientCollection.onClientRemoved(() => {
    areThereClients(clientCollection.all().length > 0);
    entitiesProvider.updateClients();
  });
}
