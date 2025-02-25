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

  // Extension
  const clientCollection = new ClientCollection();
  const entitiesProvider = new HierarchyProvider(clientCollection);
  const entitiesView = createEntitiesView(entitiesProvider);
  const componentsProvider = new ComponentsProvider(clientCollection);
  const componentsView = createComponentsView(componentsProvider);

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
    vscode.commands.registerCommand('extension.refreshWorld', (element: ClientElement) =>
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
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) => {
      const client = clientCollection.get(element.host);
      if (client === undefined) {
        return;
      }
      client.renameEntity(element);
    })
  );

  // Events
  componentsProvider.onDidChangeTreeData(() => {
    if (entitiesView.selection.length === 1) {
      const selectedElement = entitiesView.selection[0];
      if (selectedElement instanceof ClientElement) {
        componentsView.title = 'Components';
        componentsView.message = undefined;
      }
      if (selectedElement instanceof EntityElement) {
        componentsView.title = 'Components of ' + (selectedElement.name ?? 'Entity');
        componentsView.message = 'host:' + selectedElement.host + ' id: ' + selectedElement.id;
      }
    }
    if (entitiesView.selection.length === 0) {
      componentsView.title = 'Components';
      componentsView.message = undefined;
    }
  });

  entitiesProvider.onDidChangeTreeData(() => console.log('entitiesProvider emmits: TREEDATACHANGED'));

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
    componentsView.description = undefined;
    entitiesProvider.updateClients();

    // Set context
    areThereClients(true);

    // Connect all events
    client.onUserAskedForReconnection(() => {
      clientCollection.tryCreateClient('last');
    });

    client.onEntitiesUpdated((client) => {
      entitiesProvider.updateInClient(client.getProtocol().url.host);
    });

    client.onEntityDestroyed((destroyed) => {
      if (destroyed.childOf === undefined) {
        return;
      }
      const scope = clientCollection.get(destroyed.host)?.findElement(destroyed.childOf);
      if (scope === undefined) {
        return;
      }
      entitiesProvider.updateInScope(scope);
    });

    client.onEntityRenamed((renamed) => {
      if (renamed.childOf === undefined) {
        return;
      }
      const scope = clientCollection.get(renamed.host)?.findElement(renamed.childOf);
      if (scope === undefined) {
        return;
      }
      entitiesProvider.updateInScope(scope);
    });

    client.onDeath(() => {
      entitiesProvider.updateClients();
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
