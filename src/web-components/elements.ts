import { SyncNode } from './sync';
import { VscodeIcon } from '@vscode-elements/elements';
import * as VslStyles from './styles';
import { BrpValue } from '../protocol/types';
import { MutationConsent } from './visual';

//------------------------------------------------------------------------------

export abstract class HTMLExpandable extends HTMLElement {
  public isExpanded = true;
  abstract set isExpandable(is: boolean);
}

//------------------------------------------------------------------------------

export class HTMLEnum extends HTMLExpandable {
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

export class HTMLDeclaration extends HTMLElement {
  private property: HTMLSpanElement;
  private htmlWrapper: HTMLDivElement;
  private htmlValue: HTMLJson | HTMLString; // VslNumber // VslBoolean // VslObject

  static create(
    level: number,
    short: string,
    full: string,
    value: BrpValue,
    mutability: MutationConsent | undefined
  ): HTMLDeclaration {
    if (customElements.get('visual-declaration') === undefined) {
      customElements.define('visual-declaration', HTMLDeclaration);
    }
    const result = document.createElement('visual-declaration') as HTMLDeclaration;
    result.level = level;
    result.label = short;
    result.tooltip = full;
    result.brpValue = value;
    if (mutability !== undefined) result.htmlValue.mutability = mutability;
    return result;
  }

  constructor() {
    super();
    this.property = document.createElement('span');
    this.property.classList.add('left-side');

    this.htmlWrapper = document.createElement('div');
    this.htmlWrapper.classList.add('right-side');

    this.htmlValue = HTMLString.create('');
    this.htmlWrapper.append(this.htmlValue);
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.declaration];
    shadow.append(this.property, this.htmlWrapper);
  }

  set level(l: number) {
    const indent = l * 16;
    this.property.style.textIndent = indent.toString() + 'px';
  }
  set label(text: string) {
    this.property.textContent = text;
  }
  set tooltip(text: string) {
    this.property.title = text;
  }
  set brpValue(v: BrpValue) {
    if (this.htmlValue instanceof HTMLString) {
      if (typeof v === 'string') {
        this.htmlValue.value = v;
      } else {
        console.log(`Replacing with HTMLJson for ${this.property.textContent}`);
        const replacement = HTMLJson.create(v);
        replacement.mutability = this.htmlValue.mutability;
        this.htmlValue.replaceWith(replacement);
        this.htmlValue = replacement;
      }
    } /* HTMLJson */ else {
      if (typeof v === 'string') {
        console.log(`Replacing with HTMLString for ${this.property.textContent}`);
        const replacement = HTMLString.create(v);
        replacement.mutability = this.htmlValue.mutability;
        this.htmlValue.replaceWith(replacement);
        this.htmlValue = replacement;
      } else {
        this.htmlValue.value = v;
      }
    }
  }
}

abstract class HTMLMutatable<T> extends HTMLElement {
  private _buffer: T;
  private _inEdit: boolean;
  private _mutability: MutationConsent | undefined;

  constructor(defaultValue: T) {
    super();
    this._buffer = defaultValue;
    this._inEdit = false;
  }

  get buffer() {
    return this._buffer;
  }
  get inEdit() {
    return this._inEdit;
  }
  set inEdit(b: boolean) {
    this._inEdit = b;
  }
  set value(v: T) {
    this._buffer = v;
    if (this.inEdit) return;
    this.setTextFromBuffer();
  }
  set mutability(m: MutationConsent) {
    this._mutability = m;
    this.allowEditing();
  }

  abstract setTextFromBuffer(): void;
  abstract allowEditing(): void;
  mutate(value: BrpValue) {
    this._mutability?.mutate(value);
  }
}

export class HTMLJson extends HTMLMutatable<BrpValue> {
  private jsonElement: HTMLDivElement;

  static create(value: BrpValue): HTMLJson {
    if (customElements.get('visual-json') === undefined) {
      customElements.define('visual-json', HTMLJson);
    }
    const result = document.createElement('visual-json') as HTMLJson;
    result.value = value;
    return result;
  }

  constructor() {
    super(null);
    this.jsonElement = document.createElement('div');

    // Interactions
    this.jsonElement.onfocus = () => {
      this.inEdit = true;
      this.setAttribute('focused', '');
    };
    this.jsonElement.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.setTextFromBuffer();
        this.jsonElement.blur();
        e.preventDefault();
      }

      // apply changes
      if (!(e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        try {
          const parsed = JSON.parse(this.jsonElement.innerText);
          this.mutate(parsed);
        } catch {
          /* empty */
        }
        this.setTextFromBuffer();
        this.jsonElement.blur();
      }
    };
    this.jsonElement.onblur = () => {
      this.inEdit = false;
      this.setTextFromBuffer();
      this.jsonElement.scrollTo(0, 0);
      this.removeAttribute('focused');
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.editableText];
    shadow.append(this.jsonElement);
  }

  setTextFromBuffer() {
    this.jsonElement.innerText = JSON.stringify(this.buffer, null, 4);
  }
  allowEditing() {
    this.jsonElement.contentEditable = 'plaintext-only';
  }
}

export class HTMLString extends HTMLMutatable<string> {
  private textElement: HTMLDivElement;

  static create(text: string): HTMLString {
    if (customElements.get('visual-string') === undefined) {
      customElements.define('visual-string', HTMLString);
    }
    const result = document.createElement('visual-string') as HTMLString;
    result.value = text;
    return result;
  }

  constructor() {
    super('');
    this.textElement = document.createElement('div');

    // Interactions
    this.textElement.onfocus = () => {
      this.inEdit = true;
      this.setAttribute('focused', '');
    };
    this.textElement.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.setTextFromBuffer();
        this.textElement.blur();
        e.preventDefault();
      }

      // apply changes
      if (!(e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        try {
          this.mutate(this.textElement.innerText);
        } catch {
          /* empty */
        }
        this.setTextFromBuffer();
        this.textElement.blur();
      }
    };
    this.textElement.onblur = () => {
      this.inEdit = false;
      this.textElement.innerText = this.buffer;
      this.textElement.scrollTo(0, 0);
      this.removeAttribute('focused');
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.editableText];
    shadow.append(this.textElement);
  }

  setTextFromBuffer() {
    this.textElement.innerText = this.buffer;
  }
  allowEditing() {
    this.textElement.contentEditable = 'plaintext-only';
  }
}

export class HTMLStruct extends HTMLElement {
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
