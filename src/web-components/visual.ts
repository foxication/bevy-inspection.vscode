import { BrpValue, TypePath } from '../protocol';
import * as VslStyles from './styles';
import { SyncNode } from './sync';
import { ErrorData } from './data';
import { StructVisual, EnumVisual } from './visual-expandable';

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

export type AnyVisual = ComponentsVisual | ErrorVisual | SerializedVisual | StructVisual | EnumVisual;

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

  constructor(level: number, label: string, error: ErrorData, after: HTMLElement) {
    super();
    this.representation = HTMLDeclaration.create(level, label, label, error.message, undefined, undefined);
    after.after(this.representation);
  }
}

export class SerializedVisual extends Visual {
  readonly representation: HTMLDeclaration;

  constructor(
    sync: SyncNode,
    level: number,
    short: string,
    full: string,
    value: BrpValue,
    typePath: TypePath,
    after: HTMLElement
  ) {
    super();
    this.representation = HTMLDeclaration.create(level, short, full, value, typePath, (value: BrpValue) => {
      sync.mutate(value);
    });
    after.after(this.representation);
  }

  set(value: BrpValue) {
    this.representation.brpValue = value;
  }
}

//------------------------------------------------------------------------------

class HTMLDeclaration extends HTMLElement {
  private property: HTMLSpanElement;
  private htmlWrapper: HTMLDivElement;
  private htmlValue: HTMLJson | HTMLString; // VslNumber // VslBoolean // VslObject
  private fnMutate: (v: BrpValue) => void;

  static create(
    level: number,
    short: string,
    full: string,
    value: BrpValue,
    typePath: TypePath | undefined,
    fnMutate: ((value: BrpValue) => void) | undefined
  ): HTMLDeclaration {
    if (customElements.get('visual-declaration') === undefined) {
      customElements.define('visual-declaration', HTMLDeclaration);
    }
    const result = document.createElement('visual-declaration') as HTMLDeclaration;
    result.level = level;
    result.label = short;
    result.tooltip = full;
    result.brpValue = value;
    if (fnMutate !== undefined) result.onMutation = fnMutate;
    return result;
  }

  constructor() {
    super();

    this.fnMutate = () => {};

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
        this.htmlValue.stringValue = v;
      } else {
        console.log(`Replacing with HTMLJson for ${this.property.textContent}`);
        const replacement = HTMLJson.create(v);
        this.htmlValue.replaceWith(replacement);
        this.htmlValue = replacement;
        this.onMutation = this.fnMutate;
      }
    } /* HTMLJson */ else {
      if (typeof v === 'string') {
        console.log(`Replacing with HTMLString for ${this.property.textContent}`);
        const replacement = HTMLString.create(v);
        this.htmlValue.replaceWith(replacement);
        this.htmlValue = replacement;
        this.onMutation = this.fnMutate;
      } else {
        this.htmlValue.brpValue = v;
      }
    }
  }
  set onMutation(fn: (value: BrpValue) => void) {
    this.fnMutate = fn;
    this.htmlValue.onMutation = (v) => this.fnMutate(v);
  }
}

class HTMLJson extends HTMLElement {
  private buffer: BrpValue;
  private jsonElement: HTMLDivElement;
  private inEdit: boolean;
  private fnMutate: (value: BrpValue) => void;

  static create(value: BrpValue): HTMLJson {
    if (customElements.get('visual-json') === undefined) {
      customElements.define('visual-json', HTMLJson);
    }
    const result = document.createElement('visual-json') as HTMLJson;
    result.brpValue = value;
    return result;
  }

  constructor() {
    super();
    this.buffer = null;
    this.jsonElement = document.createElement('div');
    this.inEdit = false;
    this.fnMutate = () => {};

    // Interactions
    this.jsonElement.onfocus = () => {
      this.inEdit = true;
      this.setAttribute('focused', '');
    };
    this.jsonElement.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.jsonElement.innerText = this.parsedBuffer;
        this.jsonElement.blur();
        e.preventDefault();
      }

      // apply changes
      if (!(e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        try {
          const parsed = JSON.parse(this.jsonElement.innerText);
          this.fnMutate(parsed);
        } catch {
          /* empty */
        }
        this.jsonElement.innerText = this.parsedBuffer;
        this.jsonElement.blur();
      }
    };
    this.jsonElement.onchange = () => {
      this.buffer = this.jsonElement.innerText;
      this.jsonElement.blur();
    };
    this.jsonElement.onblur = () => {
      this.inEdit = false;
      this.jsonElement.innerText = this.parsedBuffer;
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

  private get parsedBuffer() {
    return JSON.stringify(this.buffer, null, 4);
  }

  set brpValue(v: BrpValue) {
    console.log('HTMLJSON.set()');
    this.buffer = v;
    if (this.inEdit) return;
    this.jsonElement.innerText = this.parsedBuffer;
  }

  set onMutation(call: (value: BrpValue) => void) {
    this.jsonElement.contentEditable = 'plaintext-only';
    this.fnMutate = call;
  }
}

class HTMLString extends HTMLElement {
  private textBuffer: string;
  private textElement: HTMLDivElement;
  private inEdit: boolean;
  private fnMutate: (value: BrpValue) => void;

  static create(text: string): HTMLString {
    if (customElements.get('visual-string') === undefined) {
      customElements.define('visual-string', HTMLString);
    }
    const result = document.createElement('visual-string') as HTMLString;
    result.stringValue = text;
    return result;
  }

  constructor() {
    super();
    this.textBuffer = '';
    this.textElement = document.createElement('div');
    this.inEdit = false;
    this.fnMutate = () => {};

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
          this.fnMutate(this.textElement.innerText);
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

  set stringValue(t: string) {
    console.log('HTMLString.set()');
    this.textBuffer = t;
    if (this.inEdit) return;
    this.textElement.innerText = this.textBuffer;
  }

  set onMutation(call: (value: BrpValue) => void) {
    this.textElement.contentEditable = 'plaintext-only';
    this.fnMutate = call;
  }
}
