import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { initExtElements } from './componentsElements';
import { JsonObject, JsonValue, labelFromPath, RealValue } from './lib';

// Entity Values
export const entityData = new Map<string, RealValue>();
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
  function loadComponents(data: JsonObject) {
    const componentList = document.querySelector('.component-list');
    if (componentList === null) return 'failure';
    let entityLabel = document.querySelector('#entity-info-id')?.textContent ?? 'unknown';
    if (entityLabel === '') entityLabel = 'unknown';
    if (data === null) return 'success';

    componentList.innerHTML = '';
    for (const [componentLabel, componentValue] of Object.entries(data)) {
      console.log(`component: ${componentLabel}`);
      const component = parseElements(entityLabel + '/' + componentLabel, componentValue, true, true);
      if (component !== undefined) componentList.appendChild(component);
    }
    return 'success';

    function parseElements(path: string, parsed: JsonValue, isIndexed = false, isComponent = false): HTMLElement {
      console.log(`parsing: ${parsed}`);

      // Declaration
      if (typeof parsed === 'number' || typeof parsed === 'boolean' || typeof parsed === 'string') {
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
        for (const childLabel of parsed.keys()) {
          const element = parseElements(path + '.' + childLabel, parsed[childLabel], true);
          expandable.appendChild(element);
        }
        return expandable;
      }
      if (parsed !== null) {
        for (const [childLabel, childValue] of Object.entries(parsed)) {
          const element = parseElements(path + '/' + childLabel, childValue);
          expandable.appendChild(element);
        }
        return expandable;
      }
      return document.createElement('ext-expandable');
    }
  }
  const updateStatus = loadComponents({
    'component::AllInputs': {
      name: 'Alexa',
      age: 0.314,
      status: 'dead\nalive\nghost',
      isHuman: true,
      password: [1, 6, 2, 5, 6, 3],
      favorite: ['ice cream', 'fox', 'sun', 'knifes'],
      coin: [true, true, false, true, false],
    },
    'component::Nesting': {
      world: {
        russia: {
          moscow: 'ulitsa Minskaya',
        },
      },
    },
    'component::DislabeledDeclaration': 'Hello, World!',
    'component::DislabeledArray': ['Lorem', 'ipsum', 'dolor'],
    'component::ArrayOfObjects': [
      { name: 'Revolver', bullets: 12, damage: 80 },
      { name: 'Bomb', bullets: 1, damage: 200 },
      { name: 'Rocket Launcher', bullets: 4, damage: 120 },
    ],
    'component::AnotherArray': [{ hello: 'simple' }],
  });
  console.log(updateStatus ?? 'failure');
  onEntityDataChange(); // log whole table
})();

// EXPERIMENTAL
let draggableHeight = 40;

const rowGap = 5;
const dragList = document.querySelector('#section-experimental');
const draggables = dragList?.querySelectorAll('.draggable');

if (dragList instanceof HTMLDivElement && draggables !== undefined) {
  draggables.forEach((draggable) => {
    const dragHandle = draggable.querySelector('div.dragHandle') as HTMLDivElement;
    if (!(draggable instanceof HTMLDivElement)) return;
    draggable.style.height = draggableHeight + 'px';

    // exponential
    draggableHeight += 30;

    dragHandle.onpointerdown = (e) => {
      // Style
      dragHandle.setPointerCapture(e.pointerId);
      draggable.style.zIndex = '1';

      // Variables
      let minOffset = -draggable.offsetTop;
      let maxOffset = minOffset + dragList.offsetHeight - draggable.offsetHeight;
      let initialClientY = e.clientY;

      let prevSibling: Element | null;
      let nextSibling: Element | null;
      const updateSiblings = () => {
        prevSibling = draggable.previousElementSibling;
        nextSibling = draggable.nextElementSibling;
      };
      updateSiblings();

      dragHandle.onpointermove = (e) => {
        const position = () => {
          return Math.min(Math.max(e.clientY - initialClientY, minOffset), maxOffset);
        };

        let isTreeChanged = false;
        if (prevSibling instanceof HTMLDivElement) {
          const prevShift = prevSibling.offsetHeight + rowGap;
          if (position() <= -prevShift) {
            initialClientY -= prevShift;
            minOffset += prevShift;
            maxOffset += prevShift;

            dragList.removeChild(draggable);
            dragList.insertBefore(draggable, prevSibling);
            isTreeChanged = true;
          }
        }
        if (nextSibling instanceof HTMLDivElement) {
          const nextShift = nextSibling.offsetHeight + rowGap;
          if (position() >= nextShift) {
            initialClientY += nextShift;
            minOffset -= nextShift;
            maxOffset -= nextShift;

            dragList.removeChild(draggable);
            dragList.insertBefore(draggable, nextSibling.nextSibling);
            isTreeChanged = true;
          }
        }
        if (isTreeChanged) {
          updateSiblings();
          dragHandle.setPointerCapture(e.pointerId); // restore
        }
        draggable.style.top = position() + 'px';
      };

      dragHandle.onpointerup = () => {
        // pointer automatically releases on onpointerup
        dragHandle.onpointermove = null;
        dragHandle.onpointerup = null;

        draggable.style.removeProperty('top');
        draggable.style.removeProperty('z-index');
      };
    };
  });
}
