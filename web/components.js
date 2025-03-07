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
      const typePath = this.getAttribute('type-path');
      this.outerHTML = dontIndent(`
        <details class="is-expandable">
          <summary class="component">
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="header-icon">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M10.072 8.024L5.715 3.667l.618-.62L11 7.716v.618L6.333 13l-.618-.619 4.357-4.357z">
              </path>
            </svg>
            <span>${typePath}</span>
          </summary>
          <div class="details-content" type-path="${typePath}">${this.innerHTML}</div>
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
          <div class="row">
            <vscode-textfield id="${parentProperty}"/>
          </div>`);
      } else {
        const id = parentProperty + '.' + property;
        this.outerHTML = dontIndent(`
          <div class="row">
            <label for="${id}" class="property">${property}</label>
            <vscode-textfield id="${id}"/>
          </div>`);
      }
    }
  }
);
