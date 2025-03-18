import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { initExtElements } from './componentsElements';
import { BrpStructurePath, labelFromPath, serializePath } from './lib';
import { BrpObject, BrpValueWrapped, TypePath } from 'bevy-remote-protocol';

// Entity Values
export const entityData = new BrpValueWrapped(null);
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
        loadComponents(message.data);
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
  function loadComponents(data: BrpObject) {
    const componentList = document.querySelector('.component-list');
    if (componentList === null) return 'failure';
    let entityLabel = document.querySelector('#entity-info-id')?.textContent ?? 'unknown';
    if (entityLabel === '') entityLabel = 'unknown';
    if (data === null) return 'success';

    componentList.innerHTML = '';
    for (const componentLabel of Object.keys(data)) {
      const component = parseElements([entityLabel, componentLabel], true, true);
      if (component !== undefined) componentList.appendChild(component);
    }
    return 'success';

    function parseElements(path: BrpStructurePath, isIndexed = false, isComponent = false): HTMLElement {
      const parsed = entityData.get(path);
      // Declaration
      if (typeof parsed === 'number' || typeof parsed === 'boolean' || typeof parsed === 'string' || parsed === null) {
        const declaration = document.createElement('ext-declaration');
        declaration.setAttribute('path', serializePath(path));
        if (isComponent) {
          declaration.setAttribute('hide-label', '');
          const wrapped = document.createElement('ext-expandable');
          wrapped.setAttribute('component', '');
          wrapped.setAttribute('label', labelFromPath(path));
          if (isIndexed) wrapped.setAttribute('indexed', '');
          wrapped.appendChild(declaration);
          return wrapped;
        }
        if (isIndexed) declaration.setAttribute('indexed', '');
        return declaration;
      }

      // Array OR NestedRecord
      const expandable = document.createElement('ext-expandable');
      expandable.setAttribute('label', labelFromPath(path));
      if (isComponent) expandable.setAttribute('component', '');
      if (isIndexed) expandable.setAttribute('indexed', '');

      if (parsed instanceof Array) {
        expandable.setAttribute('array', serializePath(path));
        for (const childLabel of parsed.keys()) {
          const element = parseElements(path.concat(childLabel), true);
          expandable.appendChild(element);
        }
        return expandable;
      }
      if (parsed !== null) {
        for (const childLabel of Object.keys(parsed)) {
          const element = parseElements(path.concat(childLabel));
          expandable.appendChild(element);
        }
        return expandable;
      }
      return document.createElement('ext-declaration');
    }
  }
})();
