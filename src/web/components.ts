//@ts-check

// TODO: import somehow (maybe using importmap)
// import '@vscode-elements/elements/dist/vscode-tree/index.js';

// Styles
const styleButtons = new CSSStyleSheet();
styleButtons.replaceSync(
  dontIndent(`
  .button-collection {
    background-color: var(--vscode-settings-textInputBackground);
    border-radius: inherit;
    bottom: 0px;
    position: absolute;
    right: 0px;
    visibility: hidden;
  }
  button {
    align-items: center;
    background-color: transparent;
    border-radius: inherit;
    border: 0px;
    cursor: pointer;
    display: flex;
    flex: none;
    height: 24px;
    justify-content: center;
    padding-inline: 0px;
    visibility: hidden;
    width: 24px;
  }
  button:active {
    background-color: var(--vscode-toolbar-activeBackground,rgba(99, 102, 103, 0.31));
  }
  button:hover {
    background-color: var(--vscode-toolbar-hoverBackground,rgba(90, 93, 94, 0.31));
  }
  :host(:hover) .button-collection {
    visibility: visible;
  }
  :host(:hover) button {
    visibility: visible;
  }
`)
);
const styleExpandable = new CSSStyleSheet();
styleExpandable.replaceSync(
  dontIndent(`
  details {
    border-radius: 2px;
    width: 100%;

    summary {
      align-items: center;
      column-gap: 6px;      
      display: flex;
      display: flex;
      height: 26px;
      list-style: none;

      span {
        direction: rtl;
        flex: auto;
        overflow: hidden;
        text-align: left;
        white-space: nowrap;
      }
      vscode-icon {
        flex: none;
      }
      div.space {
        height: 16px;
        width: 16px;
      }
    }
    summary:focus {
      outline: none;
    }
    .details-content {
      cursor: default;
      display: flex;
      flex-direction: column;
      padding-top: 4px;
      row-gap: 4px;
    }
  }
  details:hover {
    cursor: pointer;
  }
  details[open] > summary .header-icon {
    transform: rotate(90deg);
  }
`)
);
const styleDeclaration = new CSSStyleSheet();
styleDeclaration.replaceSync(
  dontIndent(`
  :host {
    column-gap: 8px;
    display: flex;
    
    label {
      flex: 3;
      line-height: 18px;
      overflow: hidden;
      padding: 4px 0;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .value {
      flex: 5;
    }
  }
`)
);
const styleInput = new CSSStyleSheet();
styleInput.replaceSync(
  dontIndent(`
  :host {
    align-items: center;
    background-color: var(--vscode-settings-textInputBackground, #313131);
    border-color: var(--vscode-settings-textInputBorder, var(--vscode-settings-textInputBackground, #3c3c3c));
    border-radius: 2px;
    border-style: solid;
    border-width: 1px;
    box-sizing: border-box;
    color: var(--vscode-settings-textInputForeground, #cccccc);
    display: inline-flex;
    position: relative;
    width: 100%;
    
    input {
      background-color: var(--vscode-settings-textInputBackground, #313131);
      border-radius: inherit;
      border: 0px;
      box-sizing: border-box;
      color: var(--vscode-settings-textInputForeground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, "Segoe WPC", "Segoe UI", sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, 'normal');
      line-height: 18px;
      outline: none;
      padding: 3px 4px;
      width: 100%;
    } 
    input.input:focus-visible {
      outline-offset: 0px;
    }
    ::placeholder {
      color: var(--vscode-input-placeholderForeground, #989898);
      opacity: 1;
    }
  }
  :host([focused]) {
    border-color: var(--vscode-focusBorder, #0078d4);
  }
  :host([disabled]) {
    border-color: var(--vscode-settings-textInputBackground);
  }
`)
);
const styleTextArea = new CSSStyleSheet();
styleTextArea.replaceSync(
  dontIndent(`
  textarea {
    background-color: var(--vscode-settings-textInputBackground, #313131);
    border-radius: inherit;
    border: 0px;
    box-sizing: border-box;
    color: var(--vscode-settings-textInputForeground, #cccccc);
    display: block;
    font-family: var(--vscode-font-family, sans-serif);
    font-size: var(--vscode-font-size, 13px);
    font-weight: var(--vscode-font-weight, normal);
    line-height: 18px;
    padding: 3px 4px;
    resize: none;
    text-wrap: nowrap;
    width: 100%;
  }
  textarea:focus {
    outline: none;
  }
  textarea::-webkit-scrollbar { 
    display: none;
  }
`)
);
const styleNumberInput = new CSSStyleSheet();
styleNumberInput.replaceSync(
  dontIndent(`
  input {
    text-align: center;
  }
  button {
    width: unset;
  }
`)
);

// Fun
function labelFromPath(path: string) {
  const labels = path.split('/');
  if (labels.length === 0) {
    console.error('ARR is empty');
    return 'ERRORLABEL';
  }
  const label = labels[labels.length - 1];
  const parts = label.split('.');
  const part = parts[parts.length - 1];
  return part.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
}

function dontIndent(str: string) {
  return ('' + str).replace(/(\n)\s+/g, '$1');
}

// ExtElements
class ExtExpandable extends HTMLElement {
  connectedCallback() {
    const label = this.getAttribute('label') ?? '';
    const readableLabel = label.replace(/::/g, ' :: ');
    const isComponent = this.hasAttribute('component');
    const indent = parseInt(this.parentElement?.getAttribute('indent') ?? '-28') + 22;

    // Detials.summary.chevron
    const chevroon = document.createElement('vscode-icon');
    chevroon.setAttribute('name', 'chevron-right');
    chevroon.setAttribute('class', 'header-icon');

    // Detials.summary.label
    const labelElement = document.createElement('span');
    labelElement.textContent = readableLabel ?? '';

    // Detials.summary
    const summary = document.createElement('summary');
    if (indent >= 0) {
      const indentation = document.createElement('div');
      indentation.style.width = indent.toString() + 'px';
      indentation.className = 'space';
      summary.appendChild(indentation);
    }
    summary.appendChild(chevroon);
    summary.appendChild(labelElement);
    if (isComponent) {
      const icon = document.createElement('vscode-icon');
      icon.setAttribute('name', 'symbol-method');
      icon.setAttribute('class', 'component-type-icon');
      summary.appendChild(icon);
    }

    // Detials.content
    const content = document.createElement('div');
    content.setAttribute('class', 'details-content');
    content.setAttribute('indent', indent.toString());
    content.innerHTML = this.innerHTML;

    // Detials
    const details = document.createElement('details');
    details.setAttribute('open', '');
    details.appendChild(summary);
    details.appendChild(content);

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [styleExpandable];
    shadow.appendChild(details);
  }
}
class ExtDeclaration extends HTMLElement {
  connectedCallback() {
    const path = this.getAttribute('path') ?? '';
    const label = labelFromPath(path);
    const hideLabel = this.hasAttribute('hide-label');
    const value = entityData.get(path);
    if (!(typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string')) {
      console.error('VALUE is not basic type');
      return;
    }

    // Initialize elements
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', path);
    labelElement.textContent = hideLabel ? '' : label;

    const valueHolder = document.createElement('div');
    valueHolder.classList.add('value');

    switch (typeof value) {
      case 'number': {
        const number = document.createElement('ext-number');
        number.id = path;
        valueHolder.appendChild(number);
        break;
      }

      case 'boolean': {
        const checkbox = document.createElement('ext-boolean');
        checkbox.id = path;
        valueHolder.appendChild(checkbox);
        break;
      }

      case 'string': {
        const text = document.createElement('ext-string');
        text.id = path;
        valueHolder.appendChild(text);
        break;
      }
    }

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [styleDeclaration];
    shadow.appendChild(labelElement);
    shadow.appendChild(valueHolder);
  }
}
class ExtValue extends HTMLElement {
  get value() {
    if (!entityData.has(this.id)) {
      console.error(`${this.id} => this path not in table`);
      return;
    }
    return entityData.get(this.id);
  }

  set value(v) {
    if (!entityData.has(this.id)) {
      console.error(`${this.id} => this path not in table`);
      return;
    }
    const previous = entityData.get(this.id);
    if (typeof v !== typeof previous) {
      console.error(`${this.id} => types of newValue and oldValue don't match`);
      return;
    }
    if (typeof v === 'number' && !Number.isFinite(v)) {
      console.error(`${this.id} => number is not finite`);
      return;
    }
    entityData.set(this.id, v);
    if (previous !== v) onEntityDataChange(this.id);
  }
}
class ExtString extends ExtValue {
  connectedCallback() {
    const placeholder = this.getAttribute('placeholder');
    const isDisabled = this.hasAttribute('disabled');

    // Initialize field input
    const field = document.createElement('input');
    field.setAttribute('type', 'text');
    field.setAttribute('placeholder', placeholder ?? '');
    if (isDisabled) field.setAttribute('disabled', '');

    // Initialize area input
    const area = document.createElement('textarea');
    if (isDisabled) area.setAttribute('disabled', '');
    area.setAttribute('rows', '5');

    // Initialize buttons
    const toArea = document.createElement('button');
    const iconArea = document.createElement('vscode-icon');
    iconArea.setAttribute('name', 'list-selection');
    toArea.appendChild(iconArea);

    const toField = document.createElement('button');
    toField.className = 'inArea';
    const iconField = document.createElement('vscode-icon');
    iconField.setAttribute('name', 'symbol-string');
    toField.appendChild(iconField);

    const buttonCollection = document.createElement('div');
    buttonCollection.setAttribute('class', 'button-collection');
    buttonCollection.appendChild(toArea);
    buttonCollection.appendChild(toField);

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [styleButtons, styleInput, styleTextArea];

    shadow.appendChild(area);
    shadow.appendChild(field);
    if (!isDisabled) shadow.appendChild(buttonCollection);

    // Switchers
    toArea.onclick = () => {
      area.value = this.value;

      area.style.removeProperty('display');
      toField.style.removeProperty('display');
      field.style.display = 'none';
      toArea.style.display = 'none';
    };
    toField.onclick = () => {
      field.value = this.value;

      area.style.display = 'none';
      toField.style.display = 'none';
      field.style.removeProperty('display');
      toArea.style.removeProperty('display');
    };

    // Set initial mode
    if (this.value.indexOf('\n') > -1) {
      toArea.onclick(new MouseEvent(''));
    } else {
      toField.onclick(new MouseEvent(''));
    }

    // Logics of area
    area.oninput = () => {
      area.style.height = 'auto';
      area.style.height = area.scrollHeight + 'px';
    };
    area.onfocus = () => {
      this.setAttribute('focused', '');
    };
    area.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        area.value = this.value;
        area.blur();
        e.preventDefault();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        area.blur();
      }
    };
    area.onchange = () => {
      this.value = area.value;
      area.blur();
    };
    area.onblur = () => {
      area.value = this.value;
      area.scrollTo(0, 0);
      this.removeAttribute('focused');
    };

    // Logics of field
    field.onfocus = () => {
      this.setAttribute('focused', '');
    };
    field.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        field.value = this.value;
        field.blur();
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        field.blur();
      }
    };
    field.onchange = () => {
      this.value = field.value;
      field.blur();
    };
    field.onblur = () => {
      field.value = this.value;
      this.removeAttribute('focused');
    };
  }
}
class ExtNumber extends ExtValue {
  getValueAsView() {
    return this.value.toString();
  }

  getValueAsEdit() {
    return this.value.toLocaleString(undefined, {
      style: 'decimal',
      useGrouping: false,
      maximumFractionDigits: 30,
    });
  }

  connectedCallback() {
    const isDisabled = this.hasAttribute('disabled');

    // Initialize elements
    const decreaseButton = document.createElement('button');
    const decreaseIcon = document.createElement('vscode-icon');
    decreaseIcon.setAttribute('name', 'chevron-left');
    decreaseButton.appendChild(decreaseIcon);

    const increaseButton = document.createElement('button');
    const increaseIcon = document.createElement('vscode-icon');
    increaseIcon.setAttribute('name', 'chevron-right');
    increaseButton.appendChild(increaseIcon);

    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    if (isDisabled) input.setAttribute('disabled', '');
    input.value = this.value.toString();

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [styleButtons, styleInput, styleNumberInput];
    if (!isDisabled) shadow.appendChild(decreaseButton);
    shadow.appendChild(input);
    if (!isDisabled) shadow.appendChild(increaseButton);

    // Logics of buttons
    decreaseButton.onclick = () => {
      this.value -= 1;
      input.value = this.getValueAsView();
    };
    increaseButton.onclick = () => {
      this.value += 1;
      input.value = this.getValueAsView();
    };

    // Logics of input
    input.onfocus = () => {
      input.value = this.getValueAsEdit();
      this.setAttribute('focused', '');
    };
    input.onkeydown = (e) => {
      if (!('key' in e)) {
        return;
      }
      if (e.key === 'Escape' || e.key === 'Esc') {
        input.value = this.getValueAsView();
        input.blur();
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        input.blur();
      }
    };
    input.onchange = () => {
      this.value = parseFloat(input.value);
      input.blur();
    };
    input.onblur = () => {
      input.value = this.getValueAsView();
      this.removeAttribute('focused');
    };
  }
}
class ExtBoolean extends ExtValue {
  connectedCallback() {
    const isDisabled = this.hasAttribute('disabled');

    // Initialize elements
    const checkbox = document.createElement('vscode-checkbox');
    if (isDisabled) checkbox.setAttribute('disabled', '');
    if (this.value) {
      checkbox.setAttribute('checked', '');
    }

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(checkbox);

    // Logics
    const observer = new MutationObserver(() => {
      this.value = checkbox.hasAttribute('checked');
    });
    observer.observe(checkbox, { attributes: true, attributeFilter: ['checked'] });
  }
}

// Entity Values
const entityData = new Map();
function onEntityDataChange(path?: string) {
  if (path !== undefined && entityData.has(path)) {
    console.log(`${path} is set to ${entityData.get(path)}`);
    return;
  }
  console.log(entityData);
}

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

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
        update(message.data);
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
  function update(data: JsonObject) {
    const componentList = document.querySelector('.component-list');
    if (componentList === null) return 'failure';
    let entityLabel = document.querySelector('#entity-info-id')?.textContent ?? 'unknown';
    if (entityLabel === '') entityLabel = 'unknown';
    if (data === null) return 'success';

    componentList.innerHTML = '';
    for (const [componentLabel, componentValue] of Object.entries(data)) {
      console.log(`component: ${componentLabel}`);
      const component = parseElements(entityLabel + '/' + componentLabel, componentValue, true);
      if (component !== undefined) componentList.appendChild(component);
    }
    return 'success';

    function parseElements(path: string, parsed: JsonValue, isComponent = false): HTMLElement {
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
          wrapped.appendChild(declaration);
          return wrapped;
        }
        return declaration;
      }

      // Array OR NestedRecord
      const groupElem = document.createElement('ext-expandable');
      groupElem.setAttribute('label', labelFromPath(path));
      if (isComponent) groupElem.setAttribute('component', '');

      if (parsed instanceof Array) {
        for (const childLabel of parsed.keys()) {
          const element = parseElements(path + '.' + childLabel, parsed[childLabel]);
          groupElem.appendChild(element);
        }
        return groupElem;
      }
      if (parsed !== null) {
        for (const [childLabel, childValue] of Object.entries(parsed)) {
          const element = parseElements(path + '/' + childLabel, childValue);
          groupElem.appendChild(element);
        }
        return groupElem;
      }
      return document.createElement('ext-expandable');
    }
  }
  const updateStatus = update({
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

  customElements.define('ext-expandable', ExtExpandable);
  customElements.define('ext-declaration', ExtDeclaration);
  customElements.define('ext-string', ExtString);
  customElements.define('ext-number', ExtNumber);
  customElements.define('ext-boolean', ExtBoolean);

  // EXPERIMENTAL
  const rowGap = 5;
  let draggableHeight = 40;

  const dragList = document.querySelector('#section-experimental');
  if (!(dragList instanceof HTMLDivElement)) {
    return;
  }

  const draggables = dragList.querySelectorAll('.draggable');
  if (draggables === null) return;

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
})();
