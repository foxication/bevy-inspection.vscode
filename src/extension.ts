import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { ComponentsProvider, createComponentsView } from './components';
import { createEntitiesView, EntitiesProvider, EntityElement } from './entities';
import { ClientCollection } from './client-collection';

class Extension {
  // Clients
  static clientCollection = new ClientCollection();

  // Entities
  static entitiesProvider = new EntitiesProvider();
  static entitiesView = createEntitiesView(Extension.entitiesProvider);

  // Components
  static componentsProvider = new ComponentsProvider();
  static componentsView = createComponentsView(Extension.componentsProvider);

  // Context
  static setIsSessionAlive(value: boolean) {
    vscode.commands.executeCommand('setContext', 'extension.isSessionAlive', value);
  }
  static setAreViewsVisible(value: boolean) {
    vscode.commands.executeCommand('setContext', 'extension.areViewsVisible', value);
  }
}

export function getClientCollection() {
  return Extension.clientCollection;
}

async function debugLog() {
  const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
  console.log('COMPONENTS:');
  console.log((await protocol.list())?.result);
}

export function activate(context: vscode.ExtensionContext) {
  // Context
  Extension.setAreViewsVisible(false);
  Extension.setIsSessionAlive(false);

  // Userspace commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.debugLog', () => debugLog()),
    vscode.commands.registerCommand('extension.connect', () => Extension.clientCollection.tryCreateSession()),
    vscode.commands.registerCommand('extension.reconnect', () => Extension.clientCollection.tryCreateSession('last')),
    vscode.commands.registerCommand('extension.disconnect', () => Extension.clientCollection.current()?.death()),
    vscode.commands.registerCommand('extension.refreshEntities', () => Extension.entitiesProvider.update(null))
  );

  // Extension only commands
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.destroyEntity', (element: EntityElement) =>
      Extension.clientCollection.current()?.destroyEntity(element)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (element: EntityElement) =>
      Extension.clientCollection.current()?.renameEntity(element)
    )
  );

  // Events
  Extension.componentsProvider.onDidChangeTreeData(() => {
    if (Extension.entitiesView.selection.length === 1) {
      return;
    }
    const selectedEntity = Extension.entitiesView.selection[0];

    // Update title
    Extension.componentsView.title = 'Components of ' + (selectedEntity.name ?? 'Entity');

    // Update message
    if (selectedEntity instanceof EntityElement) {
      Extension.componentsView.message = 'ID: ' + selectedEntity.id;
    } else {
      Extension.componentsView.message = undefined;
    }
  });

  Extension.entitiesProvider.onDidChangeTreeData(() => {
    Extension.entitiesView.message = Extension.clientCollection.current()?.getSessionInfo();
  });

  Extension.entitiesView.onDidChangeSelection((event) => {
    if (event.selection.length === 0) {
      Extension.componentsProvider.update(null);
    }
    if (event.selection.length === 1) {
      Extension.componentsProvider.update(event.selection[0]);
    }
  });

  Extension.clientCollection.onClientAdded((client) => {
    // Update views
    Extension.entitiesView.description = undefined;
    Extension.componentsView.description = undefined;
    Extension.entitiesProvider.update(null);
    Extension.componentsProvider.update(null);

    // Set context
    Extension.setIsSessionAlive(true);
    Extension.setAreViewsVisible(true);

    // Connect all events
    client.onUserAskedForReconnection(() => {
      Extension.clientCollection.tryCreateSession('last');
    });

    client.onEntityDestroyed((destroyed) => {
      Extension.entitiesProvider.update({ parentId: destroyed.childOf, skipQuery: true });
    });

    client.onEntityRenamed((renamed) => {
      Extension.entitiesProvider.update({ parentId: renamed.childOf, skipQuery: true });
    });

    client.onDeath(() => {
      Extension.setIsSessionAlive(false);
      Extension.entitiesView.description = 'Disconnected';
      Extension.componentsView.description = 'Disconnected';
    });
  });
}
