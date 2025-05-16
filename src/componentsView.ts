import * as vscode from 'vscode';
import { ConnectionList } from './connection-list';
import { BrpComponentRegistry, BrpResponseErrors, TypePath } from './protocol/types';
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
  private view?: vscode.WebviewView;

  private onEntityChangesEmitter = new vscode.EventEmitter<
    [EntityFocus, TypePath[], BrpComponentRegistry, BrpResponseErrors]
  >();
  readonly onEntityChanges = this.onEntityChangesEmitter.event;

  constructor(extensionUri: vscode.Uri, connections: ConnectionList) {
    this.connections = connections;
    this.extensionUri = extensionUri;
  }

  updateDescription(isOnline: boolean) {
    if (this.view !== undefined) {
      this.view.description = isOnline ? undefined : 'Disconnected';
    }
  }

  private async postVSCodeMessage(message: VSCodeMessage) {
    if (this.view === undefined) {
      return console.error(`ComponentsViewProvider.postVSCodeMessage: no view`);
    }
    await this.view.webview.postMessage(message);
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
    if (this.view === undefined) return vscode.commands.executeCommand('componentsView.focus');
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
        this.postVSCodeMessage({
          cmd: 'update_all',
          focus: focus.toObject(),
        });
        break;
      }
    }
  }

  updateAllAsOffline(focus: EntityFocus) {
    if (this.view === undefined) {
      return console.error(`ComponentsViewProvider.updateComponents(): no view`);
    }
    this.postVSCodeMessage({
      cmd: 'update_all_offline',
      focus: focus.toObject(),
    });
  }

  private watchBuffer: {
    focus: EntityFocus | undefined;
    changes: BrpComponentRegistry;
    exceptions: TypePath[];
  } = {
    focus: undefined,
    changes: {},
    exceptions: [],
  };
  async updateComponents(focus: EntityFocus) {
    if (this.view === undefined) {
      return console.error(`ComponentsViewProvider.updateComponents(): no view`);
    }

    // Reset buffer if focus changed
    if (this.watchBuffer.focus === undefined || !this.watchBuffer.focus.compare(focus)) {
      this.watchBuffer = { focus: focus, changes: {}, exceptions: [] };
    }

    const connection = this.connections.get(focus.host);
    if (connection === undefined) return console.error(`connection ${focus.host} is not found`);

    // Get component list
    const listResponse = await connection.getProtocol().list(focus.entityId);
    if (!connection.isCorrectResponseOrDisconnect(listResponse)) return;

    // Get result
    let whiteList = listResponse.result.filter((c) => !this.watchBuffer.exceptions.includes(c));
    const getResponse = await connection.getProtocol().get(focus.entityId, whiteList);
    if (!connection.isCorrectResponseOrDisconnect(getResponse)) return;

    // Update exceptions and whitelist
    this.watchBuffer.exceptions.push(...Object.keys(getResponse.result.errors));
    whiteList = whiteList.filter((c) => !this.watchBuffer.exceptions.includes(c));

    // Filter out changes only (first iteration will send all components)
    const bufferKeys = Object.keys(this.watchBuffer.changes);
    const componentChanges = Object.fromEntries(
      Object.entries(getResponse.result.components).filter(([key, value]) => {
        if (!bufferKeys.includes(key)) return true;
        if (JSON.stringify(value) !== JSON.stringify(this.watchBuffer.changes[key])) return true;
        return false;
      })
    );
    this.watchBuffer.changes = getResponse.result.components;

    // Send
    this.postVSCodeMessage({
      cmd: 'update_components',
      focus: focus.toObject(),
      list: whiteList,
      changes: componentChanges,
      errors: getResponse.result.errors,
    });

    // Signal
    this.onEntityChangesEmitter.fire([
      focus,
      whiteList,
      componentChanges,
      getResponse.result.errors,
    ]);
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
        case 'request_for_component_changes': {
          const connection = this.connections.get(message.focus.host);
          if (connection === undefined || connection.getNetworkStatus() === 'offline') break;
          this.updateComponents(EntityFocus.fromObject(message.focus));
          break;
        }
        case 'write_clipboard':
          vscode.env.clipboard.writeText(message.text);
          break;
      }
    });
    this.view = webviewView;
    webviewView.onDidDispose(() => {
      this.view = undefined;
    });
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

  copyValueToClipboard(path: string) {
    this.postVSCodeMessage({ cmd: 'copy_value_to_clipboard', path });
  }
  copyDetailsToClipboard(details: string) {
    this.postVSCodeMessage({ cmd: 'copy_details_to_clipboard', details });
  }
  copyErrorToClipboard(component: string) {
    this.postVSCodeMessage({ cmd: 'copy_error_message_to_clipboard', component });
  }
  manualUpdate() {
    this.postVSCodeMessage({ cmd: 'manual_update' });
  }
  async liveUpdate() {
    this.postVSCodeMessage({ cmd: 'live_update' });
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
