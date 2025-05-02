import { DataWithAccess, EnumAsStringSync } from './section-components';
import { VscodeIcon } from '@vscode-elements/elements/dist/vscode-icon';
import * as VslStyles from './styles';
import { BrpValue } from '../protocol/types';

const HTML_MERGED_NAME = 'visual-merged';
const HTML_JSON_NAME = 'visual-json';
const HTML_STRING_NAME = 'visual-string';
const HTML_SELECT_NAME = 'visual-select';

export function defineCustomElements() {
  customElements.define(HTML_MERGED_NAME, HTMLMerged);
  customElements.define(HTML_JSON_NAME, HTMLJson);
  customElements.define(HTML_STRING_NAME, HTMLString);
  customElements.define(HTML_SELECT_NAME, HTMLSelect);
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
  set options(sync: EnumAsStringSync) {
    if (this.htmlRight === undefined) {
      // Move label to left & create elements
      this.htmlLeft.classList.add('left-side');
      const selectElement = HTMLSelect.create();
      selectElement.setAvailable(sync.getAvailableVariants(), sync.getVariant());
      this.htmlRight = {
        wrapper: document.createElement('div'),
        value: selectElement,
      };
      this.htmlRight.wrapper.classList.add('right-side');

      // Structurize
      this.htmlRight.wrapper.append(this.htmlRight.value);
      this.shadowRoot?.append(this.htmlRight.wrapper);
    }
    if (this.htmlRight.value instanceof HTMLString) {
      this.htmlRight.value.value = sync.getVariant() ?? '...';
    }
  }
  private createConfiguredChevron() {
    const result = document.createElement('vscode-icon');
    result.setAttribute('name', 'chevron-up');
    result.setAttribute('class', 'rotatable');
    return result;
  }
  makeExpandable(sync: DataWithAccess) {
    // create element
    this.htmlIcons.expand?.remove();
    this.htmlIcons.expand = this.createConfiguredChevron();
    this.htmlIcons.wrapper.append(this.htmlIcons.expand);

    // implement
    this.onclick = () => {
      if (this.htmlIcons.expand === undefined) return; // skip - no children
      switch (this.expansionState) {
        case 'expanded':
          this.htmlIcons.expand.setAttribute('name', 'chevron-down');
          sync.children.forEach((node) => node.visual.hide());
          break;
        case 'disabled':
        case 'collapsed':
          this.htmlIcons.expand.setAttribute('name', 'chevron-up');
          sync.children.forEach((node) => node.visual.show());
          break;
      }
    };
  }
  removeExpansibility() {
    this.onclick = () => {};
    this.htmlIcons.expand?.remove();
    this.htmlIcons.expand = undefined;
  }
  get expansionState(): 'expanded' | 'collapsed' | 'disabled' {
    if (this.htmlIcons.expand === undefined) return 'disabled';
    const state = this.htmlIcons.expand.getAttribute('name');
    if (state === 'chevron-up') return 'expanded';
    if (state === 'chevron-down') return 'collapsed';
    return 'expanded';
  }
  get isExpandable() {
    return this.htmlIcons.expand !== undefined;
  }
  allowValueWrapping() {
    this.htmlRight?.value.allowWrapping();
  }
  vscodeContext(data: { [key: string]: string | undefined }) {
    const result: { [key: string]: string } = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) result[key] = value;
    });
    this.setAttribute('data-vscode-context', JSON.stringify(data));
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
      ...[this.htmlLeft, this.htmlRight?.wrapper, this.htmlIcons.wrapper].filter(
        (element) => element !== undefined
      )
    );
  }
}

abstract class HTMLMutatable<T> extends HTMLElement {
  private _buffer: T;
  private _inEdit: boolean = false;
  private _mutability: ((v: BrpValue) => void) | undefined;

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
    if (!this.inEdit) this.renderValueFromBuffer();
  }
  set mutability(f: (v: BrpValue) => void) {
    this._mutability = f;
    this.allowEditing();
  }

  abstract renderValueFromBuffer(): void;
  abstract allowEditing(): void;
  mutate(value: BrpValue) {
    if (this._mutability !== undefined) this._mutability(value);
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
      // unfocus without changes
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.renderValueFromBuffer();
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
        this.jsonElement.blur();
      }
    };
    this.jsonElement.onblur = () => {
      this.inEdit = false;
      this.renderValueFromBuffer();
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

  renderValueFromBuffer() {
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
      // unfocus without changes
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.renderValueFromBuffer();
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

  renderValueFromBuffer() {
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

export class HTMLSelect extends HTMLMutatable<string> {
  private selectElement: HTMLSelectElement;
  private selectedVariant: HTMLOptionElement;
  private availableVariants: { [variant: string]: HTMLOptionElement };

  static create() {
    return document.createElement(HTML_SELECT_NAME) as HTMLSelect;
  }

  constructor() {
    super('');
    const defaultVariant = 'undefined';
    this.selectedVariant = document.createElement('option');
    this.selectedVariant.value = defaultVariant;
    this.selectedVariant.textContent = defaultVariant;

    this.availableVariants = { [defaultVariant]: this.selectedVariant };

    this.selectElement = document.createElement('select');
    this.selectElement.replaceChildren(...Object.values(this.availableVariants));
    this.selectElement.onchange = () => {
      this.mutate(this.selectElement.value);
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return; // already exists
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.select];
    shadow.append(this.selectElement);
  }

  renderValueFromBuffer() {
    this.selectElement.innerText = this.buffer;
  }
  allowEditing() {
    // Do nothing
  }
  allowWrapping(): void {
    // Do nothing
  }
  setAvailable(available: string[], selection?: string) {
    if (available.length < 1) return console.error(`Cannot set empty variants`);
    this.availableVariants = available.reduce((acc, variant) => {
      const element = document.createElement('option');
      element.value = variant;
      element.textContent = variant;
      acc[variant] = element;
      return acc;
    }, {} as typeof this.availableVariants);
    this.selectElement.replaceChildren(...Object.values(this.availableVariants));
    this.select(selection ?? available[0]);
  }
  select(selection: string) {
    if (!Object.keys(this.availableVariants).includes(selection)) {
      return console.error(`No such variant in available`);
    }
    this.selectElement.value = selection;
    this.selectedVariant = this.availableVariants[selection];
  }
}
