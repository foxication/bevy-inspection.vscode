import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { DataSyncManager } from './sync';
import { BrpValue, BrpComponentRegistry, TypePath, BrpRegistrySchema } from '../protocol/types';

export type WebviewMessage =
  | {
      cmd: 'mutate_component';
      data: { component: string; path: string; value: BrpValue };
    }
  | { cmd: 'ready_for_watch' };

export type VSCodeMessage =
  | {
      cmd: 'set_entity_info';
      host: string;
      entityId: number;
    }
  | {
      cmd: 'update_all';
      data: BrpComponentRegistry;
    }
  | {
      cmd: 'update_registry_schema';
      data: BrpRegistrySchema;
    }
  | {
      cmd: 'update_component';
      component: TypePath;
      value: BrpValue;
    };

// VSCode Access
const vscode = acquireVsCodeApi();
function postWebviewMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

// Main script
(function () {
  const componentList = document.querySelector('.component-list') as HTMLDivElement;
  if (componentList === null) {
    console.error('.component-list is not found in DOM');
    return;
  }
  const syncRoot = new DataSyncManager({}, {}, componentList);

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    console.log(`recieved message: ${message.cmd}`);
    switch (message.cmd) {
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
      case 'update_registry_schema':
        syncRoot.registrySchema = message.data;
        break;
      case 'update_all':
        syncRoot.mapOfComponents = message.data;
        syncRoot.sync();
        console.log(syncRoot.debugTree());
        postWebviewMessage({ cmd: 'ready_for_watch' });
        break;
      case 'update_component':
        syncRoot.mapOfComponents[message.component] = message.value;
        syncRoot.sync();
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
