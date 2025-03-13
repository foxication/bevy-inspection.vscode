//@ts-check

// TODO: import somehow (maybe using importmap)
// import '@vscode-elements/elements/dist/vscode-tree/index.js';

// Styles
const styleForExpandable = new CSSStyleSheet();
styleForExpandable.replaceSync(
  dontIndent(`
  details {
    width: 100%;
    border-radius: 2px;
    
    summary {
      display: flex;
      column-gap: 6px;
      
      list-style: none;
      display: flex;
      height: 26px;
      align-items: center;
    
      span {
        overflow: hidden;
        white-space: nowrap;
        direction: rtl;
        text-align: left;
        flex: auto;
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
      padding-top: 4px;
      display: flex;
      flex-direction: column;
      row-gap: 4px;
    }
  }
  details:hover {
    cursor: pointer;
  }
  details[open]>summary {
    .header-icon {
      transform: rotate(90deg);
    }
  }`)
);
const styleForDeclaration = new CSSStyleSheet();
styleForDeclaration.replaceSync(
  dontIndent(`
  :host {
    display: flex;
    column-gap: 8px;

    label {
      flex: 3;
      text-align: right;
      text-overflow: ellipsis;
      line-height: 18px;
      white-space: nowrap;
      overflow: hidden;
      padding: 4px 0;
    }
    div.value {
      flex: 5;

      vscode-checkbox {
        width: 100%;
      }
      vscode-single-select {
        width: 100%;
      }
    }
  }`)
);
const styleForTextInput = new CSSStyleSheet();
styleForTextInput.replaceSync(
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
      border: 0px;
      border-radius: inherit;
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
    
    textarea {
      background-color: var(--vscode-settings-textInputBackground, #313131);
      box-sizing: border-box;
      border-radius: inherit;
      color: var(--vscode-settings-textInputForeground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      width: 100%;
      line-height: 18px;
      padding: 3px 4px;
      text-wrap: nowrap;
      resize: none;
      border: 0px;
    }
    textarea:focus {
      outline: none;
    }
    textarea::-webkit-scrollbar { 
      display: none;
    }
    
    ::placeholder {
      color: var(--vscode-input-placeholderForeground, #989898);
      opacity: 1;
    }
    div.button-background {
      background-color: var(--vscode-settings-textInputBackground);
      visibility: hidden;
      position: absolute;
      bottom: 0px;
      right: 0px;
      border-radius: inherit;

      button {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex: none;
        border-radius: inherit;
        border: 0px;
        background-color: transparent;
      }
      button:hover {
        background-color: var(--vscode-toolbar-hoverBackground,rgba(90, 93, 94, 0.31));
      }
      button:active {
        background-color: var(--vscode-toolbar-activeBackground,rgba(99, 102, 103, 0.31));
      }
    }
  }
  :host(:hover) div.button-background {
    visibility: visible;
  }
  :host([focused]) {
    border-color: var(--vscode-focusBorder, #0078d4);
  }
  :host([focused]) {
    border-color: var(--vscode-focusBorder, #0078d4);
  }
  :host([disabled]) {
    border-color: var(--vscode-settings-textInputBackground);
  }
  `)
);
const styleForNumberInput = new CSSStyleSheet();
styleForNumberInput.replaceSync(
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
      border: 0px;
      box-sizing: border-box;
      color: var(--vscode-settings-textInputForeground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, "Segoe WPC", "Segoe UI", sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, 'normal');
      line-height: 18px;
      outline: none;
      padding: 3px 0px;
      width: 100%;
      text-align: center;
    }
      
    input.input:focus-visible {
      outline-offset: 0px;
    }
    
    ::placeholder {
      color: var(--vscode-input-placeholderForeground, #989898);
      opacity: 1;
    }

    button {
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex: none;
      border-radius: inherit;
      border: 0px;
      background-color: transparent;
      visibility: hidden;
      padding-inline: 0px;
    }
    button:hover {
      background-color: var(--vscode-toolbar-hoverBackground,rgba(90, 93, 94, 0.31));
    }
    button:active {
      background-color: var(--vscode-toolbar-activeBackground,rgba(99, 102, 103, 0.31));
    }
  }
  :host(:hover) {
    button {
      visibility: visible;
    }
  }
  :host([focused]) {
    border-color: var(--vscode-focusBorder, #0078d4);
  }
  :host([focused]) {
    border-color: var(--vscode-focusBorder, #0078d4);
  }
  :host([disabled]) {
    border-color: var(--vscode-settings-textInputBackground);
  }
  `)
);

const entityData = new Map();

(function () {
  // const vscode = acquireVsCodeApi();

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

  function setEntityInfo(host, entityId) {
    const hostLabel = document.querySelector('#entity-info-host');
    if (hostLabel instanceof Element) {
      hostLabel.textContent = host;
    }

    const idLabel = document.querySelector('#entity-info-id');
    if (idLabel instanceof Element) {
      idLabel.textContent = entityId;
    }
  }
  function update(data) {
    const componentList = document.querySelector('.component-list');
    let entityLabel = document.querySelector('#entity-info-id')?.textContent ?? 'unknown';
    if (entityLabel === '') entityLabel = 'unknown';
    if (componentList === null) {
      console.error('No .component-list OR #entity-info-id');
      return;
    }

    componentList.innerHTML = '';
    for (const componentLabel of Object.keys(data)) {
      const component = parseElements(entityLabel + '/' + componentLabel, data[componentLabel], true);
      if (component !== undefined) componentList.appendChild(component);
    }
    return 'success';

    function parseElements(path, parsed, isComponent) {
      if (typeof path !== 'string') {
        console.error('PATH is not a STRING');
        return undefined;
      }
      // Declaration
      if (typeof parsed === 'number' || typeof parsed === 'boolean' || typeof parsed === 'string') {
        entityData.set(path, parsed);
        const declaration = document.createElement('ext-declaration');
        declaration.setAttribute('path', path);
        if (isComponent === true) {
          declaration.setAttribute('hide-label', '');
          const wrapped = document.createElement('ext-expandable');
          wrapped.setAttribute('component', '');
          wrapped.setAttribute('label', labelFromPath(path));
          wrapped.appendChild(declaration);
          return wrapped;
        }
        return declaration;
      }

      // Object
      if (parsed instanceof Object) {
        const isArray = parsed instanceof Array;
        const groupElem = document.createElement('ext-expandable');
        groupElem.setAttribute('label', labelFromPath(path));
        if (isComponent) groupElem.setAttribute('component', '');

        for (const childLabel of Object.keys(parsed)) {
          const separator = isArray ? '.' : '/';
          const element = parseElements(path + separator + childLabel, parsed[childLabel]);
          if (!(element instanceof HTMLElement)) {
            console.error(`ELEMENT (${element}) is not an HTMLELEMENT`);
            continue;
          }
          groupElem.appendChild(element);
        }
        return groupElem;
      }

      // Unknown
      console.error('cannot parse VALUE');
      return undefined;
    }
  }
  function onEntityDataChange(path) {
    if (entityData.has(path)) {
      console.log(`${path} is set to ${entityData.get(path)}`);
      return;
    }
    console.log(entityData);
  }

  const updateStatus = update({
    'component::AllInputs': {
      name: 'Alexa',
      age: 0.314,
      status: 'dead\nalive\nghost',
      is_human: true,
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
  });
  console.log(updateStatus ?? 'failure');
  onEntityDataChange();

  customElements.define(
    'ext-expandable',
    class ExtGroup extends HTMLElement {
      connectedCallback() {
        const label = this.getAttribute('label') ?? '';
        const readableLabel = label.replaceAll('::', ' :: ');
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
        shadow.adoptedStyleSheets = [styleForExpandable];
        shadow.appendChild(details);
      }
    }
  );

  customElements.define(
    'ext-declaration',
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
          case 'number':
            const number = document.createElement('ext-number');
            number.id = path;
            valueHolder.appendChild(number);
            break;

          case 'boolean':
            const checkbox = document.createElement('vscode-checkbox');
            checkbox.id = path;
            valueHolder.appendChild(checkbox);
            break;

          case 'string':
            const text = document.createElement('ext-text');
            text.id = path;
            valueHolder.appendChild(text);
            break;
        }

        // Create shadow DOM
        const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
        shadow.adoptedStyleSheets = [styleForDeclaration];
        shadow.appendChild(labelElement);
        shadow.appendChild(valueHolder);
      }
    }
  );

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
      onEntityDataChange(this.id);
    }
  }

  customElements.define(
    'ext-text',
    class ExtText extends ExtValue {
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

        const buttonHolder = document.createElement('div');
        buttonHolder.setAttribute('class', 'button-background');
        buttonHolder.appendChild(toArea);
        buttonHolder.appendChild(toField);

        // Initialize shadow DOM
        const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
        shadow.adoptedStyleSheets = [styleForTextInput];

        shadow.appendChild(area);
        shadow.appendChild(field);
        if (!isDisabled) shadow.appendChild(buttonHolder);

        // Switchers
        toArea.onclick = (e) => {
          area.value = this.value;

          area.style.removeProperty('display');
          toField.style.removeProperty('display');
          field.style.display = 'none';
          toArea.style.display = 'none';
        };
        toField.onclick = (e) => {
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
        area.oninput = (e) => {
          area.style.height = 'auto';
          area.style.height = area.scrollHeight + 'px';
        };
        area.onfocus = (e) => {
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
        field.onfocus = (e) => {
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
  );

  customElements.define(
    'ext-number',
    class ExtText extends ExtValue {
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
        const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
        shadow.adoptedStyleSheets = [styleForNumberInput];

        if (!isDisabled) shadow.appendChild(decreaseButton);
        shadow.appendChild(input);
        if (!isDisabled) shadow.appendChild(increaseButton);

        // Logics of buttons
        decreaseButton.onclick = (e) => {
          this.value -= 1;
          input.value = this.getValueAsView();
        };
        increaseButton.onclick = (e) => {
          this.value += 1;
          input.value = this.getValueAsView();
        };

        // Logics of input
        input.onfocus = (e) => {
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
  );
})();

function labelFromPath(path) {
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

function dontIndent(str) {
  return ('' + str).replace(/(\n)\s+/g, '$1');
}

function fullPath(parentPath, path) {
  let full = parentPath ?? '';
  if (typeof path === 'string' && typeof parentPath === 'string') {
    full += '.';
  }
  full += path ?? '';

  return full;
}
