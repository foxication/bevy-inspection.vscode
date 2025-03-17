import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { initExtElements } from './componentsElements';
import { labelFromPath } from './lib';
import { BrpObject, BrpValue } from 'bevy-remote-protocol';

// Entity Values
export const entityData = new Map<string, BrpValue>();
export function onEntityDataChange(path?: string) {
  if (path !== undefined && entityData.has(path)) {
    console.log(`${path} is set to ${entityData.get(path)}`);
    return;
  }
  console.log(entityData);
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
    for (const [componentLabel, componentValue] of Object.entries(data)) {
      const component = parseElements(entityLabel + '/' + componentLabel, componentValue as BrpObject, true, true);
      if (component !== undefined) componentList.appendChild(component);
    }
    return 'success';

    function parseElements(path: string, parsed: BrpObject, isIndexed = false, isComponent = false): HTMLElement {
      // Declaration
      if (typeof parsed === 'number' || typeof parsed === 'boolean' || typeof parsed === 'string' || parsed === null) {
        entityData.set(path, parsed);
        const declaration = document.createElement('ext-declaration');
        declaration.setAttribute('path', path);
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
        expandable.setAttribute('array', path);
        for (const childLabel of parsed.keys()) {
          const element = parseElements(path + '.' + childLabel, parsed[childLabel], true);
          expandable.appendChild(element);
        }
        return expandable;
      }
      if (parsed !== null) {
        for (const [childLabel, childValue] of Object.entries(parsed)) {
          const element = parseElements(path + '/' + childLabel, childValue as BrpObject);
          expandable.appendChild(element);
        }
        return expandable;
      }
      return document.createElement('ext-declaration');
    }
  }
})();
