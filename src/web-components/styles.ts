function dontIndent(str: string) {
  return ('' + str).replace(/(\n)\s+/g, '$1');
}

export const buttons = new CSSStyleSheet();
buttons.replaceSync(
  dontIndent(`
  .button-collection {
    background-color: var(--vscode-settings-textInputBackground);
    border-radius: inherit;
    bottom: 0px;
    position: absolute;
    right: 0px;
  }
  button {
    align-items: center;
    background-color: transparent;
    border-radius: inherit;
    border: 0px;
    color: var(--vscode-settings-textInputForeground, #cccccc);
    cursor: pointer;
    display: flex;
    flex: none;
    height: 26px;
    justify-content: center;
    padding-inline: 0px;
    width: 26px;
  }
  button.inside {
    height: 24px;
    width: 24px;
  }
  button.inside-compact {
    height: 24px;
    width: unset;
  }
  button.inside-wide {
    height: 24px;
    width: 100%;
  }
  button.compact-tall {
    height: 100%;
    width: unset;
  }
  button:hover {
    background-color: var(--vscode-toolbar-hoverBackground,rgba(90, 93, 94, 0.31));
  }
  button:active {
    background-color: var(--vscode-toolbar-activeBackground,rgba(99, 102, 103, 0.31));
  }
  .autohide {
    visibility: hidden;
  }
  summary:hover > .buttons > .autohide {
    visibility: inherit;
  }
  :host(:hover) > .autohide {
    visibility: inherit;
  }
`)
);
export const expandable = new CSSStyleSheet();
expandable.replaceSync(
  dontIndent(`
  :host {
    border-radius: 2px;
    display: flex;
    width: 100%;
  }
  :host(:hover) {
    background-color: var(--vscode-list-hoverBackground);
  }
  span {
    direction: rtl;
    flex: 1;
    line-height: 22px;
    overflow: hidden;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  vscode-icon {
    padding: 3px 6px 3px 0;
  }
`)
);
export const declaration = new CSSStyleSheet();
declaration.replaceSync(
  dontIndent(`
  :host {
    border-radius: 2px;
    column-gap: 8px;
    display: flex;
    width: 100%;
    
    span {
      line-height: 22px;
      overflow: hidden;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .left-side {
      flex: 3;
    }
    .right-side {
      flex: 5;
    }
  }
  :host(:hover) {
    background-color: var(--vscode-list-hoverBackground);
  }
`)
);
export const textArea = new CSSStyleSheet();
textArea.replaceSync(
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
    line-height: 20px;
    padding: 1px 4px;
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
export const hostIsContent = new CSSStyleSheet();
hostIsContent.replaceSync(':host { display: contents; }');
export const wideCheckbox = new CSSStyleSheet();
wideCheckbox.replaceSync('vscode-checkbox { flex: auto; }');
