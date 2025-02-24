import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { Client } from './client';
import { Extension } from './extension';

type SessionTemplate = 'prompt' | 'last';

export class ClientCollection {
  private lastSession: null | Client;

  constructor() {
    this.lastSession = null;
  }

  public async tryCreateSession(template: SessionTemplate = 'prompt') {
    let newSession;

    // Get session from user
    if (template === 'prompt' || this.lastSession === null) {
      // Input URL
      const url = await vscode.window.showInputBox({
        title: 'Connection to Bevy Instance',
        value: BevyRemoteProtocol.DEFAULT_URL.toString(),
      });
      if (!url) {
        return;
      }

      // Input version
      const versions = Object.keys(ServerVersion);
      const versionString = await vscode.window.showQuickPick(versions, { canPickMany: false });
      if (!versionString) {
        return;
      }
      const versionEnum = Object.values(ServerVersion)[Object.keys(ServerVersion).indexOf(versionString)];

      // Create new session
      newSession = new Client(new URL(url), versionEnum);
    }
    // Or clone last session
    else {
      newSession = this.lastSession.cloneWithProtocol();
    }

    newSession.initialize().then((status) => {
      if (status !== 'success') {
        return;
      }
      // do not overwrite alive session
      if (this.lastSession?.isAlive() === true) {
        return;
      }

      // success
      this.lastSession = newSession;

      // Update views
      Extension.entitiesProvider.update(null);
      Extension.entitiesView.description = undefined;

      Extension.componentsProvider.update(null);
      Extension.componentsView.description = undefined;

      // Set context
      Extension.setIsSessionAlive(true);
      Extension.setAreViewsVisible(true);
    });
  }

  public current() {
    return this.lastSession;
  }
}
