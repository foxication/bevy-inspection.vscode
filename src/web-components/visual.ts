import { BrpValue, TypePath } from '../protocol/types';
import { HTMLMerged } from './elements';
import {
  ArraySync,
  ComponentListData,
  DataSync,
  ErrorData,
  ListSync,
  MapSync,
  NullSync,
  RootOfData,
  SerializedSync,
  SetSync,
  StructSync,
  TupleSync,
  resolveTypePathFromRef,
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
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.brpValue = this.error.message;
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
  abstract dom: HTMLMerged;
  abstract sync: DataSync;

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

export class SerializedVisual extends VisualWithSync {
  dom: HTMLMerged;

  constructor(public sync: SerializedSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
}

//
// Expandable visual
//

// export class EnumVisual extends VisualOnDataSync {
//   readonly dom: HTMLMerged;

//   constructor(public sync: DataSync, anchor: HTMLElement, public variantTypePath: TypePath) {
//     super();
//     const label = this.sync.getLabelToRender();
//     this.dom = HTMLMerged.create();
//     this.dom.onEnumEdit = sync;
//     this.dom.level = this.getLevel();
//     this.dom.label = label + ' / ' + this.variantName;
//     this.dom.tooltip = this.tooltipExtended;
//     this.dom.vscodeContext({
//       label: label,
//       type: this.sync.schema.typePath,
//       path: this.sync.getPathSerialized(),
//     });
//     anchor.after(this.dom);
//     if (!this.variantTypePaths.includes(this.variantTypePath)) {
//       console.error(`Error: variant ${this.variantTypePath} doesn't exist`);
//     }
//   }
//   get tooltipExtended(): string {
//     let result = this.tooltip;
//     result += '\nvariant: ' + this.variantName;
//     result += '\navailable_variants: ' + this.variantShortPaths.join(', ');
//     return result;
//   }
//   get variantName(): string {
//     const parent = this.sync.schema.typePath + '::';
//     return this.variantTypePath.slice(parent.length);
//   }
//   get variantTypePaths(): readonly TypePath[] {
//     return this.sync.schema.oneOf.map((value) => {
//       if (typeof value === 'string') return this.sync.schema.typePath + '::' + value;
//       return value.typePath;
//     });
//   }
//   get variantShortPaths(): readonly string[] {
//     return this.sync.schema.oneOf.map((value) => {
//       if (typeof value === 'string') return value;
//       return value.shortPath;
//     });
//   }
// }

export class StructVisual extends VisualWithSync {
  readonly dom: HTMLMerged;

  constructor(public sync: StructSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
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
  readonly dom: HTMLMerged;

  constructor(public sync: TupleSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }

  get childTypePaths(): readonly TypePath[] {
    return (this.sync.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
}

export class ArrayVisual extends VisualWithSync {
  readonly dom: HTMLMerged;

  constructor(public sync: ArraySync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.items);
  }
}

export class ListVisual extends VisualWithSync {
  readonly dom: HTMLMerged;

  constructor(public sync: ListSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.items);
  }
}

export class SetVisual extends VisualWithSync {
  readonly dom: HTMLMerged;

  constructor(public sync: SetSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.sync.schema.items);
  }
}

export class MapVisual extends VisualWithSync {
  readonly dom: HTMLMerged;

  constructor(public sync: MapSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
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
  set(value: BrpValue) {
    this.dom.brpValue = value;
  }
  getLevel(): number {
    const [, ...path] = this.sync.getPath();
    return path.length;
  }
}

export class NullVisual extends BrpValueVisual {
  dom: HTMLMerged;

  constructor(public sync: NullSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.brpValue = null;
    if (this.dom.htmlRight !== undefined && sync.requestValueMutation !== undefined) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
}

export class StringVisual extends BrpValueVisual {
  dom: HTMLMerged;

  constructor(public sync: NullSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    const value = this.sync.getValue();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.brpValue = value ?? '';
    if (
      value !== undefined &&
      this.dom.htmlRight !== undefined &&
      sync.requestValueMutation !== undefined
    ) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
}

export class NumberVisual extends BrpValueVisual {
  dom: HTMLMerged;

  constructor(public sync: NullSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    const value = this.sync.getValue();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.brpValue = value ?? '';
    if (
      value !== undefined &&
      this.dom.htmlRight !== undefined &&
      sync.requestValueMutation !== undefined
    ) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
}

export class BooleanVisual extends BrpValueVisual {
  dom: HTMLMerged;

  constructor(public sync: NullSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    const value = this.sync.getValue();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.brpValue = value ?? false;
    if (
      value !== undefined &&
      this.dom.htmlRight !== undefined &&
      sync.requestValueMutation !== undefined
    ) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
}

export class JsonObjectVisual extends BrpValueVisual {
  dom: HTMLMerged;

  constructor(public sync: NullSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
}

export class JsonArrayVisual extends BrpValueVisual {
  dom: HTMLMerged;

  constructor(public sync: NullSync, anchor: HTMLElement) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.sync.getTooltip();
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
}
