import { DataWithAccess, EnumAsStringSync } from './section-components';
import { VscodeIcon } from '@vscode-elements/elements/dist/vscode-icon';
import * as VslStyles from './styles';
import { BrpValue, TypePath } from '../protocol/types';

const HTML_BOOLEAN_NAME = 'visual-boolean';
const HTML_BUTTON_NAME = 'visual-button';
const HTML_MERGED_NAME = 'visual-merged';
const HTML_NUMBER_NAME = 'visual-number';
const HTML_SELECT_NAME = 'visual-select';
const HTML_STRING_NAME = 'visual-string';

export function defineCustomElements() {
  customElements.define(HTML_BOOLEAN_NAME, HTMLBoolean);
  customElements.define(HTML_BUTTON_NAME, HTMLButtonCustom);
  customElements.define(HTML_MERGED_NAME, HTMLMerged);
  customElements.define(HTML_NUMBER_NAME, HTMLNumber);
  customElements.define(HTML_SELECT_NAME, HTMLSelect);
  customElements.define(HTML_STRING_NAME, HTMLString);
}

export type TooltipData = {
  label: string;
  componentPath: TypePath;
  mutationPath: string;
  sections: { [key: string]: string }[];
};

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
  setTooltipFrom(data: TooltipData | string) {
    // Simple
    if (typeof data === 'string') {
      this.htmlLeft.title = data;
      return;
    }

    // Label
    let result = data.label + '\n\n';

    // Path
    result += '[Path]\n';
    result += `componentPath = ${data.componentPath}\n`;
    if (data.mutationPath !== '') result += `mutationPath = ${data.mutationPath}\n`;
    result += '\n';

    // Schema
    function fitText(text: string, width: number) {
      return text.length > width ? text.substring(0, width) + '...' : text;
    }
    result += data.sections
      .map(
        (section, index) =>
          `[Schema ${index + 1}]\n` +
          Object.entries(section)
            .map(([key, value]) => key + ' = ' + fitText(value, 50))
            .join('\n')
      )
      .join('\n\n');

    // Apply
    this.htmlLeft.title = result;
  }
  setValue(v: string | number | boolean | null) {
    function createValueElement(value: string | number | boolean | null) {
      switch (typeof value) {
        case 'string': {
          const result = HTMLString.create();
          result.setValue(value);
          return result;
        }
        case 'number': {
          const result = HTMLNumber.create();
          result.setValue(value);
          return result;
        }
        case 'boolean': {
          const result = HTMLBoolean.create();
          result.setValue(value);
          return result;
        }
        default: {
          const result = HTMLString.create();
          result.setValue('NULL');
          return result;
        }
      }
    }
    if (this.htmlRight === undefined) {
      // Move label to left
      this.htmlLeft.classList.add('left-side');

      // Initialize
      this.htmlRight = { wrapper: document.createElement('div'), value: createValueElement(v) };
      this.htmlRight.wrapper.classList.add('right-side');

      // Structurize
      this.htmlRight.wrapper.append(this.htmlRight.value);
      this.shadowRoot?.append(this.htmlRight.wrapper);
      return;
    }
    if (typeof v !== typeof this.htmlRight.value.buffer) {
      const replacement = createValueElement(v);
      this.htmlRight.value.replaceWith(replacement);
      this.htmlRight.value = replacement;
      return;
    }
    this.htmlRight.value.setValue(v);
  }
  setOptions(sync: EnumAsStringSync) {
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
  setOptionsManual(initial: string, options: string[], mutability: (v: BrpValue) => void) {
    // Initialize elements
    const selectElement = HTMLSelect.create();
    selectElement.setAvailable(options, initial);
    this.htmlRight = {
      wrapper: document.createElement('div'),
      value: selectElement,
    };

    // Styles
    this.htmlLeft.classList.add('left-side');
    this.htmlRight.wrapper.classList.add('right-side');

    // Mutability
    this.htmlRight.value.mutability = mutability;

    // Structurize
    this.htmlRight.wrapper.append(this.htmlRight.value);
    this.shadowRoot?.append(this.htmlRight.wrapper);
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
  insertMutatable(mutatable: HTMLMutatable<BrpValue>) {
    // Initialize
    this.htmlRight = {
      wrapper: document.createElement('div'),
      value: mutatable,
    };

    // Styles
    this.htmlLeft.classList.add('left-side');
    this.htmlRight.wrapper.classList.add('right-side');

    // Structurize
    this.htmlRight.wrapper.append(this.htmlRight.value);
    this.shadowRoot?.append(this.htmlRight.wrapper);
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
  setValue(v: T) {
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

export class HTMLNumber extends HTMLMutatable<BrpValue> {
  private numberElement: HTMLDivElement;

  static create() {
    return document.createElement(HTML_NUMBER_NAME) as HTMLNumber;
  }

  constructor() {
    super(null);
    this.numberElement = document.createElement('div');

    // Interactions
    this.numberElement.onfocus = () => {
      this.inEdit = true;
      this.setAttribute('focused', '');
    };
    this.numberElement.onkeydown = (e) => {
      // unfocus without changes
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.renderValueFromBuffer();
        this.numberElement.blur();
        e.preventDefault();
      }

      // apply changes
      if (!(e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        try {
          const parsed = JSON.parse(this.numberElement.innerText);
          this.mutate(parsed);
        } catch {
          console.error(`Error in parsing brpValue`);
        }
        this.numberElement.blur();
      }
    };
    this.numberElement.onblur = () => {
      this.inEdit = false;
      this.renderValueFromBuffer();
      this.numberElement.scrollTo(0, 0);
      this.removeAttribute('focused');
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return; // already exists
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.editableText];
    shadow.append(this.numberElement);
  }

  renderValueFromBuffer() {
    this.numberElement.innerText = JSON.stringify(this.buffer, null, 4);
  }
  allowEditing() {
    this.numberElement.contentEditable = 'plaintext-only';
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

export class HTMLBoolean extends HTMLMutatable<boolean> {
  private boolElement: HTMLDivElement;

  static create() {
    return document.createElement(HTML_BOOLEAN_NAME) as HTMLBoolean;
  }

  constructor() {
    super(false);
    this.boolElement = document.createElement('div');

    this.boolElement.onclick = () => {
      this.mutate(!this.buffer);
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return; // already exists
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.editableText];
    shadow.append(this.boolElement);
  }

  renderValueFromBuffer() {
    this.boolElement.innerText = this.buffer ? 'True' : 'False';
  }
  allowEditing() {}
  allowWrapping(): void {}
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

export class HTMLButtonCustom extends HTMLMutatable<string> {
  private clickable: HTMLDivElement;

  static create() {
    return document.createElement(HTML_BUTTON_NAME) as HTMLButtonCustom;
  }

  constructor() {
    super('???');
    this.clickable = document.createElement('div');
    this.clickable.onclick = () => {
      this.mutate(this.buffer);
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return; // already exists
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.editableText];
    shadow.append(this.clickable);
  }

  renderValueFromBuffer() {
    this.clickable.innerText = this.buffer;
  }
  allowEditing() {}
  allowWrapping(): void {}
}
