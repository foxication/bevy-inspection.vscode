import * as vscode from 'vscode';
import { BevyRemoteProtocol, ServerVersion } from 'bevy-remote-protocol';
import { Client } from './client';

type AddBehavior = 'prompt' | 'last';

export class ClientCollection {
  // Properties
  private collection: Client[] = [];
  private lastProtocol: null | BevyRemoteProtocol = null;

  // Events
  private clientAddedEmitter = new vscode.EventEmitter<Client>();
  readonly onClientAdded = this.clientAddedEmitter.event;
  private clientRemovedEmitter = new vscode.EventEmitter<Client>();
  readonly onClientRemoved = this.clientRemovedEmitter.event;

  public async tryCreateClient(behavior: AddBehavior = 'prompt') {
    let newClient;

    if (this.lastProtocol instanceof BevyRemoteProtocol && behavior === 'last') {
      newClient = new Client(this.lastProtocol.url, this.lastProtocol.serverVersion);
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
      newClient = new Client(new URL(url), versionEnum);
    }

    // if such alive client already exists
    if (
      this.collection
        .filter((client) => {
          if (client.getState() === 'alive') {
            return client;
          }
        })
        .find((client) => {
          if (client.getProtocol().url.host === newClient.getProtocol().url.host) {
            return client;
          }
        }) instanceof Client
    ) {
      vscode.window.showInformationMessage('Specified connection already exists');
      return;
    }

    newClient.initialize().then((status) => {
      if (status !== 'success') {
        return;
      }

      // Success
      this.lastProtocol = newClient.cloneProtocol();

      // Remove previous clients
      const toRemove = this.lastProtocol.url;
      this.collection = this.collection.filter((value) => {
        const protocol = value.getProtocol();
        if (protocol.url !== toRemove) {
          return true;
        }
        return false;
      });

      // Push
      this.collection.push(newClient);

      // Events
      this.clientAddedEmitter.fire(newClient);
    });
  }

  public removeClient(host: string) {
    const client = this.get(host);
    if (client === undefined || client.getState() === 'alive') {
      return;
    }
    this.collection = this.collection.filter((item) => item.getProtocol().url !== client.getProtocol().url);
    this.clientRemovedEmitter.fire(client);
  }

  public all() {
    return this.collection;
  }

  public get(host: string) {
    return this.collection.find((client) => client.getProtocol().url.host === host);
  }
}
