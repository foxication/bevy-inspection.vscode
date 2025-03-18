import * as vscode from 'vscode';
import { ConnectionList } from './connection-list';

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

  // Called on componentsData.onDidChangeTreeData
  public async update() {
    if (this.view === undefined) {
      return;
    }
    this.view.webview.postMessage({
      cmd: 'set_entity_info',
      host: this.connections.focus?.host ?? 'unknown',
      entityId: this.connections.focus?.entityId ?? 'unknown',
    });

    if (this.connections.focus === null) return;
    const connection = this.connections.get(this.connections.focus.host);
    if (connection === undefined) return;

    await connection.requestInspectionElements(this.connections.focus);
    const entityData = connection.getInspectionElementsSimple();
    if (entityData !== undefined) this.view.webview.postMessage({ cmd: 'update', data: entityData });
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: vscode.WebviewViewResolveContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: vscode.CancellationToken
  ) {
    this.view = webviewView;
    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    this.view.webview.html = await this.getHtmlForWebview();
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'doNothing': {
          break;
        }
      }
    });
  }

  private async getHtmlForWebview(): Promise<string> {
    if (this.view === undefined) {
      return '';
    }
    const webview = this.view.webview;
    const htmlUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'web', 'components.html'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'web', 'components.css'));
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
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
