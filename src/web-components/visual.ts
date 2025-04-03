import { BrpValue } from '../protocol';
import { ArrayData, EnumData, ListData, MapData, SerializedData, SetData, StructData, TupleData } from './sync';
import * as VslStyles from './styles';
import { VscodeIcon } from '@vscode-elements/elements';

export class Visual {
  private representation: HTMLElement;

  constructor(
    level: number,
    label: string,
    data: SerializedData | EnumData | TupleData | ArrayData | ListData | SetData | StructData | MapData,
    mount: HTMLElement
  ) {
    switch (true) {
      case data instanceof SerializedData:
        this.representation = createVslDeclaration(label, data.value);
        break;
      case data instanceof EnumData:
        this.representation = createVslDeclaration(label, data.variantName);
        break;
      default:
        this.representation = createVslExpandable(level, label);
        break;
    }
    mount.append(this.representation);
  }

  set hasChildren(has: boolean) {
    if (this.representation instanceof VslExpandable) this.representation.isExpandable = has;
  }

  update(value: BrpValue) {
    if (!(this.representation instanceof VslDeclaration)) return;
    this.representation.update(value);
  }

  preDestruct() {
    this.representation.remove();
  }
}

function createVslExpandable(level: number, label: string | undefined): VslExpandable {
  if (customElements.get('visual-expandable') === undefined) {
    customElements.define('visual-expandable', VslExpandable);
  }
  const result = document.createElement('visual-expandable') as VslExpandable;
  result.level = level;
  result.label = label ?? '...';
  return result;
}

export class VslExpandable extends HTMLElement {
  private chevron: VscodeIcon;
  private indentation: HTMLDivElement;
  private labelElement: HTMLSpanElement;

  constructor() {
    super();
    this.indentation = document.createElement('div');
    this.indentation.style.width = '0px';
    this.indentation.classList.add('indent');

    this.chevron = document.createElement('vscode-icon');
    this.chevron.setAttribute('name', 'chevron-right');
    this.chevron.setAttribute('class', 'rotatable');
    this.chevron.style.display = 'none';

    this.labelElement = document.createElement('span');
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.expandable];
    shadow.append(this.indentation, this.chevron, this.labelElement);
  }

  set level(l: number) {
    const indent = l * 16;
    this.indentation.style.width = indent.toString() + 'px';
  }
  set isExpandable(is: boolean) {
    if (is) this.chevron.style.removeProperty('display');
    else this.chevron.style.display = 'none';
  }
  set label(text: string) {
    this.labelElement.textContent = text;
  }
}

let isVslDeclarationDefined = false;
function createVslDeclaration(label: string | undefined, value: BrpValue): VslDeclaration {
  if (!isVslDeclarationDefined) {
    customElements.define('visual-declaration', VslDeclaration);
    isVslDeclarationDefined = true;
  }
  const result = document.createElement('visual-declaration') as VslDeclaration;
  result.initialLabel = label;
  result.initialValue = value;
  return result;
}

export class VslDeclaration extends HTMLElement {
  public initialLabel: string | undefined = undefined;
  public initialValue: BrpValue = null;

  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const labelElement = () => {
      if (this.initialLabel === undefined) {
        const element = document.createElement('div');
        element.classList.add('left-side');
        return element;
      }
      const element = document.createElement('span');
      element.textContent = this.initialLabel;
      element.classList.add('left-side');
      return element;
    };
    const valueHolder = () => {
      const holder = document.createElement('div');
      holder.classList.add('right-side');
      this.valueElement = createVslString(JSON.stringify(this.initialValue, null, 4));
      holder.append(this.valueElement);

      // TODO:
      // switch (typeof this.value) {
      //   case 'number': {
      //     const valueElement = document.createElement('ext-number') as ExtNumber;
      //     holder.append(valueElement);
      //     break;
      //   }
      //   case 'boolean': {
      //     const valueElement = document.createElement('ext-boolean') as ExtBoolean;
      //     holder.append(valueElement);
      //     break;
      //   }
      //   default: {
      //     const valueElement = document.createElement('ext-string') as ExtString;
      //     holder.append(valueElement);
      //     break;
      //   }
      // }
      return holder;
    };

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.declaration];
    shadow.append(labelElement(), valueHolder());
  }

  private valueElement: VslString | undefined;
  update(value: BrpValue) {
    if (this.valueElement instanceof VslString) this.valueElement.setText(JSON.stringify(value, null, 4));
  }
}

let isVslStringDefined = false;
function createVslString(text: string): VslString {
  if (!isVslStringDefined) {
    customElements.define('visual-string', VslString);
    isVslStringDefined = true;
  }
  const result = document.createElement('visual-string') as VslString;
  result.textBuffer = text;
  return result;
}

class VslString extends HTMLElement {
  public textBuffer: string = '';
  private textElement: HTMLTextAreaElement | undefined;

  setText(text: string) {
    if (this.textElement === undefined) return;
    this.textElement.value = text;
    this.textBuffer = text;
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const isDisabled = false; // TODO

    this.textElement = document.createElement('textarea');
    this.textElement.value = this.textBuffer;
    this.textElement.disabled = isDisabled;
    this.textElement.rows = 1;

    const recalculateHeight = () => {
      if (this.textElement === undefined) return;
      this.textElement.style.height = 'auto';
      this.textElement.style.height = this.textElement.scrollHeight + 'px';
    };

    // Interactions
    this.textElement.oninput = () => recalculateHeight();
    this.textElement.onfocus = () => {
      this.setAttribute('focused', '');
    };
    this.textElement.onkeydown = (e) => {
      if (this.textElement === undefined) return;

      if (e.key === 'Escape' || e.key === 'Esc') {
        this.textElement.value = this.textBuffer;
        this.textElement.blur();
        e.preventDefault();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        this.textElement.blur();
      }
    };
    this.textElement.onchange = () => {
      if (this.textElement === undefined) return;

      this.setText(this.textElement.value);
      this.textElement.blur();
    };
    this.textElement.onblur = () => {
      if (this.textElement === undefined) return;

      this.textElement.value = this.textBuffer;
      this.textElement.scrollTo(0, 0);
      this.removeAttribute('focused');
      recalculateHeight();
    };

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.textArea];
    shadow.append(this.textElement);
    recalculateHeight();
  }
}
