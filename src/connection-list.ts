import * as vscode from 'vscode';
import {
  EntityId,
  BrpGetWatchResult,
  DEFAULT_BEVY_URL,
  initializeBevyRemoteProtocol,
  TypePath,
} from './protocol';
import { Connection } from './connection';

type AddBehavior = 'prompt' | 'last';

export class EntityFocus {
  constructor(public host: string, public entityId: EntityId) {}
  compare(another: EntityFocus): boolean {
    return this.host === another.host && this.entityId === another.entityId;
  }
  clone() {
    return new EntityFocus(this.host, this.entityId);
  }
}

export class ConnectionList {
  // Properties
  private connections = new Map<string, Connection>();
  private lastUrl: URL | undefined = undefined;
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

  private expectStopOfWatch = false;
  public startComponentWatch(focus: EntityFocus, components: TypePath[]) {
    const srcName = `${this.constructor.name}.watchingController`;

    // Stop previous watching
    if (this.watchingController !== undefined) {
      this.watchingController.abort();
      console.error(`ConnectionList.startComponentWatch(): previous watch wasn't stopped`);
    }

    // Get connection
    const protocol = this.get(focus.host)?.getProtocol();
    if (protocol === undefined) return console.error(`${srcName}: no connection`);
    this.watchingController = new AbortController();
    protocol
      .getWatch(focus.entityId, components, this.watchingController.signal, (v) => {
        this.getWatchResultEmitter.fire([focus, v]);
      })
      .then((result) => {
        this.watchingController = undefined;
        if (!this.expectStopOfWatch) {
          console.error(`${srcName}: watch stopped unexpectedly with: ${JSON.stringify(result)}`);
          if (result === null) {
            console.log(`${srcName}: watch is restored`);
            this.startComponentWatch(focus, components);
          } else {
            this.connections.get(focus.host)?.disconnect();
          }
        }
        this.expectStopOfWatch = false;
      });
  }

  public stopComponentWatch() {
    this.expectStopOfWatch = true;
    this.watchingController?.abort();
  }
}
