// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "helloworld-sample" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
    // The code you place here will be executed every time your command is executed

    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World!');
  });

  const disposable_alt = vscode.commands.registerCommand('extension.bevyList', () => {
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

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable_alt);
}
