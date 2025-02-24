import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { ComponentsProvider, createComponentsView } from './components';
import { createEntitiesView, EntitiesProvider, EntityElement } from './entities';
import { SessionManager } from './session';

export class Extension {
  static sessionManager = new SessionManager();

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

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.debugLog', () => debugLog()),
    vscode.commands.registerCommand('extension.connect', () => Extension.sessionManager.tryCreateSession()),
    vscode.commands.registerCommand('extension.reconnect', () => Extension.sessionManager.tryCreateSession('last')),
    vscode.commands.registerCommand('extension.disconnect', () => Extension.sessionManager.current()?.disconnect()),
    vscode.commands.registerCommand('extension.refreshEntities', () => Extension.entitiesProvider.update(null)),
    vscode.commands.registerCommand('extension.destroyEntity', (ent: EntityElement) =>
      Extension.sessionManager.current()?.destroyEntity(ent)
    ),
    vscode.commands.registerCommand('extension.renameEntity', (ent: EntityElement) =>
      Extension.sessionManager.current()?.renameEntity(ent)
    )
  );
}
