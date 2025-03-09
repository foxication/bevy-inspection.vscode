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
    .declaration {
      display: flex;
      column-gap: 8px;
      align-items: center;
      label {
        flex: 3;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }
      input {
        flex: 5;
      }
      vscode-textfield {
        flex: 5;
      }
      vscode-checkbox {
        flex: 5;
      }
    }`)
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
        const indentation = '<div class="space"></div>'.repeat((parentPath ?? '').replace(/[^.]/g, '').length);

        const shadow = this.attachShadow({ mode: 'open' });
        shadow.adoptedStyleSheets = [styleForExpandable];
        shadow.innerHTML = dontIndent(`
          <details>
            <summary>
              ${indentation}
              <vscode-icon name="chevron-right" class="header-icon"></vscode-icon>
              <span>${path ?? ''}</span>
            </summary>
            <div class="details-content" path="${fullPath(parentPath, path)}">${this.innerHTML}</div>
          </details>`);
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

        const shadow = this.attachShadow({ mode: 'open' });
        shadow.adoptedStyleSheets = [styleForDeclaration];
        let declaration = dontIndent(`<div class="declaration"><label for="${full}">${path ?? ''}</label>`);
        switch (type) {
          case 'boolean':
            declaration += `<vscode-checkbox id="${full}"/>`;
            break;

          default: // string
            declaration += `<vscode-textfield id="${full}"/>`;
            break;
        }
        declaration += '</div>';
        shadow.innerHTML = declaration;
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
