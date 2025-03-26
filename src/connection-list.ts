import * as vscode from 'vscode';
import { BevyRemoteProtocol, EntityId, ServerVersion } from './protocol';
import { Connection } from './connection';
import { ConnectionElement } from './hierarchyData';

type AddBehavior = 'prompt' | 'last';

export class EntityFocus {
  private _host: string;
  private _entityId: EntityId;

  constructor(host: string, entityId: EntityId) {
    this._host = host;
    this._entityId = entityId;
  }

  get host() {
    return this._host;
  }

  get entityId() {
    return this._entityId;
  }
}

export class ConnectionList {
  // Properties
  private connections = new Map<string, Connection>();
  private lastProtocol: BevyRemoteProtocol | null = null;
  private _focus: EntityFocus | null = null;

  get focus() {
    return this._focus;
  }

  // Events
  private addedEmitter = new vscode.EventEmitter<Connection>();
  readonly onAdded = this.addedEmitter.event;
  
  private addErrorEmitter = new vscode.EventEmitter<void>();
  readonly onAddError = this.addErrorEmitter.event;
  
  private removedEmitter = new vscode.EventEmitter<Connection>();
  readonly onRemoved = this.removedEmitter.event;
  
  private focusChangedEmitter = new vscode.EventEmitter<EntityFocus | null>();
  readonly onFocusChanged = this.focusChangedEmitter.event;

  public async tryCreateConnection(behavior: AddBehavior = 'prompt') {
    let newConnection;

    if (this.lastProtocol instanceof BevyRemoteProtocol && behavior === 'last') {
      newConnection = new Connection(this.lastProtocol.url, this.lastProtocol.serverVersion);
    } else {
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
      newConnection = new Connection(new URL(url), versionEnum);
    }

    // if such online connection already exists
    const existingConnection = this.connections.get(newConnection.getProtocol().url.host);
    if (existingConnection && existingConnection.getNetworkStatus() === 'online') {
      vscode.window.showInformationMessage('Specified connection already exists');
      return;
    }

    newConnection.initialize().then((protocolStatus) => {
      if (protocolStatus !== 'success') {
        this.addErrorEmitter.fire();
        return;
      }

      // Success
      this.lastProtocol = newConnection.cloneProtocol();
      this.connections.set(this.lastProtocol.url.host, newConnection);

      // Events
      this.addedEmitter.fire(newConnection);
    });
  }

  public async updateFocus(newFocus: EntityFocus | null) {
    // Check if focus changed
    if (this.focus === newFocus) {
      return;
    }

    // Scenario when focus is null
    if (newFocus === null) {
      this._focus = null;
      this.focusChangedEmitter.fire(null);
      return;
    }

    // Check if connection exists and is online
    const connection = this.connections.get(newFocus.host);
    if (connection === undefined || connection.getNetworkStatus() === 'offline') {
      return;
    }

    // Change focus of inspection
    this._focus = new EntityFocus(newFocus.host, newFocus.entityId);

    // before emitting change, request data
    this.get(newFocus.host)?.requestInspectionElements(newFocus);
    this.focusChangedEmitter.fire(newFocus);
  }

  public removeConnection(host: string) {
    const connection = this.get(host);
    if (connection === undefined || connection.getNetworkStatus() === 'online') {
      return;
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

  public getAsElement(host: string): ConnectionElement | undefined {
    const connection = this.get(host);
    const protocol = connection?.getProtocol();
    if (connection === undefined || protocol === undefined) {
      return;
    }
    return new ConnectionElement(protocol.url.host, protocol.serverVersion, connection.getNetworkStatus());
  }
}
