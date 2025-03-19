import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { ExtDeclaration, ExtExpandable, initExtElements } from './componentsElements';
import { BrpObject, BrpStructure, BrpStructurePath, TypePath } from 'bevy-remote-protocol/src/types';

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

    for (const componentLabel of Object.keys(entityData.get() as BrpObject)) {
      const component = parseElements([componentLabel], 0);
      if (component !== undefined) componentList.appendChild(component);
    }
    return 'success';

    function parseElements(path: BrpStructurePath, level: number): HTMLElement {
      const parsed = entityData.get(path);
      const isComponent = level === 0;
      const isMovable = entityData.get(path.slice(0, -1)) instanceof Array || isComponent;

      // Declaration
      if (typeof parsed === 'number' || typeof parsed === 'boolean' || typeof parsed === 'string' || parsed === null) {
        const declaration = document.createElement('ext-declaration') as ExtDeclaration;
        declaration.path = path;
        if (isComponent) {
          declaration.setAttribute('hide-label', '');
          const wrapped = document.createElement('ext-expandable') as ExtExpandable;
          wrapped.setAttribute('component', '');
          wrapped.path = path;
          if (isMovable) wrapped.setAttribute('indexed', '');
          wrapped.appendChild(declaration);
          return wrapped;
        }
        if (isMovable) declaration.setAttribute('indexed', '');
        return declaration;
      }

      // Array OR NestedRecord
      const expandable = document.createElement('ext-expandable') as ExtExpandable;
      expandable.path = path;
      if (isComponent) expandable.setAttribute('component', '');
      if (isMovable) expandable.setAttribute('indexed', '');

      if (parsed instanceof Array) {
        expandable.path = path;
        for (const childLabel of parsed.keys()) {
          const element = parseElements(path.concat(childLabel), level + 1);
          expandable.appendChild(element);
        }
        return expandable;
      }
      if (parsed !== null) {
        for (const childLabel of Object.keys(parsed ?? {})) {
          const element = parseElements(path.concat(childLabel), level + 1);
          expandable.appendChild(element);
        }
        return expandable;
      }
      return document.createElement('ext-declaration');
    }
  }
})();
