import { SyncNode } from './sync';
import { Visual } from './visual';
import { VscodeIcon } from '@vscode-elements/elements';
import * as VslStyles from './styles';

//------------------------------------------------------------------------------

export abstract class ExpandableVisual extends Visual {
  abstract representation: HTMLExpandable;

  set isExpandable(able: boolean) {
    this.representation.isExpandable = able;
  }
  get isExpanded(): boolean {
    return this.representation.isExpanded;
  }
}

abstract class HTMLExpandable extends HTMLElement {
  public isExpanded = true;
  abstract set isExpandable(is: boolean);
}

//------------------------------------------------------------------------------

export class EnumVisual extends ExpandableVisual {
  readonly representation: HTMLEnum;

  constructor(sync: SyncNode, level: number, short: string, full: string, after: HTMLElement) {
    super();
    this.representation = HTMLEnum.create(sync, level, short, full);
    after.after(this.representation);
  }
}

class HTMLEnum extends HTMLExpandable {
  private htmlLabel: HTMLSpanElement;
  private buttonEdit: VscodeIcon;
  private chevron: VscodeIcon;

  static create(sync: SyncNode, level: number, short: string, full: string): HTMLEnum {
    if (customElements.get('visual-enum') === undefined) {
      customElements.define('visual-enum', HTMLEnum);
    }
    const result = document.createElement('visual-enum') as HTMLEnum;
    result.level = level;
    result.label = short;
    result.tooltip = full;

    result.onclick = () => {
      result.isExpanded = !result.isExpanded;
      if (result.isExpanded) {
        result.chevron.setAttribute('name', 'chevron-up');
        sync.showChildren();
      } else {
        result.chevron.setAttribute('name', 'chevron-down');
        sync.hideChildren();
      }
    };

    return result;
  }

  constructor() {
    super();
    this.htmlLabel = document.createElement('span');

    this.buttonEdit = document.createElement('vscode-icon');
    this.buttonEdit.setAttribute('name', 'symbol-property');

    this.chevron = document.createElement('vscode-icon');
    this.chevron.setAttribute('name', 'chevron-up');
    this.chevron.setAttribute('class', 'rotatable');
    this.chevron.style.display = 'none';
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.expandable];
    shadow.append(this.htmlLabel, this.buttonEdit, this.chevron);
  }

  set level(l: number) {
    const indent = l * 16;
    this.htmlLabel.style.textIndent = indent.toString() + 'px';
  }
  set isExpandable(is: boolean) {
    if (is) this.chevron.style.removeProperty('display');
    else this.chevron.style.display = 'none';
  }
  set label(text: string) {
    this.htmlLabel.textContent = text;
  }
  set tooltip(text: string) {
    this.htmlLabel.title = text;
  }
}

//------------------------------------------------------------------------------

export class StructVisual extends ExpandableVisual {
  readonly representation: HTMLStruct;

  constructor(sync: SyncNode, level: number, short: string, full: string, anchor: HTMLElement) {
    super();
    this.representation = HTMLStruct.create(sync, level, short, full);
    anchor.after(this.representation);
  }
}

class HTMLStruct extends HTMLElement {
  private chevron: VscodeIcon;
  private htmlLabel: HTMLSpanElement;
  public isExpanded = true;

  static create(sync: SyncNode, level: number, short: string, full: string): HTMLStruct {
    if (customElements.get('visual-expandable') === undefined) {
      customElements.define('visual-expandable', HTMLStruct);
    }
    const result = document.createElement('visual-expandable') as HTMLStruct;
    result.level = level;
    result.label = short;
    result.tooltip = full;

    result.onclick = () => {
      result.isExpanded = !result.isExpanded;
      if (result.isExpanded) {
        result.chevron.setAttribute('name', 'chevron-up');
        sync.showChildren();
      } else {
        result.chevron.setAttribute('name', 'chevron-down');
        sync.hideChildren();
      }
    };

    return result;
  }

  constructor() {
    super();
    this.htmlLabel = document.createElement('span');

    this.chevron = document.createElement('vscode-icon');
    this.chevron.setAttribute('name', 'chevron-up');
    this.chevron.setAttribute('class', 'rotatable');
    this.chevron.style.display = 'none';
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.expandable];
    shadow.append(this.htmlLabel, this.chevron);
  }

  set level(l: number) {
    const indent = l * 16;
    this.htmlLabel.style.textIndent = indent.toString() + 'px';
  }
  set isExpandable(is: boolean) {
    if (is) this.chevron.style.removeProperty('display');
    else this.chevron.style.display = 'none';
  }
  set label(text: string) {
    this.htmlLabel.textContent = text;
  }
  set tooltip(text: string) {
    this.htmlLabel.title = text;
  }
}
