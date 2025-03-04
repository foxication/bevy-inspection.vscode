import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { createComponentsView } from './componentsView';
import { ClientElement, createEntitiesView, HierarchyDataProvider, EntityElement } from './hierarchyData';
import { ClientCollection } from './client-collection';
import { ComponentsDataProvider, CurrentEntityFocus } from './componentsData';

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
  const entitiesData = new HierarchyDataProvider(clientCollection);
  const entitiesView = createEntitiesView(entitiesData);
  const componentsData = new ComponentsDataProvider(clientCollection);
  const componentsView = createComponentsView(context, componentsData);

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

  entitiesData.onDidChangeTreeData(() => {});

  entitiesView.onDidChangeSelection((event) => {
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
        if (clientCollection.get(selection.host)?.getState() !== 'alive') {
          break;
        }
        componentsData.update(new CurrentEntityFocus(selection.host, selection.id));
        componentsView.title = 'Components of ' + (selection.name ?? selection.id);
        componentsView.description = undefined;
        break;
      }
    }
  });

  clientCollection.onClientAdded((client) => {
    // Update views
    entitiesView.description = undefined;
    entitiesData.updateClients();

    // Set context
    areThereClients(true);

    // Connect all events
    client.onEntitiesUpdated((client) => {
      entitiesData.updateInClient(client.getProtocol().url.host);
    });

    client.onEntityDestroyed((destroyed) => {
      if (destroyed.childOf === undefined) {
        return;
      }
      const scope = clientCollection.get(destroyed.host)?.getById(destroyed.childOf);
      if (scope === undefined) {
        return;
      }
      entitiesData.updateInScope(scope);
    });

    client.onEntityRenamed((renamed) => {
      if (renamed.childOf === undefined) {
        return;
      }
      const scope = clientCollection.get(renamed.host)?.getById(renamed.childOf);
      if (scope === undefined) {
        return;
      }
      entitiesData.updateInScope(scope);
    });

    client.onDeath((client) => {
      entitiesData.updateClients();

      if (client.isInitialized) {
        vscode.window.showInformationMessage('Bevy instance has been disconnected', 'Reconnect').then((reaction) => {
          if (reaction === 'Reconnect') {
            clientCollection.tryCreateClient('last');
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
      entitiesData.updateClients();
      if (componentsData.focus?.host === client.getProtocol().url.host) {
        componentsView.description = undefined;
      }
    });
  });

  clientCollection.onClientRemoved(() => {
    areThereClients(clientCollection.all().length > 0);
    entitiesData.updateClients();
  });
}
