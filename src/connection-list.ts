import * as vscode from 'vscode';
import {
  BrpComponentRegistry,
  BrpResponseErrors,
  DEFAULT_BEVY_URL,
  initializeBevyRemoteProtocol,
  TypePath,
} from './protocol';
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

  private getWatchResultEmitter = new vscode.EventEmitter<
    [EntityFocus, TypePath[], BrpComponentRegistry, BrpResponseErrors]
  >();
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

  private watchBuffer: BrpComponentRegistry = {};
  public startComponentWatch(focus: EntityFocus, exceptions: TypePath[], interval: number) {
    const srcName = `${this.constructor.name}.watchingController`;

    // Stop previous watch
    this.stopComponentWatch();

    // Get protocol
    const protocol = this.get(focus.host)?.getProtocol();
    if (protocol === undefined) return console.error(`${srcName}: no connection`);

    this.watchId = setInterval(async () => {
      const onError = (message: string | undefined) => {
        this.stopComponentWatch();
        if (message !== undefined) console.error(message);
        return this.connections.get(focus.host)?.disconnect();
      };
      // Get component list
      const listResponse = await protocol.list(focus.entityId);
      if (typeof listResponse === 'string') return onError(undefined);
      if (listResponse.result === undefined) return onError('list in watch responses with error');

      // Get result
      const whiteList = listResponse.result.filter((c) => !exceptions.includes(c));
      const getResponse = await protocol.get(focus.entityId, whiteList);
      if (typeof getResponse === 'string') return onError(undefined);
      if (getResponse.result === undefined) return onError('get in watch responses with error');

      // Update exceptions
      exceptions.push(...Object.keys(getResponse.result.errors));

      // Filter out changes only (unfortunately first iteration will send all components)
      const bufferKeys = Object.keys(this.watchBuffer);
      const componentChanges = Object.fromEntries(
        Object.entries(getResponse.result.components).filter(([key, value]) => {
          if (!bufferKeys.includes(key)) return true;
          if (JSON.stringify(value) !== JSON.stringify(this.watchBuffer[key])) return true;
          return false;
        })
      );
      this.watchBuffer = getResponse.result.components;

      // Signal
      this.getWatchResultEmitter.fire([focus, whiteList, componentChanges, getResponse.result.errors]);
    }, interval);
  }

  public stopComponentWatch() {
    clearInterval(this.watchId);
    this.watchId = undefined;
    this.watchBuffer = {};
  }
}
