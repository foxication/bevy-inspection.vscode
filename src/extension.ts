import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { ComponentsProvider, createComponentsView } from './components';
import { createEntitiesView, EntitiesProvider, EntityElement } from './entities';
import { ClientCollection } from './client-collection';

export class Extension {
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

export class Context {}

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
