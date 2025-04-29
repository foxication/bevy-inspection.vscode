import { BrpValue, TypePath } from '../protocol/types';
import { HTMLMerged } from './elements';
import {
  ArraySync,
  ComponentListData,
  DataSync,
  DataWithAccess,
  ListSync,
  MapSync,
  RootOfData,
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
    if (this instanceof ExpandableVisual && this.isExpanded) {
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
    public sync: DataWithAccess,
    anchor: HTMLElement,
    public error: { code: number | undefined; message: string }
  ) {
    super();
    const label = this.sync.getLabelToRender();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.getErrorTooltip();
    this.dom.brpValue = this.error.message;
    this.dom.allowValueWrapping();
    this.dom.vscodeContext({
      label: label,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  getErrorTooltip(): string {
    let result = '';
    result += `label: ${this.sync.getLabelToRender()}`;
    if (this.error.code !== undefined) result += `\ncode: ${this.error.code}`;
    return result;
  }
  getLevel(): number {
    const [, ...path] = this.sync.getPath();
    return path.length;
  }
}

//
// Visual with schema
//

export abstract class VisualOnDataSync extends Visual {
  abstract sync: DataSync;

  get tooltip(): string {
    let result = 'label: ' + this.sync.getLabelToRender();
    result += '\ntype: ' + this.sync.schema.typePath;
    result += '\nkind: ' + this.sync.schema.kind;
    if (this.sync.schema.reflectTypes !== undefined) {
      result += '\nreflect: ' + this.sync.schema.reflectTypes.join(', ');
    }
    return result;
  }
  getComponentNameOrLabel(): string {
    if (this.sync.schema.reflectTypes?.includes('Component') === true) {
      return this.sync.schema.shortPath;
    }
    return this.sync.getLabelToRender();
  }
  getLevel(): number {
    const [, ...path] = this.sync.getPath();
    return path.length;
  }
}

export class SerializedVisual extends VisualOnDataSync {
  dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement) {
    super();
    const label = this.getComponentNameOrLabel();
    const value = this.sync.getValue();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.tooltip;
    if (value !== undefined) this.dom.brpValue = value;
    if (this.dom.htmlRight !== undefined && sync.requestValueMutation !== undefined) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
    this.dom.vscodeContext({
      label: label,
      type: this.sync.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }

  set(value: BrpValue) {
    this.dom.brpValue = value;
  }

  getLevel(): number {
    const [, ...path] = this.sync.getPath();
    return path.length;
  }
}

//
// Expandable visual
//

export abstract class ExpandableVisual extends VisualOnDataSync {
  abstract dom: HTMLMerged;

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

// export class EnumVisual extends ExpandableVisual {
//   readonly dom: HTMLMerged;

//   constructor(public sync: DataSync, anchor: HTMLElement, public variantTypePath: TypePath) {
//     super();
//     const label = this.getComponentNameOrLabel();
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

export class StructVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: StructSync, anchor: HTMLElement) {
    super();
    const label = this.getComponentNameOrLabel();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.tooltip;
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

export class TupleVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: TupleSync, anchor: HTMLElement) {
    super();
    const label = this.getComponentNameOrLabel();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.tooltip;
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

export class ArrayVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: ArraySync, anchor: HTMLElement) {
    super();
    const label = this.getComponentNameOrLabel();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.tooltip;
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

export class ListVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: ListSync, anchor: HTMLElement) {
    super();
    const label = this.getComponentNameOrLabel();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.tooltip;
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

export class SetVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: SetSync, anchor: HTMLElement) {
    super();
    const label = this.getComponentNameOrLabel();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.tooltip;
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

export class MapVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: MapSync, anchor: HTMLElement) {
    super();
    const label = this.getComponentNameOrLabel();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = this.tooltip;
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
// Сomplementary
//

// type InternalPathSegment = string | number;

// export class MutationConsent {
//   constructor(private sync: DataSync, private internalPath: InternalPathSegment[] = []) {}

//   cloneWithInternalPath(internalPath: InternalPathSegment[]) {
//     return new MutationConsent(this.sync, internalPath);
//   }

//   mutate(value: BrpValue) {
//     let result = structuredClone(this.sync.getValue());
//     const modify = (access: BrpObject | BrpValue[], path: InternalPathSegment[]) => {
//       const firstSegment = path[0];
//       if (isBrpObject(access) && typeof firstSegment === 'string' && path.length === 1) {
//         access[firstSegment] = value;
//       }
//       if (isBrpArray(access) && typeof firstSegment === 'number' && path.length === 1) {
//         access[firstSegment] = value;
//       }
//       if (isBrpObject(access) && typeof firstSegment === 'string') {
//         const next = access[firstSegment];
//         if (isBrpIterable(next)) modify(next, path.slice(1));
//       }
//       if (isBrpArray(access) && typeof firstSegment === 'number') {
//         const next = access[firstSegment];
//         if (isBrpIterable(next)) modify(next, path.slice(1));
//       }
//       return console.error(
//         `${this.constructor.name}.mutate().modify(): access is not Object/Array`
//       );
//     };

//     if (this.internalPath.length === 0) result = value;
//     else if (isBrpIterable(result)) modify(result, this.internalPath);

//     const focus = this.sync.getSection().getFocus();
//     const component = this.sync.getComponent();
//     const path = this.sync.getMutationPath();
//     if (focus === undefined) return console.error('MutationConsent.mutate(): no focus');
//     if (component === '') return console.error('MutationConsent.mutate(): no component');
//     postWebviewMessage({
//       cmd: 'mutate_component',
//       data: { focus, component, path, value: result },
//     });
//   }
// }
