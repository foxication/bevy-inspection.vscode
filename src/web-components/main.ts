import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { DataSyncManager } from './sync';
import { BrpValue, BrpComponentRegistry, TypePath } from '../protocol/types';

export type WebviewMessage =
  | {
      cmd: 'mutate_component';
      data: {
        component: string;
        path: string;
        value: BrpValue;
      };
    }
  | {
      cmd: 'ready_for_watch';
    };

export type VSCodeMessage =
  | {
      cmd: 'set_entity_info';
      host: string;
      entityId: number;
    }
  | { cmd: 'update'; data: BrpComponentRegistry }
  | { cmd: 'update_component'; component: TypePath; value: BrpValue };

// VSCode Access
const vscode = acquireVsCodeApi();
function postWebviewMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

// Main script
(function () {
  const list = document.querySelector('.component-list') as HTMLDivElement;
  if (list === null) {
    console.error('.component-list is not found in DOM');
    return;
  }
  const components = new DataSyncManager({}, {});

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    console.log(`recieved message: ${message.cmd}`);
    switch (message.cmd) {
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
      case 'update':
        components.mapOfComponents = message.data;
        components.sync();
        postWebviewMessage({ cmd: 'ready_for_watch' });
        break;
      case 'update_component':
        components.mapOfComponents[message.component] = message.value;
        components.sync();
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
