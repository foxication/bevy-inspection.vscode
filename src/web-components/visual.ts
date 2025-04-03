import { BrpSchema, BrpValue, TypePath } from '../protocol';
import { ArrayData, EnumData, ListData, MapData, SerializedData, SetData, StructData, TupleData } from './sync';
import * as VslStyles from './styles';

export class Visual {
  private representation: HTMLElement;

  constructor(
    level: number,
    label: string,
    data: SerializedData | EnumData | TupleData | ArrayData | ListData | SetData | StructData | MapData,
    mount: HTMLElement
  ) {
    if (data instanceof SerializedData) this.representation = createVslDeclaration(label, data.value);
    if (data instanceof EnumData) this.representation = createVslDeclaration(label, data.variantName);
    this.representation = createVslExpandable(level, label, data.schema.kind, data.schema.typePath);
    mount.append(this.representation);
  }

  private _hasChildren = false;
  set hasChildren(has: boolean) {
    if (this._hasChildren === has) return;
    if (!(this.representation instanceof VslExpandable)) return;

    this.representation.setChevronVisibility(has);
    this._hasChildren = has;
  }

  update(value: BrpValue) {
    if (!(this.representation instanceof VslDeclaration)) return;
    this.representation.update(value);
  }

  preDestruct() {
    this.representation?.remove();
  }
}

let isVslExpandableDefined = false;
function createVslExpandable(
  level: number,
  label: string | undefined,
  kind: BrpSchema['kind'] | undefined,
  typePath: TypePath | undefined
): VslExpandable {
  if (!isVslExpandableDefined) {
    customElements.define('visual-expandable', VslExpandable);
    isVslExpandableDefined = true;
  }
  const result = document.createElement('visual-expandable') as VslExpandable;
  result.initialLevel = level;
  result.initialLabel = label;
  result.initialKind = kind;
  result.initialTypePath = typePath;
  return result;
}

export class VslExpandable extends HTMLElement {
  public initialLevel: number = 1;
  public initialLabel: string | undefined;
  public initialKind: BrpSchema['kind'] | undefined;
  public initialTypePath: TypePath | undefined;

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const label = this.initialLabel ?? this.initialKind ?? this.initialTypePath ?? '???';
    const indentPx = Math.max((this.initialLevel - 1) * 16, 0);

    const indentation = () => {
      const element = document.createElement('div');
      element.style.width = indentPx.toString() + 'px';
      element.classList.add('indent');
      return element;
    };

    const labelElement = () => {
      const element = document.createElement('span');
      element.textContent = label;
      return element;
    };

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.expandable];
    if (indentPx > 0) shadow.append(indentation());
    shadow.append(this.chevron, labelElement());
  }

  private chevron: HTMLElement = (() => {
    const element = document.createElement('vscode-icon');
    element.setAttribute('name', 'chevron-right');
    element.setAttribute('class', 'rotatable');
    element.style.display = 'none';
    return element;
  })();
  setChevronVisibility(visible: boolean) {
    if (visible) this.chevron.style.removeProperty('display');
    else this.chevron.style.display = 'none';
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
