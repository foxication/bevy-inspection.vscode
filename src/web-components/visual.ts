import { BrpValue } from '../protocol';
import * as VslStyles from './styles';
import { VscodeIcon } from '@vscode-elements/elements';
import { SyncNode } from './sync';
import { ErrorData } from './data';

abstract class Visual {
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
    this.representation = createVslHeading();
    mount.append(this.representation);
  }
}

export class ErrorVisual extends Visual {
  readonly representation: VslDeclaration;

  constructor(level: number, error: ErrorData, mount: HTMLElement) {
    super();
    const label = error.code === undefined ? 'Error' : 'Error' + error.code;
    this.representation = VslDeclaration.create(level, label, error.message, () => {});
    mount.append(this.representation);
  }
}

export class SerializedVisual extends Visual {
  readonly representation: VslDeclaration;

  constructor(sync: SyncNode, level: number, label: string, value: BrpValue, mount: HTMLElement) {
    super();
    this.representation = VslDeclaration.create(level, label, value, (value: BrpValue) => {
      sync.mutate(value);
    });
    mount.append(this.representation);
  }

  set(value: BrpValue) {
    this.representation.brpValue = value;
  }
}

export class EnumVisual extends Visual {
  readonly representation: VslExpandable;

  constructor(sync: SyncNode, level: number, label: string, mount: HTMLElement) {
    super();
    this.representation = VslExpandable.create(sync, level, label);
    mount.append(this.representation);
  }
}

export class ExpandableVisual extends Visual {
  readonly representation: VslExpandable;

  constructor(sync: SyncNode, level: number, label: string, mount: HTMLElement) {
    super();
    this.representation = VslExpandable.create(sync, level, label);
    mount.append(this.representation);
  }

  set isExpandable(able: boolean) {
    this.representation.isExpandable = able;
  }

  get isExpanded(): boolean {
    return this.representation.isExpanded;
  }
}

function createVslHeading() {
  const result = document.createElement('h3');
  result.textContent = 'Component List';
  return result;
}

export class VslExpandable extends HTMLElement {
  private chevron: VscodeIcon;
  private htmlLabel: HTMLSpanElement;
  public isExpanded = true;

  static create(sync: SyncNode, level: number, label: string): VslExpandable {
    if (customElements.get('visual-expandable') === undefined) {
      customElements.define('visual-expandable', VslExpandable);
    }
    const result = document.createElement('visual-expandable') as VslExpandable;
    result.level = level;
    result.label = label ?? '...';

    result.onclick = () => {
      result.isExpanded = !result.isExpanded;
      if (result.isExpanded) sync.showChildren();
      else sync.hideChildren();
    };

    return result;
  }

  constructor() {
    super();
    this.htmlLabel = document.createElement('span');

    this.chevron = document.createElement('vscode-icon');
    this.chevron.setAttribute('name', 'chevron-right');
    this.chevron.setAttribute('class', 'rotatable');
    this.chevron.style.display = 'none';
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.expandable];
    shadow.append(this.htmlLabel, this.chevron);
  }

  set level(l: number) {
    const indent = l * 16;
    this.htmlLabel.style.textIndent = indent.toString() + 'px';
  }
  set isExpandable(is: boolean) {
    if (is) this.chevron.style.removeProperty('display');
    else this.chevron.style.display = 'none';
  }
  set label(text: string) {
    this.htmlLabel.textContent = text;
  }
}

export class VslDeclaration extends HTMLElement {
  private property: HTMLSpanElement;
  private valueWrapper: HTMLDivElement;
  private valueElement: VslString; // VslNumber // VslBoolean // VslObject

  static create(level: number, label: string, value: BrpValue, onMutation: (value: BrpValue) => void): VslDeclaration {
    if (customElements.get('visual-declaration') === undefined) {
      customElements.define('visual-declaration', VslDeclaration);
    }
    const result = document.createElement('visual-declaration') as VslDeclaration;
    result.level = level;
    result.label = label;
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

    this.valueElement = VslString.create('', () => {});
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
  set brpValue(value: BrpValue) {
    this.valueElement.text = JSON.stringify(value, null, 4);
  }
  set onMutation(fun: (value: BrpValue) => void) {
    this.valueElement.onMutation = fun;
  }
}

class VslString extends HTMLElement {
  private textBuffer: string | undefined = undefined;
  private textElement: HTMLDivElement;
  private inEdit: boolean;
  public mutate: (value: BrpValue) => void;

  static create(text: string, onMutation: (value: BrpValue) => void): VslString {
    if (customElements.get('visual-string') === undefined) {
      customElements.define('visual-string', VslString);
    }
    const result = document.createElement('visual-string') as VslString;
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
