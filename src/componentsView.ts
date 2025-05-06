import * as vscode from 'vscode';
import { ConnectionList } from './connection-list';
import { BrpObject, TypePath } from './protocol/types';
import { EntityFocus, VSCodeMessage, WebviewMessage } from './common';

export function createComponentsView(
  context: vscode.ExtensionContext,
  connections: ConnectionList
) {
  const componentsView = new ComponentsViewProvider(context.extensionUri, connections);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('componentsView', componentsView, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
  return componentsView;
}

export class ComponentsViewProvider implements vscode.WebviewViewProvider {
  private connections: ConnectionList;
  private extensionUri: vscode.Uri;
  private visible?: { view: vscode.WebviewView; focus?: EntityFocus };

  constructor(extensionUri: vscode.Uri, connections: ConnectionList) {
    this.connections = connections;
    this.extensionUri = extensionUri;
  }

  updateDescription(isOnline: boolean) {
    if (this.visible !== undefined) {
      this.visible.view.description = isOnline ? undefined : 'Disconnected';
    }
  }
  getFocus() {
    return this.visible?.focus;
  }

  private async postVSCodeMessage(message: VSCodeMessage) {
    if (this.visible === undefined) {
      return console.error(`ComponentsViewProvider.postVSCodeMessage: no view`);
    }
    await this.visible.view.webview.postMessage(message);
  }

  public async syncRegistrySchema(host: string) {
    const available = this.connections.all().map((connection) => connection.getProtocol().url.host);
    const connection = this.connections.get(host);
    if (connection === undefined) {
      return console.error(`ComponentsViewProvider.syncRegistrySchema: no connection`);
    }
    return this.postVSCodeMessage({
      cmd: 'sync_registry_schema',
      available,
      host,
      data: connection.getRegistrySchema(),
    });
  }

  // Called on componentsData.onDidChangeTreeData
  async updateAll(focus: EntityFocus): Promise<void> {
    if (this.visible === undefined) return vscode.commands.executeCommand('componentsView.focus');
    const connection = this.connections.get(focus.host);
    if (connection === undefined) {
      return console.error(`ComponentsViewProvider.updateAll(): no connection`);
    }

    switch (connection.getNetworkStatus()) {
      case 'offline': {
        this.updateDescription(false);
        this.postVSCodeMessage({
          cmd: 'update_all_offline',
          focus: focus.toObject(),
        });
        break;
      }
      case 'online': {
        this.updateDescription(true);
        await connection.requestInspectionElements(focus.entityId);
        const entityData = connection.getInspectionElements();
        const errorData = connection.getInspectionErrors();
        this.postVSCodeMessage({
          cmd: 'update_all',
          focus: focus.toObject(),
          components: entityData,
          errors: errorData,
        });
        break;
      }
    }
  }

  updateComponents(focus: EntityFocus, components: BrpObject, removed: TypePath[]) {
    if (this.visible === undefined) {
      return console.error(`ComponentsViewProvider.updateComponents(): no view`);
    }
    this.postVSCodeMessage({
      cmd: 'update_components',
      focus: focus.toObject(),
      components,
      removed,
    });
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    webviewView.webview.html = await this.getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: WebviewMessage): void => {
      switch (message.cmd) {
        case 'mutate_component': {
          // arguments
          const focus = message.data.focus;
          const component = message.data.component;
          const path = message.data.path;
          const value = message.data.value;
          const protocol = this.connections.get(focus.host)?.getProtocol();
          const e1 = `ComponentsViewProvider.mutate_component(): no such connection`;

          if (protocol === undefined) return console.error(e1);
          protocol.mutateComponent(focus.entityId, component, path, value);
          break;
        }
        case 'request_for_registry_schema': {
          this.syncRegistrySchema(message.host);
          break;
        }
        case 'ready_for_watch':
          this.connections.startComponentWatch(
            EntityFocus.fromObject(message.focus),
            message.components
          );
          break;
        case 'write_clipboard':
          vscode.env.clipboard.writeText(message.text);
          break;
      }
    });
    this.visible = { view: webviewView };
    webviewView.onDidDispose(() => (this.visible = undefined));
    if (this.connections.focus !== undefined) this.updateAll(this.connections.focus);
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const htmlUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'web', 'components.html')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'web', 'components.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-components.js')
    );
    const elementsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'vscode-elements.js')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'codicon.css')
    );

    const result = (await vscode.workspace.openTextDocument(htmlUri.fsPath))
      .getText()
      .replace(new RegExp('__csp_source__', 'g'), webview.cspSource)
      .replace(new RegExp('__script__', 'g'), scriptUri.toString())
      .replace(new RegExp('__elements__', 'g'), elementsUri.toString())
      .replace(new RegExp('__codicons__', 'g'), codiconsUri.toString())
      .replace(new RegExp('__style__', 'g'), styleUri.toString())
      .replace(new RegExp('__nonce__', 'g'), getNonce());

    return result;
  }

  public debugOutput() {
    this.postVSCodeMessage({ cmd: 'debug_output' });
  }

  public copyValueToClipboard(path: string) {
    this.postVSCodeMessage({ cmd: 'copy_value_to_clipboard', path });
  }
  public copyErrorToClipboard(component: string) {
    this.postVSCodeMessage({ cmd: 'copy_error_message_to_clipboard', component });
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
