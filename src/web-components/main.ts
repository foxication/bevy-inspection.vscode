import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { DataSyncManager } from './sync';
import { BrpValue, BrpComponentRegistry, BrpRegistrySchema, BrpObject, TypePath } from '../protocol/types';

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
      host: string;
      data: BrpComponentRegistry;
    }
  | {
      cmd: 'load_registry_schema';
      host: string;
      data: BrpRegistrySchema;
    }
  | {
      cmd: 'unload_registry_schema';
      host: string;
    }
  | {
      cmd: 'update_components';
      components: BrpObject;
      removed: TypePath[];
    };

// VSCode Access
const vscode = acquireVsCodeApi();
function postWebviewMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

// Main script
(function () {
  const componentList = document.querySelector('#section-component-list') as HTMLDivElement;
  if (componentList === null) {
    console.error('#section-component-list is not found in DOM');
    return;
  }
  const onMutation = (component: string, path: string, value: BrpValue) => {
    console.log('Called main.onMutation()');
    postWebviewMessage({
      cmd: 'mutate_component',
      data: { component, path, value },
    });
  };
  const syncRoot = new DataSyncManager(componentList, onMutation);

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    switch (message.cmd) {
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
      case 'load_registry_schema':
        syncRoot.setRegistrySchema(message.host, message.data);
        break;
      case 'unload_registry_schema':
        syncRoot.removeRegistrySchema(message.host);
        break;
      case 'update_all':
        syncRoot.currentHost = message.host;
        syncRoot.mapOfComponents = message.data;
        syncRoot.sync();
        break;
      case 'update_components':
        Object.entries(message.components).forEach(([typePath, value]) => {
          syncRoot.mapOfComponents[typePath] = value;
        });
        message.removed.forEach((component) => {
          delete syncRoot.mapOfComponents[component];
        });
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
