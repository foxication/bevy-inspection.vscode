import * as vscode from 'vscode';
import { EntityId, TypePath } from 'bevy-remote-protocol';
import { ClientCollection } from './client-collection';

export function createComponentsView(componentsProvider: ComponentsProvider) {
  return vscode.window.registerWebviewViewProvider('componentsView', componentsProvider, {
    webviewOptions: { retainContextWhenHidden: true },
  });
}

type Value = boolean | number | string;

export class ComponentElement {
  typePath: TypePath;
  children: (NamedValueElement | ValueElement)[];

  constructor(name: string, children: typeof this.children) {
    this.typePath = name;
    this.children = children;
  }
}

export class ComponentErrorElement {
  typePath: TypePath;
  children: (NamedValueElement | ValueElement)[];

  constructor(name: string, children: typeof this.children) {
    this.typePath = name;
    this.children = children;
  }
}

export class ValueElement {
  value: Value;

  constructor(value: Value) {
    this.value = value;
  }
}

export class NamedValueElement {
  name: string;
  children: (NamedValueElement | ValueElement)[];
  value?: Value;

  constructor(name: string, children: typeof this.children, value?: Value) {
    this.name = name;
    this.children = children;
    this.value = value;
  }
}

export class InspectionFocus {
  host: string;
  entityId: EntityId;

  constructor(host: string, entityId: EntityId) {
    this.host = host;
    this.entityId = entityId;
  }
}

export type InspectionElement = ComponentElement | ComponentErrorElement | ValueElement | NamedValueElement;

export class ComponentsProvider implements vscode.WebviewViewProvider {
  private collection: ClientCollection;
  private extensionUri: vscode.Uri;
  private view?: vscode.WebviewView;
  private focus?: InspectionFocus;

  constructor(extensionUri: vscode.Uri, collection: ClientCollection) {
    this.collection = collection;
    this.extensionUri = extensionUri;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
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
          console.log(data.log);
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
    const htmlUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'web', 'components.html'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'web', 'components.css'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'web', 'components.js'));
    const elementsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js')
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    const result = (await vscode.workspace.openTextDocument(htmlUri.fsPath))
      .getText()
      .replace(new RegExp('%csp-source%', 'g'), webview.cspSource)
      .replace(new RegExp('%script%', 'g'), scriptUri.toString())
      .replace(new RegExp('%elements%', 'g'), elementsUri.toString())
      .replace(new RegExp('%codicons%', 'g'), codiconsUri.toString())
      .replace(new RegExp('%style%', 'g'), styleUri.toString())
      .replace(new RegExp('%nonce-alt%', 'g'), getNonce())
      .replace(new RegExp('%nonce%', 'g'), getNonce());

    console.log(result);
    return result;
  }

  public update(focused: InspectionFocus | null) {
    if (this.view === undefined) {
      return;
    }

    // Scenario: empty focus
    if (focused === null) {
      this.view.title = 'Components';
      // TODO: clear
      return;
    }

    // Scenario: client is removed
    const client = this.collection.get(focused.host);
    if (client === undefined) {
      // TODO: clear
      return;
    }

    // Error
    const entity = client.getById(focused.entityId);
    if (client.getState() === 'dead' || entity === undefined) {
      return;
    }

    // Scenario: focus on entity
    this.focus = structuredClone(focused);
    this.view.show(true);
    this.view.title = 'Components' + (entity.name ? ' of ' + entity.name : '');
  }

  public setDescription(description?: string) {
    if (this.view !== undefined) {
      this.view.description = description;
    }
  }

  public updateEntityInfo(entity: { name: string; id: EntityId } | null) {
    if (entity === null) {
      return;
    }
    if (this.view !== undefined) {
      this.view.title = 'Components of ' + entity.name;
    }
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
