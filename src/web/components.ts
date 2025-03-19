import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { ExtExpandable, initExtElements } from './componentsElements';
import { BrpStructure, TypePath } from 'bevy-remote-protocol/src/types';

// Entity Values
export const entityData = new BrpStructure(null);
export function onEntityDataChange(path: (TypePath | number)[]) {
  console.log(`${path.join('/')} is changed: ${entityData.get(path)}`);
}

initExtElements();

// Main script
(function () {
  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.cmd) {
      case 'add_component':
        break;
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
