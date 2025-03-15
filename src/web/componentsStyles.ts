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
  .button-collection.autohide {
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
    height: 26px;
    justify-content: center;
    padding-inline: 0px;
    width: 26px;
  }
  button.autohide {
    visibility: hidden;
  }
  button.inside {
    height: 24px;
    width: 24px;
  }
  button.inside-compact {
    height: 24px;
    width: unset;
  }
  button.compact-tall {
    height: 100%;
    width: unset;
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
export const expandable = new CSSStyleSheet();
expandable.replaceSync(
  dontIndent(`
  :host {
    position: relative;
  }
  
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
        overflow: hidden;
        text-align: left;
        white-space: nowrap;
      }
      vscode-icon {
        flex: none;
      }
      div.indent {
        height: 16px;
        width: 16px;
      }
      div.space {
        flex: auto;
      }
    }
    summary:focus {
      outline: none;
    }
    .details-content {
      cursor: default;
      display: flex;
      flex-direction: column;
      margin-top: 4px;
      position: relative;
      row-gap: 4px;
    }
  }
  details:hover {
    cursor: pointer;
  }
  details[open] > summary .rotatable {
    transform: rotate(90deg);
  }
`)
);
export const declaration = new CSSStyleSheet();
declaration.replaceSync(
  dontIndent(`
  :host {
    column-gap: 8px;
    display: flex;
    position: relative;
    
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
      display: flex;
      align-items: center;
    }
  }
`)
);
export const input = new CSSStyleSheet();
input.replaceSync(
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
    input.centered {
      text-align: center;
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
export const hostIsContent = new CSSStyleSheet();
hostIsContent.replaceSync(':host { display: contents; }');
