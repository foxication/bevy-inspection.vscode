import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { Client } from './client';

type SessionTemplate = 'prompt' | 'last';

export class ClientCollection {
  private lastSession: null | Client;
  private clientAddedEmitter = new vscode.EventEmitter<Client>();
  readonly onClientAdded = this.clientAddedEmitter.event;

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
      this.clientAddedEmitter.fire(this.lastSession);
    });
  }

  public current() {
    return this.lastSession;
  }
}
