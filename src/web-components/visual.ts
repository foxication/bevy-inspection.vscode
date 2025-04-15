import { BrpSchema, BrpValue, TypePath, TypePathReference } from '../protocol';
import { HTMLDeclaration, HTMLEnum, HTMLExpandable, HTMLStruct } from './elements';
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
  get level() {
    return Math.max(this.sync.path.length - 1, 0);
  }
  get access() {
    return this.sync.access();
  }
}

export class ComponentsVisual extends Visual {
  readonly representation: HTMLHeadingElement;

  constructor(sync: SyncNode, anchor: HTMLElement, public componentNames: TypePath[]) {
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

  constructor(sync: SyncNode, anchor: HTMLElement, public error: { code: number | undefined; message: string }) {
    super(sync);
    this.representation = HTMLDeclaration.create(
      this.level,
      (this.sync.lastPathSegment ?? '...').toString(),
      (this.error.code ?? 'Error').toString(),
      this.error.message,
      undefined,
      undefined
    );
    anchor.after(this.representation);
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
  readonly representation: HTMLDeclaration;

  constructor(sync: SyncNode, anchor: HTMLElement, schema: BrpSchema, public value: BrpValue) {
    super(sync, schema);
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

//
// Expandable visual
//

export abstract class ExpandableVisual extends VisualDescribed {
  abstract representation: HTMLExpandable;

  set isExpandable(able: boolean) {
    this.representation.isExpandable = able;
  }
  get isExpanded(): boolean {
    return this.representation.isExpanded;
  }
}

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

//
// Functions
//

function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}
