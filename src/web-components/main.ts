import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { DataSyncManager } from './sync';
import { BrpValue, BrpComponentRegistry, BrpRegistrySchema, BrpObject, TypePath } from '../protocol/types';

export type WebviewMessage =
  | {
      cmd: 'mutate_component';
      data: { component: string; path: string; value: BrpValue };
    }
  | {
      cmd: 'request_of_sync_registry_schema';
      host: string;
    };

export type VSCodeMessage =
  | { cmd: 'debug_output' }
  | {
      cmd: 'set_entity_info';
      host: string;
      entityId: number;
    }
  | {
      cmd: 'update_all';
      host: string;
      data: BrpComponentRegistry;
    }
  | {
      cmd: 'sync_registry_schema';
      host: string;
      data: BrpRegistrySchema;
      available: string[];
    }
  | {
      cmd: 'update_components';
      components: BrpObject;
      removed: TypePath[];
    };

// VSCode Access
const vscode = acquireVsCodeApi();
export function postWebviewMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

// Main script
(function () {
  const componentList = document.querySelector('#section-component-list') as HTMLDivElement;
  if (componentList === null) {
    console.error('#section-component-list is not found in DOM');
    return;
  }
  const syncRoot = new DataSyncManager(componentList);
  const requestRegistrySchema = () => {
    if (syncRoot.currentHost === undefined) return;
    postWebviewMessage({
      cmd: 'request_of_sync_registry_schema',
      host: syncRoot.currentHost,
    });
  };

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    switch (message.cmd) {
      case 'debug_output':
        console.log(syncRoot.debugTree());
        break;
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
      case 'sync_registry_schema':
        syncRoot.syncRegistrySchema(message.available, message.host, message.data);
        if (syncRoot.getRegistrySchema() !== undefined) syncRoot.sync();
        break;
      case 'update_all':
        syncRoot.currentHost = message.host;
        syncRoot.mapOfComponents = message.data;
        if (syncRoot.getRegistrySchema() !== undefined) syncRoot.sync();
        else requestRegistrySchema();
        break;
      case 'update_components':
        Object.entries(message.components).forEach(([typePath, value]) => {
          syncRoot.mapOfComponents[typePath] = value;
        });
        message.removed.forEach((component) => {
          delete syncRoot.mapOfComponents[component];
        });
        if (syncRoot.getRegistrySchema() !== undefined) syncRoot.sync();
        else requestRegistrySchema();
        break;
    }
  });

  function setEntityInfo(host: string, entityId: number) {
    const hostLabel = document.querySelector('#entity-info-host');
    if (hostLabel instanceof Element) {
      hostLabel.textContent = host;
    }

    const idLabel = document.querySelector('#entity-info-id');
    if (idLabel instanceof Element) {
      idLabel.textContent = entityId.toString();
    }
  }
})();
