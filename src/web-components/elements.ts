import { SyncNode } from './sync';
import { VscodeIcon } from '@vscode-elements/elements/dist/vscode-icon';
import * as VslStyles from './styles';
import { BrpValue } from '../protocol/types';
import { MutationConsent } from './visual';

const HTML_MERGED_NAME = 'visual-merged';
const HTML_JSON_NAME = 'visual-json';
const HTML_STRING_NAME = 'visual-string';

export function defineCustomElements() {
  customElements.define(HTML_MERGED_NAME, HTMLMerged);
  customElements.define(HTML_JSON_NAME, HTMLJson);
  customElements.define(HTML_STRING_NAME, HTMLString);
}

export class HTMLMerged extends HTMLElement {
  htmlLeft: HTMLSpanElement;
  htmlRight?: {
    wrapper: HTMLDivElement;
    value: HTMLMutatable<BrpValue>;
  };
  htmlIcons: {
    wrapper: HTMLDivElement;
    enum?: VscodeIcon;
    expand?: VscodeIcon;
  };

  set level(l: number) {
    const indent = l * 16;
    this.htmlLeft.style.textIndent = indent.toString() + 'px';
  }
  set label(text: string) {
    this.htmlLeft.textContent = text;
  }
  set tooltip(text: string) {
    this.htmlLeft.title = text;
  }
  set brpValue(v: BrpValue) {
    if (this.htmlRight === undefined) {
      // Move label to left & create elements
      this.htmlLeft.classList.add('left-side');
      this.htmlRight = { wrapper: document.createElement('div'), value: HTMLString.create() };
      this.htmlRight.wrapper.classList.add('right-side');

      // Structurize
      this.htmlRight.wrapper.append(this.htmlRight.value);
      this.shadowRoot?.append(this.htmlRight.wrapper);
    }
    if (this.htmlRight.value instanceof HTMLString) {
      if (typeof v === 'string') {
        this.htmlRight.value.value = v;
      } else {
        const replacement = HTMLJson.create();
        replacement.value = v;
        replacement.mutability = this.htmlRight.value.mutability;
        this.htmlRight.value.replaceWith(replacement);
        this.htmlRight.value = replacement;
      }
    } /* HTMLJson */ else {
      if (typeof v === 'string') {
        const replacement = HTMLString.create();
        replacement.value = v;
        replacement.mutability = this.htmlRight.value.mutability;
        this.htmlRight.value.replaceWith(replacement);
        this.htmlRight.value = replacement;
      } else {
        this.htmlRight.value.value = v;
      }
    }
  }
  set onEnumEdit(sync: SyncNode) {
    if (this.htmlIcons.enum === undefined) {
      this.htmlIcons.enum = document.createElement('vscode-icon');
      this.htmlIcons.enum.setAttribute('name', 'symbol-property');
      this.htmlIcons.wrapper.append(this.htmlIcons.enum);
    }
    this.htmlIcons.enum.onclick = () => {}; // TODO
  }
  private createConfiguredChevron() {
    const result = document.createElement('vscode-icon');
    result.setAttribute('name', 'chevron-up');
    result.setAttribute('class', 'rotatable');
    return result;
  }
  set onExpansion(sync: SyncNode) {
    this.onclick = () => {
      if (this.htmlIcons.expand === undefined) return; // skip - no children
      const state = this.htmlIcons.expand.getAttribute('name');
      if (state === 'chevron-up') {
        this.htmlIcons.expand.setAttribute('name', 'chevron-down');
        sync.hideChildren();
      }
      if (state === 'chevron-down') {
        this.htmlIcons.expand.setAttribute('name', 'chevron-up');
        sync.showChildren();
      }
    };
  }
  set isExpandable(is: boolean) {
    if (is) {
      this.htmlIcons.expand?.remove();
      this.htmlIcons.expand = this.createConfiguredChevron();
      this.htmlIcons.wrapper.append(this.htmlIcons.expand);
    } else {
      this.htmlIcons.expand?.remove();
      this.htmlIcons.expand = undefined;
    }
  }
  get isExpandable() {
    return this.htmlIcons.expand !== undefined;
  }
  allowValueWrapping() {
    this.htmlRight?.value.allowWrapping();
  }

  static create() {
    return document.createElement(HTML_MERGED_NAME) as HTMLMerged;
  }
  constructor() {
    super();
    this.htmlLeft = document.createElement('span');
    this.htmlIcons = { wrapper: document.createElement('div') };
    this.htmlIcons.wrapper.classList.add('icons');
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return; // already exists
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.merged];
    shadow.append(
      ...[this.htmlLeft, this.htmlRight?.wrapper, this.htmlIcons.wrapper].filter((element) => element !== undefined)
    );
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
    if (!this.inEdit) this.setTextFromBuffer();
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
  abstract allowWrapping(): void;
}

export class HTMLJson extends HTMLMutatable<BrpValue> {
  private jsonElement: HTMLDivElement;

  static create() {
    return document.createElement(HTML_JSON_NAME) as HTMLJson;
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
          console.error(`Error in parsing brpValue`);
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
    if (this.shadowRoot !== null) return; // already exists
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
  allowWrapping() {
    // skip
  }
}

export class HTMLString extends HTMLMutatable<string> {
  private textElement: HTMLDivElement;

  static create() {
    return document.createElement(HTML_STRING_NAME) as HTMLString;
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
          // remove last newline as contentEditable mode gives unpredictable results
          this.mutate(this.textElement.innerText.trimEnd());
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
    if (this.shadowRoot !== null) return; // already exists
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
  allowWrapping(): void {
    this.textElement.style.textWrap = 'wrap';
    this.textElement.style.wordBreak = 'break-all';
  }
}
