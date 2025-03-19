import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { ExtExpandable, initExtElements } from './componentsElements';
import { BrpStructure, TypePath } from 'bevy-remote-protocol/src/types';
import { BrpValue } from 'bevy-remote-protocol';
import { VSCodeMessage, WebviewMessage } from './lib';

// VSCode Access
const vscode = acquireVsCodeApi();
function postWebviewMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

// Entity Values
export const entityData = new BrpStructure(null);
export function onEntityDataChange(path: (TypePath | number)[], value: BrpValue) {
  postWebviewMessage({
    cmd: 'mutate_component',
    data: {
      component: path[0].toString(),
      path: path
        .slice(1)
        .map((v) => '.' + v)
        .join(''),
      value: value,
    },
  });
}

initExtElements();

// Main script
(function () {
  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    console.log(`recieved message: ${message.cmd}`);
    switch (message.cmd) {
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
      case 'update':
        entityData.set([], message.data);
        updateView();
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
  function updateView(): 'success' | 'failure' {
    const componentList = document.querySelector('.component-list');
    if (componentList === null) return 'failure';

    console.log('RECIEVED NEW DATA');
    console.log(entityData.get());

    // clear component list
    componentList.innerHTML = '';
    if (entityData.get() === null) return 'success';
    if (!(entityData.get() instanceof Object)) return 'failure'; // it's not map of components

    const list = document.createElement('ext-expandable') as ExtExpandable;
    list.path = [];
    componentList.appendChild(list);
    return 'success';
  }
})();
