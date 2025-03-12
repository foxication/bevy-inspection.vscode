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
      color: var(--vscode-settings-textInputForeground, #cccccc);
      display: block;
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      font-weight: var(--vscode-font-weight, normal);
      width: 100%;
      line-height: 18px;
      padding: 3px 4px;
      padding-bottom: 9px;
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

    div {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex: none;
      border-radius: inherit;
    }
    div:hover {
      background-color: var(--vscode-toolbar-hoverBackground,rgba(90, 93, 94, 0.31));
    }
    div:active {
      background-color: var(--vscode-toolbar-activeBackground,rgba(99, 102, 103, 0.31));
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
      const toParse = data[componentLabel];
      const component = document.createElement('ext-component');
      component.setAttribute('label', componentLabel);

      const componentPath = entityLabel + '/' + componentLabel;

      if (typeof toParse === 'number' || typeof toParse === 'boolean' || typeof toParse === 'string') {
        const element = parseElement(componentPath, toParse, true);
        if (element instanceof HTMLElement) component.appendChild(element);
      }
      if (typeof toParse === 'object') {
        for (const childLabel of Object.keys(toParse)) {
          const element = parseElement(componentPath + '/' + childLabel, toParse[childLabel]);
          if (!(element instanceof HTMLElement)) {
            console.error('ELEMENT is not an HTMLELEMENT');
            console.error(element);
            continue;
          }
          component.appendChild(element);
        }
      }
      componentList.appendChild(component);
    }

    return 'success';

    function parseElement(path, parsed, hideLabel) {
      if (typeof path !== 'string') {
        console.error('PATH is not a STRING');
        return [];
      }
      switch (typeof parsed) {
        case 'number':
          entityData.set(path, parsed);
          const declareNumber = document.createElement('ext-declaration');
          declareNumber.setAttribute('path', path);
          declareNumber.setAttribute('type', 'number');
          if (hideLabel === true) declareNumber.setAttribute('hide-label', '');
          return declareNumber;

        case 'boolean':
          entityData.set(path, parsed);
          const declareBool = document.createElement('ext-declaration');
          declareBool.setAttribute('path', path);
          declareBool.setAttribute('type', 'boolean');
          if (hideLabel === true) declareBool.setAttribute('hide-label', '');
          return declareBool;

        case 'string':
          entityData.set(path, parsed);
          const declareString = document.createElement('ext-declaration');
          declareString.setAttribute('path', path);
          declareString.setAttribute('type', 'string');
          if (hideLabel === true) declareString.setAttribute('hide-label', '');
          return declareString;

        case 'object':
          const parentLabel = labelFromPath(path);
          if (parsed instanceof Array) {
            entityData.set(path, 'THERE MUST BE ARRAY');
            const declareString = document.createElement('ext-declaration');
            declareString.setAttribute('type', 'string');
            return declareString;
          }
          if (parsed instanceof Object) {
            const groupElem = document.createElement('ext-group');
            groupElem.setAttribute('label', parentLabel);

            for (const childLabel of Object.keys(parsed)) {
              const element = parseElement(path + '/' + childLabel, parsed[childLabel]);
              if (!(element instanceof HTMLElement)) {
                console.error('ELEMENT is not an HTMLELEMENT');
                console.error(element);
                continue;
              }
              groupElem.appendChild(element);
            }
            return groupElem;
          }
      }
      return undefined;
    }
  }

  const updateStatus = update({
    'component::One': {
      name: 'Alexa',
      sex: 'male',
      age: 2929,
      status: 'dead',
      'is human': true,
    },
    'component::Two': {
      world: {
        russia: {
          moscow: 'ulitsa Minskaya',
        },
      },
    },
    'component::Simple': 'Hello, World!',
  });
  console.log(updateStatus ?? 'failure');
  console.log(entityData);

  // Define custom elements
  customElements.define(
    'ext-component',
    class ExtComponent extends HTMLElement {
      connectedCallback() {
        const label = this.getAttribute('label') ?? '';
        const readable = label.replaceAll('::', ' :: ');

        // Initialize elements
        const chevron = document.createElement('vscode-icon');
        chevron.setAttribute('name', 'chevron-right');
        chevron.setAttribute('class', 'header-icon');
        const labelElement = document.createElement('span');
        labelElement.textContent = readable;
        const symbol = document.createElement('vscode-icon');
        symbol.setAttribute('name', 'symbol-method');
        symbol.setAttribute('class', 'component-type-icon');

        const summary = document.createElement('summary');
        summary.appendChild(chevron);
        summary.appendChild(labelElement);
        summary.appendChild(symbol);
        const content = document.createElement('div');
        content.setAttribute('class', 'details-content');
        content.innerHTML = this.innerHTML;
        const details = document.createElement('details');
        details.appendChild(summary);
        details.appendChild(content);

        const shadow = this.attachShadow({ mode: 'open' });
        shadow.adoptedStyleSheets = [styleForExpandable];
        shadow.append(details);
      }
    }
  );

  customElements.define(
    'ext-group',
    class ExtGroup extends HTMLElement {
      connectedCallback() {
        const label = this.getAttribute('label');
        const indent = parseInt(this.parentElement?.getAttribute('indent') ?? '-6') + 22;

        // Initialize elements
        const indentation = document.createElement('div');
        indentation.style.width = indent.toString() + 'px';
        indentation.className = 'space';
        const icon = document.createElement('vscode-icon');
        icon.setAttribute('name', 'chevron-right');
        icon.setAttribute('class', 'header-icon');
        const labelElement = document.createElement('span');
        labelElement.innerText = label ?? '';
        const summary = document.createElement('summary');
        summary.appendChild(indentation);
        summary.appendChild(icon);
        summary.appendChild(labelElement);
        const content = document.createElement('div');
        content.setAttribute('class', 'details-content');
        content.setAttribute('indent', indent.toString());
        content.innerHTML = this.innerHTML;
        const details = document.createElement('details');
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
        const type = this.getAttribute('type');
        const hideLabel = this.hasAttribute('hide-label');

        // Initialize elements
        const labelElement = document.createElement('label');
        labelElement.setAttribute('for', path);
        labelElement.innerText = hideLabel ? '' : label;

        const valueHolder = document.createElement('div');
        valueHolder.classList.add('value');

        switch (type) {
          case 'boolean':
            const checkbox = document.createElement('vscode-checkbox');
            checkbox.id = path;
            valueHolder.appendChild(checkbox);
            break;

          case 'enum':
            const select = document.createElement('vscode-single-select');
            select.id = path;
            select.innerHTML = this.innerHTML;
            valueHolder.appendChild(select);
            break;

          default: // string
            const text = document.createElement('ext-text');
            text.id = path;
            valueHolder.appendChild(text); // TODO: somehow update value
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

  customElements.define(
    'ext-text',
    class ExtText extends HTMLElement {
      inEdit = false;

      get value() {
        if (!entityData.has(this.id)) {
          console.error(`No such PATH (${this.id}) to get value`);
        }
        return entityData.get(this.id) ?? '';
      }

      set value(v) {
        if (entityData.has(this.id)) {
          entityData.set(this.id, v);
          return;
        }
        console.error(`No such PATH (${this.id}) to overwrite value`);
      }

      connectedCallback() {
        const placeholder = this.getAttribute('placeholder');
        const isDisabled = this.hasAttribute('disabled');

        // Initialize elements of input
        const field = document.createElement('input');
        field.setAttribute('type', 'text');
        field.setAttribute('placeholder', placeholder ?? '');
        if (isDisabled) field.setAttribute('disabled', '');

        const toArea = document.createElement('div');
        const iconArea = document.createElement('vscode-icon');
        iconArea.setAttribute('name', 'list-selection');
        toArea.appendChild(iconArea);

        // Initialize elements of textarea
        const area = document.createElement('textarea');
        if (isDisabled) area.setAttribute('disabled', '');
        area.setAttribute('rows', '5');

        const toField = document.createElement('div');
        toField.className = 'inArea';
        const iconField = document.createElement('vscode-icon');
        iconField.setAttribute('name', 'symbol-string');
        toField.appendChild(iconField);

        // Initialize shadow DOM
        const shadow = this.attachShadow({ mode: 'open', delegatesFocus: true });
        shadow.adoptedStyleSheets = [styleForTextInput];

        shadow.appendChild(area);
        shadow.appendChild(field);
        if (!isDisabled) {
          shadow.appendChild(toField);
          shadow.appendChild(toArea);
        }

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

        switch (this.getAttribute('type')) {
          case 'area':
            toArea.onclick(new MouseEvent(''));
            break;

          default:
            toField.onclick(new MouseEvent(''));
            break;
        }

        // Logics of area
        area.oninput = (e) => {
          area.style.height = 'auto';
          area.style.height = area.scrollHeight + 'px';
        };
        area.onfocus = (e) => {
          this.setAttribute('focused', '');
          this.inEdit = true;
        };
        area.onchange = () => {
          this.value = area.value;
          if (this.inEdit) {
            area.blur();
          }
        };
        area.onblur = () => {
          area.value = this.value;
          area.scrollTo(0, 0);
          this.removeAttribute('focused');
          this.inEdit = false;
        };

        // Logics of field
        field.onfocus = (e) => {
          this.setAttribute('focused', '');
          this.inEdit = true;
        };
        field.onkeydown = (e) => {
          if (!('key' in e)) {
            return;
          }
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
          if (this.inEdit) {
            field.blur();
          }
        };
        field.onblur = () => {
          field.value = this.value;
          this.removeAttribute('focused');
          this.inEdit = false;
        };
      }
    }
  );
})();

function labelFromPath(path) {
  const arr = path.split('/');
  if (arr.length === 0) {
    console.error('ARR is empty');
    return 'ERRORLABEL';
  }
  const label = arr[arr.length - 1];
  return label.replace(/(^\w{1})|(\s+\w{1})/g, (letter) => letter.toUpperCase());
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
