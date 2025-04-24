import * as vscode from 'vscode';
import { ConnectionList, EntityFocus } from './connection-list';
import { VSCodeMessage, WebviewMessage } from './web-components';
import { BrpObject, TypePath } from './protocol';

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
  public async updateAll(focus: EntityFocus): Promise<void> {
    if (this.view === undefined) return vscode.commands.executeCommand('componentsView.focus');
    const connection = this.connections.get(focus.host);
    if (connection === undefined) {
      return console.error(`ComponentsViewProvider.updateAll(): no connection`);
    }

    await connection.requestInspectionElements(focus.entityId);
    const entityData = connection.getInspectionElements();
    const errorData = connection.getInspectionErrors();
    this.postVSCodeMessage({ cmd: 'update_all', focus, components: entityData, errors: errorData });
  }

  private changesToApply = 0;
  private changesInProcess = 0;
  private bufferOfChanges: {
    [hash: string]: {
      focus: EntityFocus;
      components: BrpObject;
      removed: TypePath[];
    };
  } = {};
  public updateComponentsLazy(focus: EntityFocus, components: BrpObject, removed: TypePath[]) {
    const hash = `${focus.host}@${focus.entityId}`;
    const access = this.bufferOfChanges[hash] ?? {
      focus: focus,
      components: {},
      removed: [],
    };
    for (const key of Object.keys(components)) {
      access.components[key] = components[key];
      const found = access.removed.indexOf(key);
      access.removed.splice(found, found === -1 ? 0 : 1); // component is not removed anymore
    }
    access.removed = [...new Set([...access.removed, ...removed])];
    access.removed.forEach((key) => delete access.components[key]); // component doesn't exist anymore
    this.bufferOfChanges[hash] = access;
    this.changesToApply += 1;

    if (this.changesInProcess === 0) {
      this.changesInProcess = this.changesToApply;
      this.changesToApply = 0;
      Object.values(this.bufferOfChanges).forEach((v) =>
        this.updateComponents(v.focus, v.components, v.removed)
      );
      this.bufferOfChanges = {};
      setTimeout(() => (this.changesInProcess = 0), 200);
    }
  }

  private updateComponents(focus: EntityFocus, components: BrpObject, removed: TypePath[]) {
    if (this.view === undefined) {
      return console.error(`ComponentsViewProvider.updateComponents(): no view`);
    }
    this.postVSCodeMessage({ cmd: 'update_components', focus, components, removed });
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
          this.connections.startComponentWatch(message.focus, message.components);
          break;
      }
    });
    this.view = webviewView;
    webviewView.onDidDispose(() => (this.view = undefined));
    if (this.connections.focus !== null) this.updateAll(this.connections.focus);
  }

  private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
    const htmlUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'web-components', 'index.html')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'web-components', 'index.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-components.js')
    );
    const elementsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'node_modules',
        '@vscode-elements',
        'elements',
        'dist',
        'bundled.js'
      )
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css'
      )
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
