import * as vscode from 'vscode';
import { ComponentElement, ComponentsDataProvider } from './componentsData';

export function createComponentsView(context: vscode.ExtensionContext, componentsProvider: ComponentsDataProvider) {
  const componentsView = new ComponentsViewProvider(context.extensionUri, componentsProvider);
  componentsProvider.onDidChangeTreeData((event) => componentsView.update(event));

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('componentsView', componentsView, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  return componentsView;
}

export class ComponentsViewProvider implements vscode.WebviewViewProvider {
  private data: ComponentsDataProvider;
  private extensionUri: vscode.Uri;
  private view?: vscode.WebviewView;

  constructor(extensionUri: vscode.Uri, data: ComponentsDataProvider) {
    data.onDidChangeTreeData(() => this.update());

    this.data = data;
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

  public update(event: void | ComponentElement | undefined) {
    if (event instanceof ComponentElement) {
      return;
    }
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
      .replace(new RegExp('__csp_source__', 'g'), webview.cspSource)
      .replace(new RegExp('__script__', 'g'), scriptUri.toString())
      .replace(new RegExp('__elements__', 'g'), elementsUri.toString())
      .replace(new RegExp('__codicons__', 'g'), codiconsUri.toString())
      .replace(new RegExp('__style__', 'g'), styleUri.toString())
      .replace(new RegExp('__nonce__', 'g'), getNonce());

    console.log(result);
    return result;
  }

  // public updateToEmpty() {
  //   if (this.view === undefined) {
  //     return;
  //   }
  //   // Scenario: empty focus
  //   this.view.title = 'Components';
  // }

  // public updateOnFocus(focused: FocusOnEntity) {
  //   if (this.view === undefined) {
  //     return;
  //   }

  //   // Scenario: client is removed
  //   const client = this.clients.get(focused.host);
  //   if (client === undefined) {
  //     this.updateToEmpty();
  //     return;
  //   }

  //   // Scenario: client is dead
  //   if (client.getState() === 'dead') {
  //     this.setState(client.getState());
  //     return;
  //   }

  //   // Error
  //   const entity = client.getById(focused.entityId);
  //   if (entity === undefined) {
  //     return;
  //   }

  //   // Scenario: focus on entity
  //   this.setFocus(structuredClone(focused));
  //   this.view.show(true);
  //   this.view.title = 'Components of ' + (entity.name ? entity.name : entity.id);

  //   // fire update here
  // }

  // private setFocus(focus?: FocusOnEntity) {
  //   this._focus = focus;
  //   if (focus !== undefined) {
  //     this.setState('alive');
  //   }
  // }

  // private setState(state: ConnectionState) {
  //   if (this.view === undefined) {
  //     return;
  //   }
  //   switch (state) {
  //     case 'dead':
  //       this.view.description = 'Disconnected';
  //       break;
  //     case 'alive':
  //       this.view.description = undefined;
  //       break;
  //   }
  // }

  // public setStateForHost(state: ConnectionState, host: string) {
  //   if (typeof host === 'string') {
  //     if (host !== this.focus?.host) {
  //       return;
  //     }
  //   }
  //   this.setState(state);
  // }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
