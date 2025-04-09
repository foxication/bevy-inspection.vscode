import { BrpValue } from '../protocol';
import * as VslStyles from './styles';
import { SyncNode } from './sync';
import { ErrorData } from './data';

export abstract class Visual {
  abstract representation: HTMLElement;

  preDestruct() {
    this.representation.remove();
  }
  show() {
    this.representation.style.removeProperty('display');
  }
  hide() {
    this.representation.style.display = 'none';
  }
}

export class ComponentsVisual extends Visual {
  readonly representation: HTMLHeadingElement;

  constructor(mount: HTMLElement) {
    super();
    this.representation = ComponentsVisual.createVslHeading();
    mount.append(this.representation);
  }

  static createVslHeading() {
    const result = document.createElement('h3');
    result.textContent = 'Component List';
    return result;
  }
}

export class ErrorVisual extends Visual {
  readonly representation: HTMLDeclaration;

  constructor(level: number, error: ErrorData, mount: HTMLElement) {
    super();
    const label = error.code === undefined ? 'Error' : 'Error' + error.code;
    this.representation = HTMLDeclaration.create(level, label, label, error.message, () => {});
    mount.append(this.representation);
  }
}

export class SerializedVisual extends Visual {
  readonly representation: HTMLDeclaration;

  constructor(sync: SyncNode, level: number, short: string, full: string, value: BrpValue, mount: HTMLElement) {
    super();
    this.representation = HTMLDeclaration.create(level, short, full, value, (value: BrpValue) => {
      sync.mutate(value);
    });
    mount.append(this.representation);
  }

  set(value: BrpValue) {
    this.representation.brpValue = value;
  }
}

//------------------------------------------------------------------------------

class HTMLDeclaration extends HTMLElement {
  private property: HTMLSpanElement;
  private valueWrapper: HTMLDivElement;
  private valueElement: HTMLString; // VslNumber // VslBoolean // VslObject

  static create(
    level: number,
    short: string,
    full: string,
    value: BrpValue,
    onMutation: (value: BrpValue) => void
  ): HTMLDeclaration {
    if (customElements.get('visual-declaration') === undefined) {
      customElements.define('visual-declaration', HTMLDeclaration);
    }
    const result = document.createElement('visual-declaration') as HTMLDeclaration;
    result.level = level;
    result.label = short;
    result.tooltip = full;
    result.brpValue = value;
    result.onMutation = onMutation;
    return result;
  }

  constructor() {
    super();
    this.property = document.createElement('span');
    this.property.classList.add('left-side');

    this.valueWrapper = document.createElement('div');
    this.valueWrapper.classList.add('right-side');

    this.valueElement = HTMLString.create('', () => {});
    this.valueWrapper.append(this.valueElement);
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.declaration];
    shadow.append(this.property, this.valueWrapper);
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
  set brpValue(value: BrpValue) {
    this.valueElement.text = JSON.stringify(value, null, 4);
  }
  set onMutation(fun: (value: BrpValue) => void) {
    this.valueElement.onMutation = fun;
  }
}

class HTMLString extends HTMLElement {
  private textBuffer: string | undefined = undefined;
  private textElement: HTMLDivElement;
  private inEdit: boolean;
  public mutate: (value: BrpValue) => void;

  static create(text: string, onMutation: (value: BrpValue) => void): HTMLString {
    if (customElements.get('visual-string') === undefined) {
      customElements.define('visual-string', HTMLString);
    }
    const result = document.createElement('visual-string') as HTMLString;
    result.text = text;
    result.onMutation = onMutation;
    return result;
  }

  constructor() {
    super();
    this.textElement = document.createElement('div');
    this.textElement.contentEditable = 'plaintext-only';
    this.inEdit = false;
    this.mutate = () => {};

    // Interactions
    this.textElement.onfocus = () => {
      this.inEdit = true;
      this.setAttribute('focused', '');
    };
    this.textElement.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.textElement.innerText = this.textBuffer ?? '';
        this.textElement.blur();
        e.preventDefault();
      }

      // apply changes
      if (!(e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        try {
          const parsed = JSON.parse(this.textElement.innerText);
          this.mutate(parsed);
        } catch {
          /* empty */
        }
        this.textElement.innerText = this.textBuffer ?? '';
        this.textElement.blur();
      }
    };
    this.textElement.onchange = () => {
      this.textBuffer = this.textElement.innerText;
      this.textElement.blur();
    };
    this.textElement.onblur = () => {
      this.inEdit = false;
      this.textElement.innerText = this.textBuffer ?? '';
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

  set text(t: string | undefined) {
    this.textBuffer = t ?? '';
    this.textElement.contentEditable = t !== undefined ? 'plaintext-only' : 'false';

    if (this.inEdit) return;
    this.textElement.innerText = this.textBuffer;
  }

  set onMutation(call: (value: BrpValue) => void) {
    this.mutate = call;
  }
}
