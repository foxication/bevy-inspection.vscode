import * as vscode from 'vscode';
import * as assert from 'assert';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { EntityNode, HierarchyProvider } from './entitiesProvider';
import { ComponentsProvider, InspectionElement } from './componentsProvider';
import { InspectionSession } from './session';

export class SessionManager {
  private lastSession: InspectionSession;
  static areViewsInitialized = false;
  static hierarchyView: vscode.TreeView<EntityNode> | undefined;
  static inspectionView: vscode.TreeView<InspectionElement> | undefined;

  constructor() {
    this.lastSession = new InspectionSession(
      'empty',
      BevyRemoteProtocol.DEFAULT_URL,
      ServerVersion.IGNORE,
      this.afterDeath
    );
  }

  public async try_connect() {
    const url = await vscode.window.showInputBox({
      title: 'Connection to Bevy Instance',
      value: BevyRemoteProtocol.DEFAULT_URL.toString(),
    });
    if (!url) {
      return;
    }

    const versions = Object.keys(ServerVersion);
    const version = await vscode.window.showQuickPick(versions, { canPickMany: false });
    assert.ok(version);

    const chosen = Object.values(ServerVersion)[Object.keys(ServerVersion).indexOf(version)];

    const newSession = new InspectionSession('dead', new URL(url), chosen, this.afterDeath);
    newSession
      .postConstructor()
      .then(() => {
        // do not overwrite alive session
        if (this.lastSession.isAlive()) {
          return;
        }

        // success
        this.lastSession = newSession;
        this.initializeViewsOnce();

        if (SessionManager.hierarchyView !== undefined) {
          SessionManager.hierarchyView.message = this.lastSession.getSessionInfo();
        }
      })
      .catch((reason: Error) => {
        if (reason instanceof TypeError) {
          vscode.window.showErrorMessage('Connection with Bevy instance is refused');
          return;
        }
        vscode.window.showErrorMessage(reason.message);
      });
  }

  private initializeViewsOnce() {
    if (SessionManager.areViewsInitialized) {
      return;
    }
    SessionManager.areViewsInitialized = true;

    const hierachyProvider = new HierarchyProvider(this.lastSession);
    const componentsProvider = new ComponentsProvider(this.lastSession);

    SessionManager.hierarchyView = vscode.window.createTreeView('hierarchyView', {
      treeDataProvider: hierachyProvider,
      canSelectMany: false,
      showCollapseAll: true,
      dragAndDropController: undefined, // TODO
      manageCheckboxStateManually: undefined,
    });
    SessionManager.hierarchyView.onDidChangeSelection((event) => {
      if (event.selection.length > 1) {
        return;
      }
      const selected = event.selection[0];
      componentsProvider.focusOnEntity(selected.id);
    });

    SessionManager.inspectionView = vscode.window.createTreeView('inspectionView', {
      treeDataProvider: componentsProvider,
      canSelectMany: false,
      showCollapseAll: true,
      dragAndDropController: undefined,
      manageCheckboxStateManually: undefined,
    });

    vscode.commands.executeCommand('setContext', 'extension.areViewsVisible', true);
  }

  private afterDeath() {
    vscode.window.showErrorMessage('Bevy instance is disconnected');
  }
}
