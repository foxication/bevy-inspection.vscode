import { BrpSchema, BrpValue, TypePath } from '../protocol';
import { ArrayData, EnumData, ListData, MapData, SerializedData, SetData, StructData, TupleData } from './sync';
import * as VslStyles from './styles';

export class Visual {
  private element?: HTMLElement;
  // private child?: Visual;

  constructor(
    level: number,
    label: string,
    data: SerializedData | EnumData | TupleData | ArrayData | ListData | SetData | StructData | MapData,
    mount: HTMLElement
  ) {
    const schema = data.schema;
    const kind = schema.kind;
    const typePath = schema.typePath;

    // Value
    if (data instanceof SerializedData) {
      this.element = createVslDeclaration(label, data.value);
      mount.append(this.element);
      return;
    }

    // Enum
    if (data instanceof EnumData) {
      this.element = createVslDeclaration(label, data.variantName);
      mount.append(this.element);
      return;
    }

    // Header
    this.element = createVslExpandable(level, label, kind, typePath);
    mount.append(this.element);
  }

  private _hasChildren = false;
  set hasChildren(has: boolean) {
    if (this._hasChildren === has) return;
    if (!(this.element instanceof VslExpandable)) return;
    
    this.element.setChevronVisibility(has);
    this._hasChildren = has;
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
  result.level = level;
  result.label = label;
  result.kind = kind;
  result.typePath = typePath;
  return result;
}

export class VslExpandable extends HTMLElement {
  public level: number = 1;
  public label: string | undefined;
  public kind: BrpSchema['kind'] | undefined;
  public typePath: TypePath | undefined;

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const label = this.label ?? this.kind ?? this.typePath ?? '???';
    const indentPx = Math.max((this.level - 1) * 16, 0);

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
  result.label = label;
  result.value = value;
  return result;
}

export class VslDeclaration extends HTMLElement {
  public label: string | undefined = undefined;
  public value: BrpValue = null;

  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const labelElement = () => {
      if (this.label === undefined) {
        const element = document.createElement('div');
        element.classList.add('left-side');
        return element;
      }
      const element = document.createElement('span');
      element.textContent = this.label;
      element.classList.add('left-side');
      return element;
    };
    const valueHolder = () => {
      const holder = document.createElement('div');
      holder.classList.add('right-side');
      const valueElement = createVslString(JSON.stringify(this.value, null, 4));
      holder.append(valueElement);

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
}

let isVslStringDefined = false;
function createVslString(text: string): VslString {
  if (!isVslStringDefined) {
    customElements.define('visual-string', VslString);
    isVslStringDefined = true;
  }
  const result = document.createElement('visual-string') as VslString;
  result.text = text;
  return result;
}

class VslString extends HTMLElement {
  public text: string = '';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setText(text: string) {}

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const isDisabled = false; // TODO

    const textArea = document.createElement('textarea');
    textArea.value = this.text;
    textArea.disabled = isDisabled;
    textArea.rows = 1;

    const recalculateHeight = () => {
      textArea.style.height = 'auto';
      textArea.style.height = textArea.scrollHeight + 'px';
    };

    // Interactions
    textArea.oninput = () => recalculateHeight();
    textArea.onfocus = () => {
      this.setAttribute('focused', '');
    };
    textArea.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        textArea.value = this.text;
        textArea.blur();
        e.preventDefault();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        textArea.blur();
      }
    };
    textArea.onchange = () => {
      this.setText(textArea.value);
      textArea.blur();
    };
    textArea.onblur = () => {
      textArea.value = this.text;
      textArea.scrollTo(0, 0);
      this.removeAttribute('focused');
      recalculateHeight();
    };

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.textArea];
    shadow.append(textArea);
    recalculateHeight();
  }
}
