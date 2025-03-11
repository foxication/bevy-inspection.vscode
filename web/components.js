//@ts-check

// TODO: import somehow (maybe using importmap)
// import '@vscode-elements/elements/dist/vscode-tree/index.js';

(function () {
  // const vscode = acquireVsCodeApi();

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.cmd) {
      case 'clear':
        clear();
        break;
      case 'add_component':
        break;
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
    }
  });

  // Event functions
  function clear() {
    const element = document.querySelector('#component-list');
    if (element === null) return;
    element.remove();
  }

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

  // Define custom elements
  customElements.define(
    'ext-component',
    class ExtComponent extends HTMLElement {
      connectedCallback() {
        const entity = this.parentElement?.getAttribute('path');
        const component = this.getAttribute('type-path');
        const readableComponent = component?.replaceAll('::', ' :: ');

        const shadow = this.attachShadow({ mode: 'open' });
        shadow.adoptedStyleSheets = [styleForExpandable];
        shadow.innerHTML = dontIndent(`
          <details>
            <summary>
              <vscode-icon name="chevron-right" class="header-icon"></vscode-icon>
              <span>${readableComponent}</span>
              <vscode-icon name="symbol-method" class="component-type-icon"></vscode-icon>
            </summary>
            <div class="details-content" path="${entity + '.' + component}">${this.innerHTML}</div>
          </details>`);
      }
    }
  );

  customElements.define(
    'ext-group',
    class ExtGroup extends HTMLElement {
      connectedCallback() {
        const path = this.getAttribute('path');
        const parentPath = this.parentElement?.getAttribute('path');
        // const indentation = '<div class="space"></div>'.repeat((parentPath ?? '').replace(/[^.]/g, '').length);

        // Initialize elements
        const indentation = document.createElement('div');
        indentation.style.width = ((parentPath ?? '').replace(/[^.]/g, '').length * 22 - 6).toString() + 'px';
        indentation.className = 'space';
        const icon = document.createElement('vscode-icon');
        icon.setAttribute('name', 'chevron-right');
        icon.setAttribute('class', 'header-icon');
        const label = document.createElement('span');
        label.innerText = path ?? '';
        const summary = document.createElement('summary');
        summary.appendChild(indentation);
        summary.appendChild(icon);
        summary.appendChild(label);
        const content = document.createElement('div');
        content.setAttribute('class', 'details-content');
        content.setAttribute('path', fullPath(parentPath, path));
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
        const path = this.getAttribute('path');
        const full = fullPath(this.parentElement?.getAttribute('path'), path);
        const type = this.getAttribute('type');

        // Initialize elements
        const label = document.createElement('label');
        label.setAttribute('for', full);
        label.innerText = path ?? '';

        const valueHolder = document.createElement('div');
        valueHolder.classList.add('value');

        switch (type) {
          case 'boolean':
            const checkbox = document.createElement('vscode-checkbox');
            checkbox.id = full;
            valueHolder.appendChild(checkbox);
            break;

          case 'enum':
            const select = document.createElement('vscode-single-select');
            select.id = full;
            select.innerHTML = this.innerHTML;
            valueHolder.appendChild(select);
            break;

          default: // string
            const text = document.createElement('ext-text');
            text.id = full;
            if ('value' in text) text.value = 'Hahaha';
            if (this.hasAttribute('experiment')) text.setAttribute('type', 'area');
            valueHolder.appendChild(text); // TODO: somehow update value
            break;
        }

        // Create shadow DOM
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.adoptedStyleSheets = [styleForDeclaration];
        shadow.appendChild(label);
        shadow.appendChild(valueHolder);
      }
    }
  );

  customElements.define(
    'ext-text',
    class ExtText extends HTMLElement {
      inEdit = false;
      value = '';

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
        const shadow = this.attachShadow({ mode: 'open' });
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

          area.style.display = 'block';
          toField.style.display = 'flex';
          field.style.display = 'none';
          toArea.style.display = 'none';
        };
        toField.onclick = (e) => {
          field.value = this.value;

          area.style.display = 'none';
          toField.style.display = 'none';
          field.style.display = 'block';
          toArea.style.display = 'flex';
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
