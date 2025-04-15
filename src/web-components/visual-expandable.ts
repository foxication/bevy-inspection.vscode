import { SyncNode } from './sync';
import { VisualDescribed } from './visual';
import { VscodeIcon } from '@vscode-elements/elements';
import * as VslStyles from './styles';
import { BrpSchema, TypePath, TypePathReference } from '../protocol';

//------------------------------------------------------------------------------

export abstract class ExpandableVisual extends VisualDescribed {
  abstract representation: HTMLExpandable;

  set isExpandable(able: boolean) {
    this.representation.isExpandable = able;
  }
  get isExpanded(): boolean {
    return this.representation.isExpanded;
  }
}

abstract class HTMLExpandable extends HTMLElement {
  public isExpanded = true;
  abstract set isExpandable(is: boolean);
}

//------------------------------------------------------------------------------

export class EnumVisual extends ExpandableVisual {
  readonly representation: HTMLEnum;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema, public variantTypePath: TypePath) {
    super(sync, schema);
    this.representation = HTMLEnum.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.representation);
    if (!this.variantTypePaths.includes(this.variantTypePath)) {
      console.error(`Error: variant ${this.variantTypePath} doesn't exist`);
    }
  }
  get variantName(): string {
    const parent = this.schema.typePath + '::';
    return this.variantTypePath.slice(parent.length);
  }
  get variantTypePaths(): readonly TypePath[] {
    return (this.schema.oneOf ?? []).map((value) => {
      if (typeof value === 'string') return this.schema.typePath + '::' + value;
      return value.typePath;
    });
  }
}

class HTMLEnum extends HTMLExpandable {
  private htmlLabel: HTMLSpanElement;
  private buttonEdit: VscodeIcon;
  private chevron: VscodeIcon;

  static create(sync: SyncNode, level: number, short: string, full: string): HTMLEnum {
    if (customElements.get('visual-enum') === undefined) {
      customElements.define('visual-enum', HTMLEnum);
    }
    const result = document.createElement('visual-enum') as HTMLEnum;
    result.level = level;
    result.label = short;
    result.tooltip = full;

    result.onclick = () => {
      result.isExpanded = !result.isExpanded;
      if (result.isExpanded) {
        result.chevron.setAttribute('name', 'chevron-up');
        sync.showChildren();
      } else {
        result.chevron.setAttribute('name', 'chevron-down');
        sync.hideChildren();
      }
    };

    return result;
  }

  constructor() {
    super();
    this.htmlLabel = document.createElement('span');

    this.buttonEdit = document.createElement('vscode-icon');
    this.buttonEdit.setAttribute('name', 'symbol-property');

    this.chevron = document.createElement('vscode-icon');
    this.chevron.setAttribute('name', 'chevron-up');
    this.chevron.setAttribute('class', 'rotatable');
    this.chevron.style.display = 'none';
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.buttons, VslStyles.expandable];
    shadow.append(this.htmlLabel, this.buttonEdit, this.chevron);
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
  set tooltip(text: string) {
    this.htmlLabel.title = text;
  }
}

//------------------------------------------------------------------------------

export class StructVisual extends ExpandableVisual {
  readonly representation: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.representation = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.representation);
  }

  get properties(): readonly { property: string; typePath: TypePath }[] {
    return (this.schema.required ?? []).map((name) => {
      if (this.schema.properties === undefined) return { property: name, typePath: '()' };
      return { property: name, typePath: resolveTypePathFromRef(this.schema.properties[name]) };
    });
  }
}

export class TupleVisual extends ExpandableVisual {
  readonly representation: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.representation = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.representation);
  }

  get childTypePaths(): readonly TypePath[] {
    return (this.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
}

export class ArrayVisual extends ExpandableVisual {
  readonly representation: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.representation = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.representation);
  }
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class ListVisual extends ExpandableVisual {
  readonly representation: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.representation = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.representation);
  }
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class SetVisual extends ExpandableVisual {
  readonly representation: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.representation = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.representation);
  }
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class MapVisual extends ExpandableVisual {
  readonly representation: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.representation = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.representation);
  }
  get keyTypePath(): TypePath {
    if (this.schema.keyType === undefined) return '()';
    return resolveTypePathFromRef(this.schema.keyType);
  }
  get valueTypePath(): TypePath {
    if (this.schema.valueType === undefined) return '()';
    return resolveTypePathFromRef(this.schema.valueType);
  }
}

class HTMLStruct extends HTMLElement {
  private chevron: VscodeIcon;
  private htmlLabel: HTMLSpanElement;
  public isExpanded = true;

  static create(sync: SyncNode, level: number, short: string, full: string): HTMLStruct {
    if (customElements.get('visual-expandable') === undefined) {
      customElements.define('visual-expandable', HTMLStruct);
    }
    const result = document.createElement('visual-expandable') as HTMLStruct;
    result.level = level;
    result.label = short;
    result.tooltip = full;

    result.onclick = () => {
      result.isExpanded = !result.isExpanded;
      if (result.isExpanded) {
        result.chevron.setAttribute('name', 'chevron-up');
        sync.showChildren();
      } else {
        result.chevron.setAttribute('name', 'chevron-down');
        sync.hideChildren();
      }
    };

    return result;
  }

  constructor() {
    super();
    this.htmlLabel = document.createElement('span');

    this.chevron = document.createElement('vscode-icon');
    this.chevron.setAttribute('name', 'chevron-up');
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
  set tooltip(text: string) {
    this.htmlLabel.title = text;
  }
}

function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}