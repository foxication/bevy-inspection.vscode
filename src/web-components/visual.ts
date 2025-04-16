import {
  BrpObject,
  BrpSchema,
  BrpValue,
  isBrpArray,
  isBrpIterable,
  isBrpObject,
  TypePath,
  TypePathReference,
} from '../protocol/types';
import { HTMLDeclaration, HTMLEnum, HTMLExpandable, HTMLStruct } from './elements';
import { postWebviewMessage } from './main';
import { SyncNode } from './sync';

// All types of visual
export type VisualUnit =
  | ArrayVisual
  | ComponentsVisual
  | EnumVisual
  | ErrorVisual
  | MapVisual
  | SerializedVisual
  | StructVisual
  | TupleVisual;

//
// Visual
//

export abstract class Visual {
  abstract dom: HTMLElement;
  constructor(private _sync: SyncNode) {}

  preDestruct() {
    this.dom.remove();
  }
  show() {
    this.dom.style.removeProperty('display');
  }
  hide() {
    this.dom.style.display = 'none';
  }

  get sync() {
    return this._sync;
  }
  get level() {
    return Math.max(this.sync.path.length - 1, 0);
  }
  get access() {
    return this.sync.access();
  }
}

export class ComponentsVisual extends Visual {
  readonly dom: HTMLHeadingElement;

  constructor(sync: SyncNode, anchor: HTMLElement, public componentNames: TypePath[]) {
    super(sync);
    this.dom = ComponentsVisual.createVslHeading();
    anchor.append(this.dom);
  }

  static createVslHeading() {
    const result = document.createElement('h3');
    result.textContent = 'Component List';
    return result;
  }
}

export class ErrorVisual extends Visual {
  readonly dom: HTMLDeclaration;

  constructor(sync: SyncNode, anchor: HTMLElement, public error: { code: number | undefined; message: string }) {
    super(sync);
    this.dom = HTMLDeclaration.create(
      this.level,
      (this.sync.lastPathSegment ?? '...').toString(),
      (this.error.code ?? 'Error').toString(),
      this.error.message,
      undefined
    );
    anchor.after(this.dom);
  }
}

//
// Visual with schema
//

export abstract class VisualDescribed extends Visual {
  constructor(sync: SyncNode, public readonly schema: BrpSchema) {
    super(sync);
  }
  get typePath() {
    return this.schema.typePath;
  }
  get label() {
    let result = '';
    if (this.schema.typePath === this.sync.lastPathSegment) {
      result = this.schema.shortPath;
    } else {
      result = (this.sync.lastPathSegment ?? '...').toString();
    }
    // if (data instanceof EnumData) result += ' / ' + data.variantName;
    return result;
  }
  get tooltip(): string {
    let result = 'label: ' + this.label;
    result += '\ntype: ' + this.schema.typePath;
    result += '\nkind: ' + this.schema.kind;
    if (this.schema.reflectTypes !== undefined) result += '\nreflect: ' + this.schema.reflectTypes.join(', ');
    // if (data instanceof EnumData) result += '\nvariant: ' + data.variantName;
    return result;
  }
}

export class SerializedVisual extends VisualDescribed {
  readonly dom: HTMLDeclaration;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema, public value: BrpValue) {
    super(sync, schema);
    this.dom = HTMLDeclaration.create(
      this.level,
      this.label,
      this.tooltip,
      this.access,
      new MutationConsent(sync)
    );
    anchor.after(this.dom);
  }

  set(value: BrpValue) {
    this.dom.brpValue = value;
  }
}

//
// Expandable visual
//

export abstract class ExpandableVisual extends VisualDescribed {
  abstract dom: HTMLExpandable;

  set isExpandable(able: boolean) {
    this.dom.isExpandable = able;
  }
  get isExpanded(): boolean {
    return this.dom.isExpanded;
  }
}

export class EnumVisual extends ExpandableVisual {
  readonly dom: HTMLEnum;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema, public variantTypePath: TypePath) {
    super(sync, schema);
    this.dom = HTMLEnum.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.dom);
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

export class StructVisual extends ExpandableVisual {
  readonly dom: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.dom = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
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
  readonly dom: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.dom = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.dom);
  }

  get childTypePaths(): readonly TypePath[] {
    return (this.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
}

export class ArrayVisual extends ExpandableVisual {
  readonly dom: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.dom = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class ListVisual extends ExpandableVisual {
  readonly dom: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.dom = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class SetVisual extends ExpandableVisual {
  readonly dom: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.dom = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.dom);
  }
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
}

export class MapVisual extends ExpandableVisual {
  readonly dom: HTMLStruct;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema) {
    super(sync, schema);
    this.dom = HTMLStruct.create(sync, this.level, this.label, this.tooltip);
    anchor.after(this.dom);
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

//
// Сomplementary
//

type InternalPathSegment = string | number;

export class MutationConsent {
  constructor(private sync: SyncNode, private internalPath: InternalPathSegment[] = []) {}

  cloneWithInternalPath(internalPath: InternalPathSegment[]) {
    return new MutationConsent(this.sync, internalPath);
  }

  mutate(value: BrpValue) {
    let result = structuredClone(this.sync.access());
    console.log(`BrpValue before: ${JSON.stringify(result, null, 4)}`);

    const edit = (access: BrpObject | BrpValue[], path: InternalPathSegment[]) => {
      const firstSegment = path[0];
      if (access === null) return;
      if (isBrpObject(access) && typeof firstSegment === 'string' && path.length === 1) {
        access[firstSegment] = value;
        return;
      }
      if (isBrpArray(access) && typeof firstSegment === 'number' && path.length === 1) {
        access[firstSegment] = value;
        return;
      }
      if (isBrpObject(access) && typeof firstSegment === 'string') {
        const next = access[firstSegment];
        if (isBrpIterable(next)) edit(next, path.slice(1));
        return;
      }
      if (isBrpArray(access) && typeof firstSegment === 'number') {
        const next = access[firstSegment];
        if (isBrpIterable(next)) edit(next, path.slice(1));
        return;
      }
      return;
    };

    if (this.internalPath.length === 0) result = value;
    else if (isBrpIterable(result)) edit(result, this.internalPath);
    console.log(`BrpValue after: ${JSON.stringify(result, null, 4)}`);

    const component = (this.sync.path[0] ?? '').toString();
    const path = this.sync.pathSerialized;
    postWebviewMessage({
      cmd: 'mutate_component',
      data: { component, path, value: result },
    });
  }
}

function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}
