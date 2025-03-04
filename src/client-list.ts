import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { Connection } from './client';
import { ConnectionElement as ConnectionElement } from './hierarchyData';

type AddBehavior = 'prompt' | 'last';

export class ConnectionList {
  // Properties
  private connections = new Map<string, Connection>();
  private lastProtocol: null | BevyRemoteProtocol = null;

  // Events
  private connectionAddedEmitter = new vscode.EventEmitter<Connection>();
  readonly onConnectionAdded = this.connectionAddedEmitter.event;
  private connectionRemovedEmitter = new vscode.EventEmitter<Connection>();
  readonly onConnectionRemoved = this.connectionRemovedEmitter.event;

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
        return;
      }

      // Success
      this.lastProtocol = newConnection.cloneProtocol();
      this.connections.set(this.lastProtocol.url.host, newConnection);

      // Events
      this.connectionAddedEmitter.fire(newConnection);
    });
  }

  public removeConnection(host: string) {
    const connection = this.get(host);
    if (connection === undefined || connection.getNetworkStatus() === 'online') {
      return;
    }
    this.connections.delete(host);
    this.connectionRemovedEmitter.fire(connection);
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
