import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { SessionManager } from './session-manager';

export function activate(context: vscode.ExtensionContext) {
  const manager = new SessionManager();

  // register all commands
  context.subscriptions.push(vscode.commands.registerCommand('extension.debugLog', () => debugLog()));
  context.subscriptions.push(vscode.commands.registerCommand('extension.connect', () => manager.try_connect()));
}

async function debugLog() {
  const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
  console.log('COMPONENTS:');
  console.log((await protocol.list())?.result);
}
