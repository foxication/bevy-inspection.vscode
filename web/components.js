//@ts-check

// TODO: import somehow (maybe using importmap)
// import '@vscode-elements/elements/dist/vscode-tree/index.js';

(function () {
  const vscode = acquireVsCodeApi();

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

  const select = document.querySelector('#select-example');
  if (select !== null) {
    select.addEventListener('change', (event) => {
      // @ts-ignore
      console.log(select.value);
    });
  }

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
})();

function dontIndent(str) {
  return ('' + str).replace(/(\n)\s+/g, '$1');
}

customElements.define(
  'ext-component',
  class ExtComponent extends HTMLElement {
    connectedCallback() {
      const entity = this.parentElement?.getAttribute('path');
      const component = this.getAttribute('type-path');
      const readableComponent = component?.replaceAll('::', ' :: ');
      this.outerHTML = dontIndent(`
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
      const parentPath = this.parentElement?.getAttribute('path') ?? '';
      const path = this.getAttribute('path');
      const indentation = '<vscode-icon name="blank"></vscode-icon>'.repeat(parentPath.replace(/[^.]/g, '').length);
      this.outerHTML = dontIndent(`
        <details>
          <summary>
            ${indentation}
            <vscode-icon name="chevron-right" class="header-icon"></vscode-icon>
            <span>${path}</span>
          </summary>
          <div class="details-content" path="${parentPath + '.' + path}">${this.innerHTML}</div>
        </details>`);
    }
  }
);

customElements.define(
  'ext-declaration',
  class ExtDeclaration extends HTMLElement {
    connectedCallback() {
      const parentPath = this.parentElement?.getAttribute('path') ?? '';
      const path = this.getAttribute('path');

      if (path === null) {
        this.outerHTML = dontIndent(`
          <div class="declaration">
            <label for="${parentPath}"></label>
            <vscode-textfield id="${parentPath}"/>
          </div>`);
      } else {
        const id = parentPath + '.' + path;
        this.outerHTML = dontIndent(`
          <div class="declaration">
            <label for="${id}">${path}</label>
            <vscode-textfield id="${id}"/>
          </div>`);
      }
    }
  }
);
