import { BrpSchema, BrpValue, TypePath, TypePathReference } from '../protocol';
import { DataPathSegment } from './sync';

export class SerializedData {
  constructor(public readonly schema: BrpSchema, public value: BrpValue) {}
  // TODO: set()
}

export class EnumData {
  constructor(public readonly schema: BrpSchema, public variant: TypePath) {
    if (!this.variantTypePaths.includes(variant)) console.error(`Error: variant ${variant} doesn't exist`);
  }
  get variantName(): string {
    const parent = this.schema.typePath + '::';
    return this.variant.slice(parent.length);
  }
  get variantTypePaths(): readonly TypePath[] {
    return (this.schema.oneOf ?? []).map((value) => {
      if (typeof value === 'string') return this.schema.typePath + '::' + value;
      return value.typePath;
    });
  }
  // TODO: set()
}

export class TupleData {
  constructor(public readonly schema: BrpSchema) {}
  get childTypePaths(): readonly TypePath[] {
    return (this.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
  // TODO: set()
}

export class ArrayData {
  constructor(public readonly schema: BrpSchema) {}
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
  // TODO: set()
}

export class ListData {
  constructor(public readonly schema: BrpSchema) {}
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
  // TODO: set()
  // TODO: insert()
  // TODO: remove()
}

export class SetData {
  constructor(public readonly schema: BrpSchema) {}
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
  // TODO: insert()
  // TODO: remove()
}

export class StructData {
  constructor(public readonly schema: BrpSchema) {}
  get properties(): readonly { property: string; typePath: TypePath }[] {
    return (this.schema.required ?? []).map((name) => {
      if (this.schema.properties === undefined) return { property: name, typePath: '()' };
      return { property: name, typePath: resolveTypePathFromRef(this.schema.properties[name]) };
    });
  }
  // TODO: set()
}

export class MapData {
  constructor(public readonly schema: BrpSchema) {}
  get keyTypePath(): TypePath {
    if (this.schema.keyType === undefined) return '()';
    return resolveTypePathFromRef(this.schema.keyType);
  }
  get valueTypePath(): TypePath {
    if (this.schema.valueType === undefined) return '()';
    return resolveTypePathFromRef(this.schema.valueType);
  }
  // TODO: insert()
  // TODO: remove()
}

export class ComponentsData {
  constructor(public componentNames: TypePath[]) {}
  // TODO: insert()
  // TODO: remove()
}

export class ErrorData {
  public readonly message: string;
  constructor(public readonly code: number | undefined, message: string, location: DataPathSegment[] | undefined) {
    if (location !== undefined) this.message = message + ' ' + JSON.stringify(location);
    this.message = message;
  }
}

function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}
