import { BrpValue } from '../protocol';
import { ComponentsData, EnumData, ErrorData, SerializedData, SyncNode } from './sync';
import * as VslStyles from './styles';
import { VscodeIcon } from '@vscode-elements/elements';

export class Visual {
  private representation: VslDeclaration | VslExpandable;
  private sync: SyncNode;

  constructor(sync: SyncNode, level: number, label: string | undefined, mount: HTMLElement) {
    this.sync = sync;
    const onMutation = (value: BrpValue) => {
      console.log('Called Visual.onMutation()');
      sync.mutate(value);
    };
    switch (true) {
      case sync.data instanceof ComponentsData:
        this.representation = createVslDeclaration(label, '___ComponentsData___', onMutation);
        break;
      case sync.data instanceof ErrorData:
        this.representation = createVslDeclaration(label, sync.data.message, onMutation);
        break;
      case sync.data instanceof SerializedData:
        this.representation = createVslDeclaration(label, sync.data.value, onMutation);
        break;
      case sync.data instanceof EnumData:
        this.representation = createVslDeclaration(label, sync.data.variantName, onMutation);
        break;
      default:
        this.representation = createVslExpandable(sync, level, label);
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

function createVslExpandable(sync: SyncNode, level: number, label: string | undefined): VslExpandable {
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

export class VslExpandable extends HTMLElement {
  private chevron: VscodeIcon;
  private indentation: HTMLDivElement;
  private labelElement: HTMLSpanElement;
  public isExpanded = true;

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

function createVslDeclaration(
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

export class VslDeclaration extends HTMLElement {
  private property: HTMLSpanElement;
  private valueWrapper: HTMLDivElement;
  private valueElement: VslString; // VslNumber // VslBoolean // VslObject

  constructor() {
    super();
    this.property = document.createElement('span');
    this.property.classList.add('left-side');

    this.valueWrapper = document.createElement('div');
    this.valueWrapper.classList.add('right-side');

    this.valueElement = createVslString('', () => {});
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

let isVslStringDefined = false;
function createVslString(text: string, onMutation: (value: BrpValue) => void): VslString {
  if (!isVslStringDefined) {
    customElements.define('visual-string', VslString);
    isVslStringDefined = true;
  }
  const result = document.createElement('visual-string') as VslString;
  result.text = text;
  result.onMutation = onMutation;
  return result;
}

class VslString extends HTMLElement {
  private textBuffer: string | undefined = undefined;
  private textElement: HTMLTextAreaElement;
  private inEdit: boolean;
  public mutate: (value: BrpValue) => void;

  constructor() {
    super();
    this.textElement = document.createElement('textarea');
    this.textElement.disabled = true;
    this.textElement.rows = 1;
    this.inEdit = false;
    this.mutate = () => {};

    // Interactions
    this.textElement.oninput = () => this.recalculateHeight();
    this.textElement.onfocus = () => {
      this.inEdit = true;
      this.setAttribute('focused', '');
    };
    this.textElement.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.textElement.value = this.textBuffer ?? '';
        this.textElement.blur();
        e.preventDefault();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        try {
          const parsed = JSON.parse(this.textElement.value);
          this.mutate(parsed);
        } catch {
          /* empty */
        }
        this.textElement.value = this.textBuffer ?? '';
        this.textElement.blur();
      }
    };
    this.textElement.onchange = () => {
      this.textBuffer = this.textElement.value;
      this.textElement.blur();
    };
    this.textElement.onblur = () => {
      this.inEdit = false;
      this.textElement.value = this.textBuffer ?? '';
      this.textElement.scrollTo(0, 0);
      this.removeAttribute('focused');
      this.recalculateHeight();
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.textArea];
    shadow.append(this.textElement);
    this.recalculateHeight();
  }

  set text(t: string | undefined) {
    this.textBuffer = t ?? '';
    this.textElement.disabled = t === undefined;
    
    if (this.inEdit) return;
    this.textElement.value = this.textBuffer;
    this.recalculateHeight();
  }

  set onMutation(call: (value: BrpValue) => void) {
    console.log('Set VslString.onMutation = ...');
    this.mutate = call;
  }

  private recalculateHeight() {
    this.textElement.style.height = 'auto';
    this.textElement.style.height = this.textElement.scrollHeight + 'px';
  }
}
