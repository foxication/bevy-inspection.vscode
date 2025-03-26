import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { createExpandableOfComponents } from './componentsElements';
import { BrpStructurePath, BrpValue } from 'bevy-remote-protocol/src/types';
import { BrpStructureCustom, serializePath, VSCodeMessage, WebviewMessage } from './lib';

// VSCode Access
const vscode = acquireVsCodeApi();
function postWebviewMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

// Entity Values
export class EntityData {
  private data: BrpStructureCustom = new BrpStructureCustom({});
  private dataNext: BrpStructureCustom = new BrpStructureCustom({});

  synced() {
    return this.data;
  }
  changed() {
    return this.dataNext;
  }

  requestUpdate(path: BrpStructurePath, value: BrpValue) {
    const [component, serialized] = serializePath(path);
    postWebviewMessage({
      cmd: 'mutate_component',
      data: {
        component: component,
        path: serialized,
        value: value,
      },
    });
  }

  applyUpdate(path: BrpStructurePath, value: BrpValue) {
    this.dataNext.set(path, value);
  }
}

export const entityData = new EntityData();

// Main script
(function () {
  const list = document.querySelector('.component-list') as HTMLDivElement;
  if (list === null) {
    console.error('.component-list is not found in DOM');
    return;
  }

  const rootExpandable = createExpandableOfComponents();

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    console.log(`recieved message: ${message.cmd}`);
    switch (message.cmd) {
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
      case 'update':
        entityData.applyUpdate([], message.data);
        rootExpandable.sync();
        postWebviewMessage({ cmd: 'ready_for_watch' });
        break;
      case 'update_component':
        entityData.applyUpdate([message.component], message.value);
        rootExpandable.sync();
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
