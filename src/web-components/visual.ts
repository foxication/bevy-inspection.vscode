import { BrpValue } from '../protocol';
import { ComponentsData, EnumData, ErrorData, SerializedData } from './data';
import * as VslStyles from './styles';
import { VscodeIcon } from '@vscode-elements/elements';
import { SyncNode } from './sync';

export class Visual {
  private representation: HTMLHeadingElement | VslDeclaration | VslExpandable;
  private sync: SyncNode;

  constructor(sync: SyncNode, level: number, label: string | undefined, mount: HTMLElement) {
    this.sync = sync;
    const onMutation = (value: BrpValue) => {
      console.log('Called Visual.onMutation()');
      sync.mutate(value);
    };
    switch (true) {
      case sync.data instanceof ComponentsData:
        this.representation = createVslHeading();
        break;
      case sync.data instanceof ErrorData:
        this.representation = VslDeclaration.create(label, sync.data.message, onMutation);
        break;
      case sync.data instanceof SerializedData:
        this.representation = VslDeclaration.create(label, sync.data.value, onMutation);
        break;
      case sync.data instanceof EnumData:
        this.representation = VslDeclaration.create(label, sync.data.variantName, onMutation);
        break;
      default:
        this.representation = VslExpandable.create(sync, level, label);
        break;
    }
    mount.append(this.representation);
  }

  set hasChildren(has: boolean) {
    if (this.representation instanceof VslExpandable) this.representation.isExpandable = has;
  }

  get isExpanded(): boolean {
    if (!(this.representation instanceof VslExpandable)) return true;
    return this.representation.isExpanded;
  }

  update(value: BrpValue) {
    if (!(this.representation instanceof VslDeclaration)) return;
    this.representation.brpValue = value;
  }

  preDestruct() {
    this.representation.remove();
  }

  show() {
    this.representation.style.removeProperty('display');
    console.log('showing');
  }
  hide() {
    this.representation.style.display = 'none';
    console.log('hiding');
  }
}

function createVslHeading() {
  const result = document.createElement('h3');
  result.textContent = 'Component List';
  return result;
}

export class VslExpandable extends HTMLElement {
  private chevron: VscodeIcon;
  private indentation: HTMLDivElement;
  private labelElement: HTMLSpanElement;
  public isExpanded = true;

  static create(sync: SyncNode, level: number, label: string | undefined): VslExpandable {
    if (customElements.get('visual-expandable') === undefined) {
      customElements.define('visual-expandable', VslExpandable);
    }
    const result = document.createElement('visual-expandable') as VslExpandable;
    result.level = level;
    result.label = label ?? '...';

    result.onclick = () => {
      console.log('trying to switch visibility of children');
      result.isExpanded = !result.isExpanded;
      if (result.isExpanded) sync.showChildren();
      else sync.hideChildren();
    };

    return result;
  }

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

export class VslDeclaration extends HTMLElement {
  private property: HTMLSpanElement;
  private valueWrapper: HTMLDivElement;
  private valueElement: VslString; // VslNumber // VslBoolean // VslObject

  static create(
    initialLabel: string | undefined,
    initialValue: BrpValue,
    onMutation: (value: BrpValue) => void
  ): VslDeclaration {
    if (customElements.get('visual-declaration') === undefined) {
      customElements.define('visual-declaration', VslDeclaration);
    }
    const result = document.createElement('visual-declaration') as VslDeclaration;
    result.label = initialLabel ?? '...';
    result.brpValue = initialValue;
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

  set label(text: string) {
    this.property.textContent = text;
  }
  set brpValue(value: BrpValue) {
    this.valueElement.text = JSON.stringify(value, null, 4);
  }
  set onMutation(fun: (value: BrpValue) => void) {
    console.log('Set VslDeclaration.onMutation = ...');
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
    console.log('Set VslString.onMutation = ...');
    this.mutate = call;
  }
}
