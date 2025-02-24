import * as vscode from 'vscode';
import { BevyRemoteProtocol, EntityId, ServerVersion } from 'bevy-remote-protocol';
import { ComponentsProvider, createComponentsView } from './components';
import { createEntitiesView, EntitiesProvider, EntityElement } from './entities';
import { ClientCollection } from './client-collection';
import { ConnectionState } from './client';

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

export class ExtEvents {
  public static clientConnectionUpated(state: ConnectionState) {
    switch (state) {
      case 'alive':
        break;

      case 'dead':
        Extension.setIsSessionAlive(false);
        Extension.entitiesView.description = 'Disconnected';
        Extension.componentsView.description = 'Disconnected';
        return;
    }
  }

  public static userAskedForReconnection() {
    Extension.clientCollection.tryCreateSession('last');
  }

  public static entityIsDestroyed(parent: EntityId | undefined) {
    Extension.entitiesProvider.update({ parentId: parent, skipQuery: true });
  }

  public static entityIsRenamed(parent: EntityId | undefined) {
    Extension.entitiesProvider.update({ parentId: parent, skipQuery: true });
  }

  public static newClientAdded() {
    // Update views
    Extension.entitiesProvider.update(null);
    Extension.entitiesView.description = undefined;
    Extension.componentsProvider.update(null);
    Extension.componentsView.description = undefined;

    // Set context
    Extension.setIsSessionAlive(true);
    Extension.setAreViewsVisible(true);
  }

  public static userSelectedAnotherEntity(selected: EntityElement) {
    Extension.componentsProvider.update(selected);
  }

  public static entityViewUpdated() {
    Extension.entitiesView.message = Extension.clientCollection.current()?.getSessionInfo();
  }

  public static componentsViewUpdated(entity: EntityElement | null) {
    // Update title
    Extension.componentsView.title = 'Components of ' + (entity?.name ?? 'Entity');

    if (entity instanceof EntityElement) {
      Extension.componentsView.message = 'ID: ' + entity.id;
    } else {
      Extension.componentsView.message = undefined;
    }
  }
}

async function debugLog() {
  const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
  console.log('COMPONENTS:');
  console.log((await protocol.list())?.result);
}

export function activate(context: vscode.ExtensionContext) {
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
}
