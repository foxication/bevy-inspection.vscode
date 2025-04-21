import * as vscode from 'vscode';
import {
  BevyRemoteProtocol,
  EntityId,
  BevyVersion,
  BevyVersions,
  BrpGetWatchResult,
} from './protocol';
import { Connection } from './connection';

type AddBehavior = 'prompt' | 'last';

export class EntityFocus {
  constructor(public host: string, public entityId: EntityId) {}
  clone() {
    return new EntityFocus(this.host, this.entityId);
  }
}

export class ConnectionList {
  // Properties
  private connections = new Map<string, Connection>();
  private lastProtocol: BevyRemoteProtocol | null = null;
  private _focus: EntityFocus | null = null;
  private watchingController: AbortController | undefined = undefined;

  get focus() {
    return this._focus;
  }

  // Events
  private addedEmitter = new vscode.EventEmitter<Connection>();
  readonly onAdded = this.addedEmitter.event;

  private removedEmitter = new vscode.EventEmitter<Connection>();
  readonly onRemoved = this.removedEmitter.event;

  private focusChangedEmitter = new vscode.EventEmitter<EntityFocus | null>();
  readonly onFocusChanged = this.focusChangedEmitter.event;

  private getWatchResultEmitter = new vscode.EventEmitter<[EntityFocus, BrpGetWatchResult]>();
  readonly onGetWatchResult = this.getWatchResultEmitter.event;

  public async tryCreateConnection(behavior: AddBehavior = 'prompt'): Promise<void> {
    let newConnection;
    const errSrc = 'ConnectionList.tryCreateConnection(): ';

    if (this.lastProtocol instanceof BevyRemoteProtocol && behavior === 'last') {
      newConnection = new Connection(this.lastProtocol.url, this.lastProtocol.serverVersion);
    } else {
      // Input URL
      const url = await vscode.window.showInputBox({
        title: 'Connection to Bevy Instance',
        value: BevyRemoteProtocol.DEFAULT_URL.toString(),
      });
      if (url === undefined) return console.error(errSrc + 'no url');

      // Input version
      const chosenVersion = await vscode.window.showQuickPick(BevyVersions, { canPickMany: false });
      if (chosenVersion === undefined) return console.error(errSrc + 'user did not pick version');

      // Create new session
      newConnection = new Connection(new URL(url), chosenVersion as BevyVersion);
    }

    // if such online connection already exists
    const existingConnection = this.connections.get(newConnection.getHost());
    if (existingConnection && existingConnection.getNetworkStatus() === 'online') {
      vscode.window.showErrorMessage('Specified connection already exists');
      return; // error in ui
    }

    newConnection.initialize().then((protocolStatus) => {
      if (protocolStatus !== 'success') {
        vscode.window.showErrorMessage('Bevy instance refused to connect');
        return; // error in ui
      }

      // Success
      this.lastProtocol = newConnection.cloneProtocol();
      this.connections.set(this.lastProtocol.url.host, newConnection);
      this.addedEmitter.fire(newConnection);
    });
  }

  public async updateFocus(newFocus: EntityFocus | null) {
    if (newFocus === this._focus) return; // skip
    if (newFocus === null) {
      this._focus = null;
      this.focusChangedEmitter.fire(null);
      return; // set focus to null
    }

    // Check if connection exists and is online
    const errSrc = 'ConnectionList.updateFocus(): ';
    const connection = this.connections.get(newFocus.host);
    if (connection === undefined) return console.error(errSrc + 'no connection');
    if (connection.getNetworkStatus() !== 'online') {
      return console.error(errSrc + 'connection is not online');
    }

    // Change focus
    this._focus = new EntityFocus(newFocus.host, newFocus.entityId);

    // request data, then emit change
    await connection.requestInspectionElements(newFocus.entityId);
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

  public startWatch(focus: EntityFocus) {
    // Stop previous watching
    this.stopWatch();

    // Get connection
    const protocol = this.get(focus.host)?.getProtocol();
    if (protocol === undefined) {
      return console.error(`${this.constructor.name}.startWatch: no connection`);
    }
    protocol
      .list(focus.entityId)
      .then((response) => {
        if (response.result === undefined) return; // Skip if no components to watch
        this.watchingController = new AbortController();
        protocol.getWatch(focus.entityId, response.result, this.watchingController.signal, (v) => {
          this.getWatchResultEmitter.fire([focus, v]);
        });
      })
      .catch(() => {});
  }

  public stopWatch() {
    this.watchingController?.abort();
  }
}
