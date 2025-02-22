import * as vscode from 'vscode';
import { BevyRemoteProtocol, EntityId, ServerVersion, TypePath } from 'bevy-remote-protocol';
import * as assert from 'node:assert';
import { EntityNode, HierarchyProvider } from './hierachy';
import { ComponentsDataProvider as ComponentsProvider } from './inspection';

// class MethodAfterChange<T> {
//   private variable: T;
//   public method: (variable: T) => void;

//   constructor(variable: T, callAfterChange: typeof this.method) {
//     this.variable = variable;
//     this.method = callAfterChange;
//   }

//   set(v: T) {
//     this.variable = v;
//     this.method(v);
//   }

//   get() {
//     return this.variable;
//   }
// }

export function activate(context: vscode.ExtensionContext) {
  const manager = new SessionManager();

  // register all commands
  context.subscriptions.push(vscode.commands.registerCommand('extension.debugLog', () => debugLog()));
  context.subscriptions.push(vscode.commands.registerCommand('extension.connect', () => manager.try_connect()));
}

async function debugLog() {
  const protocol = new BevyRemoteProtocol(BevyRemoteProtocol.DEFAULT_URL, ServerVersion.V0_16);
  console.log('COMPONENTS:');
  console.log((await protocol.list())?.result);
}

export class SessionManager {
  private lastSession: InspectionSession;
  static areViewsInitialized = false;

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
      })
      .catch((reason: Error) => {
        if (reason instanceof TypeError) {
          vscode.window.showErrorMessage('Connection with Bevy instance is refused');
          return;
        }
        vscode.window.showErrorMessage(reason.message);
      });
  }

  public getCurrentSession(): InspectionSession {
    return this.lastSession;
  }

  private initializeViewsOnce() {
    if (SessionManager.areViewsInitialized) {
      return;
    }
    SessionManager.areViewsInitialized = true;

    const hierachyProvider = new HierarchyProvider(this.lastSession);
    const componentsProvider = new ComponentsProvider(this.lastSession);

    const hiearchyView = vscode.window.createTreeView('hierarchyView', {
      treeDataProvider: hierachyProvider,
      canSelectMany: false,
      showCollapseAll: true,
      dragAndDropController: undefined, // TODO
      manageCheckboxStateManually: undefined,
    });
    hiearchyView.onDidChangeSelection((event) => {
      if (event.selection.length > 1) {
        return;
      }
      const selected = event.selection[0];
      componentsProvider.focusOnEntity(selected.id);
    });

    vscode.window.createTreeView('inspectionView', {
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

export class InspectionSession {
  private onDeath: () => void;

  public protocol: BevyRemoteProtocol;
  public state: 'empty' | 'dead' | 'alive';
  public registeredComponents: TypePath[] = [];
  public allEntitiesNodes: EntityNode[] = [];

  constructor(state: typeof this.state, url: URL, version: ServerVersion, onDeath: () => void) {
    this.state = state;
    this.protocol = new BevyRemoteProtocol(url, version);
    this.onDeath = onDeath;
  }
  async postConstructor() {
    const response = await this.protocol.query({
      option: ['bevy_ecs::name::Name', 'bevy_ecs::hierarchy::ChildOf', 'bevy_ecs::hierarchy::Children'],
    });
    if (!response.result) {
      return;
    }
    this.allEntitiesNodes = response.result.map((value) => {
      return new EntityNode(value.entity, {
        name: value.components['bevy_ecs::name::Name'] as string,
        childOf: value.components['bevy_ecs::hierarchy::ChildOf'] as EntityId,
        children: value.components['bevy_ecs::hierarchy::Children'] as EntityId[],
      });
    });
    this.registeredComponents = (await this.protocol.list())?.result ?? [];
    this.state = 'alive';
  }
  isAlive() {
    return this.state === 'alive';
  }

  async stop() {
    this.state = 'dead';
    this.onDeath();
  }
}
