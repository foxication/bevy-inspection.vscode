import * as vscode from 'vscode';
import { DEFAULT_BEVY_URL, initializeBevyRemoteProtocol } from './protocol';
import { Connection } from './connection';
import { EntityFocus } from './common';

type AddBehavior = 'prompt' | 'last';

export class ConnectionList {
  // Properties
  private connections = new Map<string, Connection>();
  private lastUrl: URL | undefined = undefined;
  private _focus: EntityFocus | undefined = undefined;
  private watchId: NodeJS.Timeout | undefined = undefined;

  get focus() {
    return this._focus;
  }

  // Events
  private addedEmitter = new vscode.EventEmitter<Connection>();
  readonly onAdded = this.addedEmitter.event;

  private removedEmitter = new vscode.EventEmitter<Connection>();
  readonly onRemoved = this.removedEmitter.event;

  private focusChangedEmitter = new vscode.EventEmitter<EntityFocus>();
  readonly onFocusChanged = this.focusChangedEmitter.event;

  public async tryCreateConnection(behavior: AddBehavior = 'prompt'): Promise<void> {
    let url: URL;
    const errSrc = 'ConnectionList.tryCreateConnection(): ';

    if (this.lastUrl !== undefined && behavior === 'last') {
      url = this.lastUrl;
    } else {
      // Input URL
      const input = await vscode.window.showInputBox({
        title: 'Connection to Bevy Instance',
        value: DEFAULT_BEVY_URL.toString(),
      });
      if (input === undefined) return console.error(errSrc + 'no url');
      url = new URL(input);
    }

    // if such online connection already exists
    const existingConnection = this.connections.get(url.host); // REDO (bad solution)
    if (existingConnection && existingConnection.getNetworkStatus() === 'online') {
      vscode.window.showErrorMessage('Specified connection already exists');
      return; // error in ui
    }

    // try to initialize protocol
    const newProtocol = await initializeBevyRemoteProtocol(url);
    if (typeof newProtocol === 'string') {
      vscode.window.showErrorMessage('Bevy instance refused to connect');
      return; // error in ui
    }

    // try to initialize connection
    const newConnection = new Connection(newProtocol);
    newConnection.initialize().then((protocolStatus) => {
      if (protocolStatus !== 'success') {
        vscode.window.showErrorMessage('Bevy instance refused to connect');
        return; // error in ui
      }

      // Success
      this.lastUrl = newConnection.getProtocol().url;
      this.connections.set(this.lastUrl.host, newConnection);
      this.addedEmitter.fire(newConnection);
    });
  }

  public async updateFocus(newFocus: EntityFocus) {
    if (this._focus instanceof EntityFocus && this._focus.compare(newFocus)) return; // skip if no changes
    this._focus = newFocus;
    this.focusChangedEmitter.fire(newFocus);
  }

  public removeConnection(host: string) {
    const connection = this.get(host);
    if (connection === undefined) {
      return console.error('ConnectionList.removeConnection(): no connection');
    }
    this.connections.delete(host);
    this.removedEmitter.fire(connection);
  }

  public all(): Connection[] {
    return Array.from(this.connections.values());
  }

  public get(host: string): Connection | undefined {
    return this.connections.get(host);
  }
}
