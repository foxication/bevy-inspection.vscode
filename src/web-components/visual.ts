import { resolveTypePathFromRef } from '../common';
import { TypePath } from '../protocol/types';
import { HTMLMerged, HTMLSelectCustom } from './elements';
import {
  ArraySync,
  BooleanSync,
  ComponentListData,
  DataSync,
  EnumAsStringSync,
  ErrorData,
  JsonArraySync,
  JsonObjectSync,
  ListSync,
  MapSync,
  NullSync,
  NumberSync,
  RootOfData,
  SerializedSync,
  SetSync,
  StringSync,
  StructSync,
  TupleSync,
} from './section-components';

//
// Visual
//

export abstract class Visual {
  abstract dom: HTMLElement;
  abstract sync: RootOfData;

  show() {
    this.dom.style.removeProperty('display');
    this.showChildren();
  }
  hide() {
    this.dom.style.display = 'none';
    this.hideChildren();
  }
  showChildren() {
    if (this instanceof VisualWithSync && this.isExpanded) {
      this.sync.children.forEach((child) => child.visual.show());
    }
  }
  hideChildren() {
    this.sync.children.forEach((child) => child.visual.hide());
  }

  abstract getLevel(): number;
}

export class ComponentListVisual extends Visual {
  readonly dom: HTMLHeadingElement;

  constructor(public sync: ComponentListData, anchor: HTMLElement) {
    super();
    this.dom = ComponentListVisual.createHTML();
    anchor.append(this.dom);
  }

  static createHTML() {
    const result = document.createElement('h3');
    result.textContent = 'Components';
    return result;
  }

  getLevel(): number {
    return 0;
  }
}

export class ErrorVisual extends Visual {
  readonly dom: HTMLMerged;

  constructor(
    public sync: ErrorData,
    anchor: HTMLElement,
    public error: { code: number | undefined; message: string }
  ) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.setTooltipFrom(this.sync.getTooltip());
    this.dom.setValue(this.error.message);
    this.dom.allowValueWrapping();
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  getLevel(): number {
    const [, ...path] = this.sync.getPath();
    return path.length;
  }
}

//
// Visual with schema
//

export abstract class VisualWithSync extends Visual {
  dom: HTMLMerged = (this.dom = HTMLMerged.create());

  constructor(public sync: DataSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    const types = this.sync.getSchema().map((schema) => schema.typePath);
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.setTooltipFrom(this.sync.getTooltip());
    this.dom.vscodeContext({
      label: label,
      type: types.length === 0 ? undefined : types.join('(') + ')'.repeat(types.length - 1),
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }

  getLevel(): number {
    const [, ...path] = this.sync.getPath();
    return path.length;
  }
  set isExpandable(able: boolean) {
    if (able && this.dom.expansionState === 'disabled') {
      this.dom.makeExpandable(this.sync);
      return;
    }
    if (!able && this.dom.expansionState !== 'disabled') {
      this.dom.removeExpansibility();
      return;
    }
  }
  get isExpanded(): boolean {
    switch (this.dom.expansionState) {
      case 'expanded':
      case 'disabled': // by default return true as nothing to hide
        return true;
      case 'collapsed':
        return false;
    }
  }
}

//
// Expandable visual
//

export class EnumVisual extends VisualWithSync {
  constructor(public sync: EnumAsStringSync, anchor: HTMLElement) {
    super(sync, anchor);
    this.dom.setOptions(sync);
    const variant = this.sync.getVariant();
    if (
      variant !== undefined &&
      this.dom.htmlRight !== undefined &&
      sync.requestValueMutation !== undefined
    ) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
  }
  select(selection: string) {
    const errMsg = 'Wrong HTML in EnumVisual';
    if (!(this.dom.htmlRight?.value instanceof HTMLSelectCustom)) return console.error(errMsg);
    return this.dom.htmlRight.value.select(selection);
  }
}

export class StructVisual extends VisualWithSync {
  constructor(public sync: StructSync, anchor: HTMLElement) {
    super(sync, anchor);
  }

  get properties(): readonly { property: string; typePath: TypePath }[] {
    return (this.sync.schema.required ?? []).map((name) => {
      if (this.sync.schema.properties === undefined) return { property: name, typePath: '()' };
      return {
        property: name,
        typePath: resolveTypePathFromRef(this.sync.schema.properties[name]),
      };
    });
  }
}

export class TupleVisual extends VisualWithSync {
  constructor(public sync: TupleSync, anchor: HTMLElement) {
    super(sync, anchor);
  }

  get childTypePaths(): readonly TypePath[] {
    return (this.sync.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
}

export class ArrayVisual extends VisualWithSync {
  constructor(public sync: ArraySync, anchor: HTMLElement) {
    super(sync, anchor);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.items);
  }
}

export class ListVisual extends VisualWithSync {
  constructor(public sync: ListSync, anchor: HTMLElement) {
    super(sync, anchor);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.items);
  }
}

export class SetVisual extends VisualWithSync {
  constructor(public sync: SetSync, anchor: HTMLElement) {
    super(sync, anchor);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.items);
  }
}

export class MapVisual extends VisualWithSync {
  constructor(public sync: MapSync, anchor: HTMLElement) {
    super(sync, anchor);
  }
  get keyTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.keyType);
  }
  get valueTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.valueType);
  }
}

//
// BrpValue representations
//

export abstract class BrpValueVisual extends VisualWithSync {
  set(value: string | number | boolean | null): void {
    this.dom.setValue(value);
  }
  getParentTypePath(): TypePath | undefined {
    return this.sync.parent instanceof SerializedSync
      ? this.sync.parent.schema.typePath
      : undefined;
  }
}

export class JsonNullVisual extends BrpValueVisual {
  constructor(public sync: NullSync, anchor: HTMLElement) {
    super(sync, anchor);
    this.dom.setValue(null);
  }
}

export class JsonStringVisual extends BrpValueVisual {
  constructor(public sync: StringSync, anchor: HTMLElement) {
    super(sync, anchor);
    const value = sync.getValue();
    this.dom.setValue(typeof value === 'string' ? value : '???');
    if (
      value !== undefined &&
      this.dom.htmlRight !== undefined &&
      sync.requestValueMutation !== undefined
    ) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
  }
}

export class JsonNumberVisual extends BrpValueVisual {
  constructor(public sync: NumberSync, anchor: HTMLElement) {
    super(sync, anchor);
    const value = this.sync.getValue();
    this.dom.setValue(typeof value === 'number' ? value : NaN);
    if (
      value !== undefined &&
      this.dom.htmlRight !== undefined &&
      sync.requestValueMutation !== undefined
    ) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
  }
}

export class JsonBooleanVisual extends BrpValueVisual {
  constructor(public sync: BooleanSync, anchor: HTMLElement) {
    super(sync, anchor);
    const value = this.sync.getValue();
    this.dom.setValue(typeof value === 'boolean' ? value : false);
    if (
      value !== undefined &&
      this.dom.htmlRight !== undefined &&
      sync.requestValueMutation !== undefined
    ) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
  }
}

export class JsonObjectVisual extends BrpValueVisual {
  constructor(public sync: JsonObjectSync, anchor: HTMLElement) {
    super(sync, anchor);
  }
}

export class JsonArrayVisual extends BrpValueVisual {
  constructor(public sync: JsonArraySync, anchor: HTMLElement) {
    super(sync, anchor);
  }
}
