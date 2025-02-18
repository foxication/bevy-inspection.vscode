import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';

export function activate(context: vscode.ExtensionContext) {
  const command_list = vscode.commands.registerCommand('extension.bevyList', () => {
    const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
    const result = protocol.list();

    result
      .then((response) => {
        if (response.result) {
          vscode.window.showInformationMessage(response.result.toString());
          return;
        }
      })
      .catch((reason) => {
        if (reason instanceof TypeError) {
          vscode.window.showInformationMessage('No Bevy Instance found: Connection refused. (TypeError)');
          return;
        }
        vscode.window.showInformationMessage('Unknown Error.');
      });
  });

  context.subscriptions.push(command_list);
}
