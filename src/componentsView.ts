import * as vscode from 'vscode';
import { ConnectionList } from './connection-list';
import { BrpObject, BrpValue, TypePath } from './protocol/types';
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

  constructor(extensionUri: vscode.Uri, connections: ConnectionList) {
    this.connections = connections;
    this.extensionUri = extensionUri;
  }

  set description(text: string | undefined) {
    if (this.view !== undefined) {
      this.view.description = text;
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
    // console.log(`SENDING FOCUS: ${focus.compare(focus.clone())}`);
    this.postVSCodeMessage({
      cmd: 'update_all',
      focus: focus.toObject(),
      components: entityData,
      errors: errorData,
    });
  }

  private changesToApply = 0;
  private changesInProcess = 0;
  private focusOfChanges: EntityFocus | undefined;
  private componentChanges: Map<TypePath, BrpValue | undefined> = new Map();
  public updateComponentsLazy(
    focus: EntityFocus,
    components: BrpObject,
    removed: TypePath[]
  ) {
    if (this.focusOfChanges === undefined || !this.focusOfChanges.compare(focus)) {
      this.focusOfChanges = focus;
      this.componentChanges = new Map();
    }
    for (const [key, value] of Object.entries(components)) this.componentChanges.set(key, value);
    for (const key of removed) this.componentChanges.set(key, undefined);
    this.changesToApply += 1;

    if (this.changesInProcess === 0 && this.changesToApply > 0) {
      this.changesInProcess = this.changesToApply;
      this.changesToApply = 0;
      if (this.focusOfChanges !== undefined) {
        const changes = Object.fromEntries(this.componentChanges.entries());
        function isComponent(
          item: [key: string, value: BrpValue | undefined]
        ): item is [key: string, value: BrpValue] {
          return item[1] !== undefined;
        }
        function isRemoved(
          item: [key: string, value: BrpValue | undefined]
        ): item is [key: string, value: undefined] {
          return item[1] === undefined;
        }
        this.updateComponents(
          this.focusOfChanges,
          Object.fromEntries(Object.entries(changes).filter((entry) => isComponent(entry))),
          Object.entries(changes)
            .filter((entry) => isRemoved(entry))
            .map((entry) => entry[0])
        );
      }
      this.componentChanges = new Map();
      setTimeout(() => (this.changesInProcess = 0), 100);
    }
  }

  private updateComponents(focus: EntityFocus, components: BrpObject, removed: TypePath[]) {
    if (this.view === undefined) {
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
    this.view = webviewView;
    webviewView.onDidDispose(() => (this.view = undefined));
    if (this.connections.focus !== null) this.updateAll(this.connections.focus);
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
