import { BrpValue, TypePath } from '../protocol';
import * as VslStyles from './styles';
import { SyncNode } from './sync';
import { EnumData, ErrorData } from './data';
import { StructVisual, EnumVisual } from './visual-expandable';

export abstract class Visual {
  abstract representation: HTMLElement;
  constructor(private _sync: SyncNode) {}

  preDestruct() {
    this.representation.remove();
  }
  show() {
    this.representation.style.removeProperty('display');
  }
  hide() {
    this.representation.style.display = 'none';
  }

  get sync() {
    return this._sync;
  }
  get data() {
    return this._sync.data;
  }
  get level() {
    return Math.max(this.sync.path.length - 1, 0);
  }
  get access() {
    return this.sync.access();
  }
  get typePath() {
    if ('schema' in this.data) return this.data.schema.typePath;
    return;
  }
  get label() {
    const data = this.data;
    let result = '';
    if ('schema' in data && data.schema.typePath === this.sync.lastPathSegment) {
      result = data.schema.shortPath;
    } else {
      result = (this.sync.lastPathSegment ?? '...').toString();
    }
    if (data instanceof EnumData) result += ' / ' + data.variantName;
    return result;
  }
  get tooltip(): string {
    const data = this.data;
    let result = 'label: ' + this.label;
    if ('schema' in data) {
      result += '\ntype: ' + data.schema.typePath;
      result += '\nkind: ' + data.schema.kind;
      if (data.schema.reflectTypes !== undefined) result += '\nreflect: ' + data.schema.reflectTypes.join(', ');
    }
    if (data instanceof EnumData) result += '\nvariant: ' + data.variantName;
    return result;
  }
}

export type AnyVisual = ComponentsVisual | ErrorVisual | SerializedVisual | StructVisual | EnumVisual;

export class ComponentsVisual extends Visual {
  readonly representation: HTMLHeadingElement;

  constructor(sync: SyncNode, anchor: HTMLElement) {
    super(sync);
    this.representation = ComponentsVisual.createVslHeading();
    anchor.append(this.representation);
  }

  static createVslHeading() {
    const result = document.createElement('h3');
    result.textContent = 'Component List';
    return result;
  }
}

export class ErrorVisual extends Visual {
  readonly representation: HTMLDeclaration;

  constructor(sync: SyncNode, anchor: HTMLElement) {
    super(sync);
    this.representation = HTMLDeclaration.create(
      this.level,
      this.label,
      this.tooltip,
      this.data instanceof ErrorData ? this.data.message : '', // never scenario
      undefined,
      undefined
    );
    anchor.after(this.representation);
  }
}

export class SerializedVisual extends Visual {
  readonly representation: HTMLDeclaration;

  constructor(sync: SyncNode, anchor: HTMLElement) {
    super(sync);
    this.representation = HTMLDeclaration.create(
      this.level,
      this.label,
      this.tooltip,
      this.access,
      this.typePath,
      (value: BrpValue) => {
        sync.mutate(value);
      }
    );
    anchor.after(this.representation);
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
        this.htmlValue.value = v;
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
        this.htmlValue.value = v;
      }
    }
  }
  set onMutation(fn: (value: BrpValue) => void) {
    this.fnMutate = fn;
    this.htmlValue.fnMutate = (v) => this.fnMutate(v);
  }
}

abstract class HTMLMutatable<T> extends HTMLElement {
  private _buffer: T;
  private _inEdit: boolean;
  private _fnMutate: (value: BrpValue) => void;

  constructor(defaultValue: T) {
    super();
    this._buffer = defaultValue;
    this._inEdit = false;
    this._fnMutate = () => {};
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

  get fnMutate() {
    return this._fnMutate;
  }
  set fnMutate(fn: (value: BrpValue) => void) {
    this._fnMutate = fn;
    this.allowEditing();
  }

  set value(v: T) {
    this._buffer = v;
    if (this.inEdit) return;
    this.setTextFromBuffer();
  }

  abstract setTextFromBuffer(): void;
  abstract allowEditing(): void;
}

class HTMLJson extends HTMLMutatable<BrpValue> {
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
          this.fnMutate(parsed);
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

class HTMLString extends HTMLMutatable<string> {
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
          this.fnMutate(this.textElement.innerText);
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
