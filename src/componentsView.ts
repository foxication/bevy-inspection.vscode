import * as vscode from 'vscode';
import { ConnectionList } from './connection-list';
import { VSCodeMessage, WebviewMessage } from './web-components';
import { BrpObject, TypePath } from './protocol';

export function createComponentsView(context: vscode.ExtensionContext, connections: ConnectionList) {
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

  constructor(extensionUri: vscode.Uri, connections: ConnectionList) {
    this.connections = connections;
    this.extensionUri = extensionUri;
  }

  set description(text: string | undefined) {
    if (this.view !== undefined) {
      this.view.description = text;
    }
  }

  set title(text: string | undefined) {
    if (this.view !== undefined) {
      this.view.title = text;
    }
  }

  private async postVSCodeMessage(message: VSCodeMessage) {
    if (this.view === undefined) return;
    await this.view.webview.postMessage(message);
  }

  public async syncRegistrySchema(host: string) {
    const available = this.connections.all().map((connection) => connection.getProtocol().url.host);
    const connection = this.connections.get(host);
    if (connection === undefined) return;
    return this.postVSCodeMessage({
      cmd: 'sync_registry_schema',
      available,
      host,
      data: connection.getRegistrySchema(),
    });
  }

  // Called on componentsData.onDidChangeTreeData
  public async updateAll() {
    if (this.view === undefined) {
      vscode.commands.executeCommand('componentsView.focus');
      return;
    }
    this.postVSCodeMessage({
      cmd: 'set_entity_info',
      host: this.connections.focus?.host ?? 'unknown',
      entityId: this.connections.focus?.entityId ?? 0,
    });

    if (this.connections.focus === null) return;
    const connection = this.connections.get(this.connections.focus.host);
    if (connection === undefined) return;

    await connection.requestInspectionElements(this.connections.focus.entityId);
    const entityData = connection.getInspectionElements();
    this.postVSCodeMessage({ cmd: 'update_all', host: this.connections.focus.host, data: entityData });
  }

  public updateComponents(components: BrpObject, removed: TypePath[]) {
    if (this.view === undefined) return;
    this.postVSCodeMessage({ cmd: 'update_components', components, removed });
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
    webviewView.webview.onDidReceiveMessage((message: WebviewMessage) => {
      console.log(`received message: ${message.cmd}`);
      switch (message.cmd) {
        case 'mutate_component': {
          const component = message.data.component;
          const path = message.data.path;
          const value = message.data.value;
          console.log(message.data);

          if (path !== '') return;
          if (this.connections.focus === null) return;
          const connection = this.connections.get(this.connections.focus.host);
          const protocol = connection?.getProtocol();
          if (protocol === undefined) return;

          const sending: BrpObject = {};
          sending[component] = value;
          console.log(sending);
          protocol.insert(this.connections.focus.entityId, sending);
          break;
        }
        case 'request_of_sync_registry_schema': {
          this.syncRegistrySchema(message.host);
        }
      }
    });
    this.view = webviewView;
    webviewView.onDidDispose(() => (this.view = undefined));
    if (this.connections.focus !== null) this.updateAll();
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const htmlUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'web-components', 'index.html'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'web-components', 'index.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-components.js'));
    const elementsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
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
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
