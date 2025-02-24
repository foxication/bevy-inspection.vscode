import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { ComponentsProvider, createComponentsView } from './components';
import { createEntitiesView, EntitiesProvider, EntityElement } from './entities';
import { ClientCollection } from './client-collection';

// Context
function setIsSessionAlive(value: boolean) {
  vscode.commands.executeCommand('setContext', 'extension.isSessionAlive', value);
}
function setAreViewsVisible(value: boolean) {
  vscode.commands.executeCommand('setContext', 'extension.areViewsVisible', value);
}

async function debugLog() {
  const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
  console.log('COMPONENTS:');
  console.log((await protocol.list())?.result);
}

export function activate(context: vscode.ExtensionContext) {
  // Context
  setAreViewsVisible(false);
  setIsSessionAlive(false);

  // Extension parts
  // Clients
  const clientCollection = new ClientCollection();

  // Entities
  const entitiesProvider = new EntitiesProvider(clientCollection);
  const entitiesView = createEntitiesView(entitiesProvider);

  // Components
  const componentsProvider = new ComponentsProvider(clientCollection);
  const componentsView = createComponentsView(componentsProvider);

  // Userspace commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.debugLog', () => debugLog()),
    vscode.commands.registerCommand('extension.connect', () => clientCollection.tryCreateSession()),
    vscode.commands.registerCommand('extension.reconnect', () => clientCollection.tryCreateSession('last')),
    vscode.commands.registerCommand('extension.disconnect', () => clientCollection.current()?.death()),
    vscode.commands.registerCommand('extension.refreshEntities', () => entitiesProvider.update(null))
  );

  // Extension only commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.destroyEntity', (element: EntityElement) =>
      clientCollection.current()?.destroyEntity(element)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) =>
      clientCollection.current()?.renameEntity(element)
    )
  );

  // Events
  componentsProvider.onDidChangeTreeData(() => {
    if (entitiesView.selection.length === 1) {
      const selectedEntity = entitiesView.selection[0];
      componentsView.title = 'Components of ' + (selectedEntity.name ?? 'Entity');
      componentsView.message = 'ID: ' + selectedEntity.id;
    }
    if (entitiesView.selection.length === 0) {
      componentsView.title = 'Components';
      componentsView.message = undefined;
    }
  });

  entitiesProvider.onDidChangeTreeData(() => {
    entitiesView.message = clientCollection.current()?.getSessionInfo();
  });

  entitiesView.onDidChangeSelection((event) => {
    if (event.selection.length === 0) {
      componentsProvider.update(null);
    }
    if (event.selection.length === 1) {
      componentsProvider.update(event.selection[0]);
    }
  });

  clientCollection.onClientAdded((client) => {
    // Update views
    entitiesView.description = undefined;
    componentsView.description = undefined;
    entitiesProvider.update(null);
    componentsProvider.update(null);

    // Set context
    setIsSessionAlive(true);
    setAreViewsVisible(true);

    // Connect all events
    client.onUserAskedForReconnection(() => {
      clientCollection.tryCreateSession('last');
    });

    client.onEntityDestroyed((destroyed) => {
      entitiesProvider.update({ parentId: destroyed.childOf, skipQuery: true });
    });

    client.onEntityRenamed((renamed) => {
      entitiesProvider.update({ parentId: renamed.childOf, skipQuery: true });
    });

    client.onDeath(() => {
      setIsSessionAlive(false);
      entitiesView.description = 'Disconnected';
      componentsView.description = 'Disconnected';
    });
  });
}
