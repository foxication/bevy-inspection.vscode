import {
  BrpArraySchema,
  BrpEnumAsObjectSchema,
  BrpEnumAsStringSchema,
  BrpListSchema,
  BrpMapSchema,
  BrpSchemaUnit,
  BrpSetSchema,
  BrpStructSchema,
  BrpTupleSchema,
  BrpTupleStructSchema,
  BrpValue,
  TypePath,
} from '../protocol/types';
import { HTMLMerged } from './elements';
import { ComponentListSync, DataSync, DataSyncBasic, resolveTypePathFromRef } from './section-sync';

//
// Visual
//

export abstract class Visual {
  abstract dom: HTMLElement;
  abstract sync: DataSyncBasic;

  show() {
    this.dom.style.removeProperty('display');
  }
  hide() {
    this.dom.style.display = 'none';
  }

  abstract getLevel(): number;

  // get level() {
  //   let level = 0;
  //   if ('path' in this.sync.data) level += this.sync.data.path.length;
  //   if ('pathVirtual' in this.sync.data) level += this.sync.data.pathVirtual.length;
  //   return level;
  // }
}

export class ComponentListVisual extends Visual {
  readonly dom: HTMLHeadingElement;

  constructor(public sync: ComponentListSync, anchor: HTMLElement) {
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
    public sync: DataSync,
    anchor: HTMLElement,
    public error: { code: number | undefined; message: string }
  ) {
    super();
    const label = this.sync.label.toString();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = label;
    this.dom.tooltip = (this.error.code ?? 'Error').toString();
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

export abstract class VisualDescribed extends Visual {
  abstract schema: BrpSchemaUnit;
  abstract sync: DataSync;

  get tooltip(): string {
    let result = 'label: ' + this.sync.label;
    result += '\ntype: ' + this.schema.typePath;
    result += '\nkind: ' + this.schema.kind;
    if (this.schema.reflectTypes !== undefined) {
      result += '\nreflect: ' + this.schema.reflectTypes.join(', ');
    }
    return result;
  }

  getLevel(): number {
    const [, ...path] = this.sync.getPath();
    return path.length;
  }
}

export class SerializedVisual extends VisualDescribed {
  dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpSchemaUnit) {
    super();
    const value = this.sync.getValue();
    this.dom = HTMLMerged.create();
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    if (value !== undefined) this.dom.brpValue = value;
    if (this.dom.htmlRight !== undefined && sync.requestValueMutation !== undefined) {
      this.dom.htmlRight.value.mutability = sync.requestValueMutation;
    }
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
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

export abstract class ExpandableVisual extends VisualDescribed {
  abstract dom: HTMLMerged;

  set isExpandable(able: boolean) {
    this.dom.isExpandable = able;
  }
  get isExpanded(): boolean {
    return this.dom.htmlIcons.expand !== undefined;
  }
}

export class EnumVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(
    public sync: DataSync,
    anchor: HTMLElement,
    public schema: BrpEnumAsObjectSchema | BrpEnumAsStringSchema,
    public variantTypePath: TypePath
  ) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.onEnumEdit = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label + ' / ' + this.variantName;
    this.dom.tooltip = this.tooltipExtended;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
    if (!this.variantTypePaths.includes(this.variantTypePath)) {
      console.error(`Error: variant ${this.variantTypePath} doesn't exist`);
    }
  }
  get tooltipExtended(): string {
    let result = this.tooltip;
    result += '\nvariant: ' + this.variantName;
    result += '\navailable_variants: ' + this.variantShortPaths.join(', ');
    return result;
  }
  get variantName(): string {
    const parent = this.schema.typePath + '::';
    return this.variantTypePath.slice(parent.length);
  }
  get variantTypePaths(): readonly TypePath[] {
    return this.schema.oneOf.map((value) => {
      if (typeof value === 'string') return this.schema.typePath + '::' + value;
      return value.typePath;
    });
  }
  get variantShortPaths(): readonly string[] {
    return this.schema.oneOf.map((value) => {
      if (typeof value === 'string') return value;
      return value.shortPath;
    });
  }
}

export class StructVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpStructSchema) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }

  get properties(): readonly { property: string; typePath: TypePath }[] {
    return (this.schema.required ?? []).map((name) => {
      if (this.schema.properties === undefined) return { property: name, typePath: '()' };
      return { property: name, typePath: resolveTypePathFromRef(this.schema.properties[name]) };
    });
  }
}

export class TupleVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpTupleSchema) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }

  get childTypePaths(): readonly TypePath[] {
    return (this.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
}

export class TupleStructVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpTupleStructSchema) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }

  get childTypePaths(): readonly TypePath[] {
    return (this.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
}

export class ArrayVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpArraySchema) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class ListVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpListSchema) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class SetVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpSetSchema) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class MapVisual extends ExpandableVisual {
  readonly dom: HTMLMerged;

  constructor(public sync: DataSync, anchor: HTMLElement, public schema: BrpMapSchema) {
    super();
    this.dom = HTMLMerged.create();
    this.dom.onExpansion = sync;
    this.dom.level = this.getLevel();
    this.dom.label = this.sync.label.toString();
    this.dom.tooltip = this.tooltip;
    this.dom.vscodeContext({
      label: this.sync.label.toString(),
      type: this.schema.typePath,
      path: this.sync.getPathSerialized(),
    });
    anchor.after(this.dom);
  }
  get keyTypePath(): TypePath {
    return resolveTypePathFromRef(this.schema.keyType);
  }
  get valueTypePath(): TypePath {
    return resolveTypePathFromRef(this.schema.valueType);
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
