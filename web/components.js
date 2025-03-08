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
      const entity = this.parentElement?.getAttribute('entity-id');
      const component = this.getAttribute('type-path');
      const readableComponent = component?.replaceAll('::', ' :: ');
      this.outerHTML = dontIndent(`
        <details class="is-expandable">
          <summary class="component">
            <vscode-icon name="chevron-right" class="header-icon"></vscode-icon>
            <span>${readableComponent}</span>
            <vscode-icon name="symbol-method" class="component-type-icon"></vscode-icon>
          </summary>
          <div class="details-content" property="${entity + '.' + component}">${this.innerHTML}</div>
        </details>`);
    }
  }
);

customElements.define(
  'ext-group',
  class ExtGroup extends HTMLElement {
    connectedCallback() {
      const parentProperty = this.parentElement?.getAttribute('property') ?? '';
      const property = this.getAttribute('property');
      const indentation = '<vscode-icon name="blank"></vscode-icon>'.repeat(parentProperty.replace(/[^.]/g, '').length);
      this.outerHTML = dontIndent(`
        <details class="is-expandable">
          <summary class="component">
            ${indentation}
            <vscode-icon name="chevron-right" class="header-icon"></vscode-icon>
            <span>${property}</span>
          </summary>
          <div class="details-content" property="${parentProperty + '.' + property}">${this.innerHTML}</div>
        </details>`);
    }
  }
);

customElements.define(
  'ext-declaration',
  class ExtDeclaration extends HTMLElement {
    connectedCallback() {
      const parentProperty = this.parentElement?.getAttribute('property') ?? '';
      const property = this.getAttribute('property');

      if (property === null) {
        this.outerHTML = dontIndent(`
          <div class="declaration">
            <label for="${parentProperty}" class="property"></label>
            <vscode-textfield id="${parentProperty}"/>
          </div>`);
      } else {
        const id = parentProperty + '.' + property;
        this.outerHTML = dontIndent(`
          <div class="declaration">
            <label for="${id}" class="property">${property}</label>
            <vscode-textfield id="${id}"/>
          </div>`);
      }
    }
  }
);
