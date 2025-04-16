import { SyncNode } from './sync';
import { VscodeIcon } from '@vscode-elements/elements';
import * as VslStyles from './styles';
import { BrpValue } from '../protocol/types';
import { MutationConsent } from './visual';

export function defineCustomElements() {
  customElements.define('visual-enum', HTMLEnum);
  customElements.define('visual-declaration', HTMLDeclaration);
  customElements.define('visual-json', HTMLJson);
  customElements.define('visual-string', HTMLString);
  customElements.define('visual-expandable', HTMLStruct);
}

export abstract class HTMLLabeled extends HTMLElement {
  abstract htmlLabel: HTMLSpanElement;

  set level(l: number) {
    const indent = l * 16;
    this.htmlLabel.style.textIndent = indent.toString() + 'px';
  }
  set label(text: string) {
    this.htmlLabel.textContent = text;
  }
  set tooltip(text: string) {
    this.htmlLabel.title = text;
  }
}

export class HTMLDeclaration extends HTMLLabeled {
  htmlLabel: HTMLSpanElement;
  htmlWrapper: HTMLDivElement;
  htmlValue: HTMLMutatable<BrpValue>;

  static create() {
    return document.createElement('visual-declaration') as HTMLDeclaration;
  }

  constructor() {
    super();
    this.htmlLabel = document.createElement('span');
    this.htmlLabel.classList.add('left-side');

    this.htmlWrapper = document.createElement('div');
    this.htmlWrapper.classList.add('right-side');

    this.htmlValue = HTMLString.create();
    this.htmlWrapper.append(this.htmlValue);
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.declaration];
    shadow.append(this.htmlLabel, this.htmlWrapper);
  }

  set brpValue(v: BrpValue) {
    if (this.htmlValue instanceof HTMLString) {
      if (typeof v === 'string') {
        this.htmlValue.value = v;
      } else {
        console.log(`Replacing with HTMLJson for ${this.htmlLabel.textContent}`);
        const replacement = HTMLJson.create();
        replacement.value = v;
        replacement.mutability = this.htmlValue.mutability;
        this.htmlValue.replaceWith(replacement);
        this.htmlValue = replacement;
      }
    } /* HTMLJson */ else {
      if (typeof v === 'string') {
        console.log(`Replacing with HTMLString for ${this.htmlLabel.textContent}`);
        const replacement = HTMLString.create();
        replacement.value = v;
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
  private _inEdit: boolean = false;
  private _mutability: MutationConsent | undefined;

  constructor(defaultValue: T) {
    super();
    this._buffer = defaultValue;
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

  static create() {
    return document.createElement('visual-json') as HTMLJson;
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

  static create() {
    return document.createElement('visual-string') as HTMLString;
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

export abstract class HTMLExpandable extends HTMLLabeled {
  public isExpanded = true;
  abstract chevron: VscodeIcon;

  set onExpansion(sync: SyncNode) {
    this.onclick = () => {
      if (this.isExpanded) {
        this.isExpanded = false;
        this.chevron.setAttribute('name', 'chevron-down');
        sync.hideChildren();
      } else {
        this.isExpanded = true;
        this.chevron.setAttribute('name', 'chevron-up');
        sync.showChildren();
      }
    };
  }
  set isExpandable(is: boolean) {
    if (is) this.chevron.style.removeProperty('display');
    else this.chevron.style.display = 'none';
  }
  get isExpandable() {
    return this.chevron.style.getPropertyValue('display') !== 'none';
  }
}

export class HTMLEnum extends HTMLExpandable {
  htmlLabel: HTMLSpanElement;
  buttonEdit: VscodeIcon;
  chevron: VscodeIcon;

  static create() {
    return document.createElement('visual-enum') as HTMLEnum;
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
}

export class HTMLStruct extends HTMLExpandable {
  htmlLabel: HTMLSpanElement;
  chevron: VscodeIcon;

  static create() {
    return document.createElement('visual-expandable') as HTMLStruct;
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
}
