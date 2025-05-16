function dontIndent(str: string) {
  return ('' + str).replace(/(\n)\s+/g, '$1');
}
function createStyleSheet(text: string): CSSStyleSheet {
  const result = new CSSStyleSheet();
  result.replaceSync(dontIndent(text));
  return result;
}

export const merged = createStyleSheet(`
  :host {
    border-radius: 2px;
    display: flex;
    width: 100%;
  }
  :host(:hover) {
    background-color: var(--vscode-list-hoverBackground);
  }
  span {
    flex: 3;
    line-height: 22px;
    margin-right: 8px;
    overflow: hidden;
    text-indent: 0px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  vscode-icon {
    flex: none;
    padding: 3px;
  }
  .right-side {
    flex: none;
    overflow-x: overlay;
  }
  .right-side-extend {
    flex: 5;
  }
  .icons {
    display: flex;
  }
`);

export const buttons = createStyleSheet(`
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
`);
export const editableText = createStyleSheet(`
  div {
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
    min-width: 100%;
    padding: 1px 4px;
    resize: none;
    text-wrap: nowrap;
    width: fit-content;
  }
  div:focus {
    outline: none;
  }
  div::-webkit-scrollbar { 
    display: none;
  }
`);
export const select = createStyleSheet(`
  select {
    appearance: none;
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
    min-width: 100%;
    padding: 1px 4px;
    width: fit-content;
  }
  select:focus {
    outline: none;
  }
`);
export const hostIsContent = createStyleSheet(':host { display: contents; }');
export const wideCheckbox = createStyleSheet('vscode-checkbox { flex: auto; }');
