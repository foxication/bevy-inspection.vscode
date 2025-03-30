import {
  BrpComponentRegistry,
  BrpRegistrySchema,
  BrpSchema,
  BrpValue,
  isBrpArray,
  isBrpObject,
  isPrimitive,
  TypePath,
  TypePathReference,
} from '../protocol/types';

type DataPathSegment = string | number | undefined;

class SerializedData {
  public readonly kind: BrpSchema['kind'];
  constructor(public readonly typePath: TypePath, public value: BrpValue, registrySchema: BrpRegistrySchema) {
    this.kind = registrySchema[typePath].kind;
  }
}

class EnumData {
  private readonly typePaths: { [variantName: string]: undefined | TypePath } = {};
  constructor(public readonly typePath: TypePath, public variant: TypePath, registrySchema: BrpRegistrySchema) {
    const oneOf = registrySchema[typePath].oneOf;
    if (oneOf === undefined) return;
    for (const variant of oneOf) {
      if (typeof variant === 'string') {
        this.typePaths[variant] = undefined;
        return;
      }
      if ('prefixItems' in variant) {
        const prefixItems = variant.prefixItems;
        if (prefixItems === undefined) this.typePaths[variant.shortPath] = undefined;
        else this.typePaths[variant.shortPath] = resolveTypePathFromRef(prefixItems[0]);
      } else {
        this.typePaths[variant.shortPath] = undefined;
      }
    }
  }
  public variantNames(): readonly string[] {
    return Object.keys(this.typePaths);
  }
  public childTypePath(variant: string = this.variant) {
    return this.typePaths[variant];
  }
}

class TupleData {
  public readonly fieldTypePaths: TypePath[] = [];
  constructor(public readonly typePath: TypePath, registrySchema: BrpRegistrySchema) {
    const prefix = registrySchema[typePath].prefixItems;
    if (prefix === undefined) return;
    for (const ref of prefix) {
      this.fieldTypePaths.push(resolveTypePathFromRef(ref));
    }
  }
}

class TupleStructData {
  public readonly fieldTypePaths: TypePath[] = [];
  constructor(public readonly typePath: TypePath, registrySchema: BrpRegistrySchema) {
    const prefix = registrySchema[typePath].prefixItems;
    if (prefix === undefined) return;
    for (const ref of prefix) {
      this.fieldTypePaths.push(resolveTypePathFromRef(ref));
    }
  }
}

class ArrayData {
  public readonly childTypePath;
  constructor(public readonly typePath: TypePath, registrySchema: BrpRegistrySchema) {
    const items = registrySchema[typePath].items;
    if (items === false || items === undefined) {
      this.childTypePath = '()';
      return;
    }
    this.childTypePath = resolveTypePathFromRef(items);
  }
}

class SetData {
  public readonly childTypePath;
  constructor(public readonly typePath: TypePath, registrySchema: BrpRegistrySchema) {
    const items = registrySchema[typePath].items;
    if (items === false || items === undefined) {
      this.childTypePath = '()';
      return;
    }
    this.childTypePath = resolveTypePathFromRef(items);
  }
}

class StructData {
  private fields: { [fieldName: string]: TypePath } = {};

  constructor(public readonly typePath: TypePath, registrySchema: BrpRegistrySchema) {
    const schema = registrySchema[typePath];

    if (schema.required === undefined) return;
    for (const fieldName of schema.required) {
      this.fields[fieldName] = typePathFromSchema(registrySchema, typePath, fieldName);
    }
  }

  public fieldNames(): readonly string[] {
    return Object.keys(this.fields);
  }

  public childTypePath(fieldName: string): TypePath {
    return this.fields[fieldName];
  }
}

class MapData {
  private fields: { [fieldName: string]: TypePath } = {};

  constructor(public readonly typePath: TypePath, registrySchema: BrpRegistrySchema) {
    const schema = registrySchema[typePath];

    if (schema.required === undefined) return;
    for (const fieldName of schema.required) {
      this.fields[fieldName] = typePathFromSchema(registrySchema, typePath, fieldName);
    }
  }

  public fieldNames(): readonly string[] {
    return Object.keys(this.fields);
  }

  public childTypePath(fieldName: string): TypePath {
    return this.fields[fieldName];
  }
}

class ComponentsData {
  constructor(public componentNames: TypePath[]) {}
}

// class Visual {
//   constructor(private element: HTMLElement) {}
// }

class SyncNode {
  private pathSegment: DataPathSegment;
  private data:
    | SerializedData // single
    | EnumData
    | TupleData // collection
    | TupleStructData
    | ArrayData // ordered collection
    | SetData
    | StructData // mapped collection
    | MapData
    | ComponentsData;
  // private visual: Visual; // TODO
  private children: SyncNode[] = [];

  constructor(private source: DataSyncManager, path: DataPathSegment[], typePath: TypePath | undefined) {
    this.pathSegment = path[path.length - 1];

    // Set data
    const access = this.access(path);
    if (path.length === 0 && isBrpObject(access)) {
      this.data = new ComponentsData(Object.keys(access));
      for (const childTypePath of this.data.componentNames) {
        this.children.push(new SyncNode(this.source, [...path, childTypePath], childTypePath));
      }
    } else if (typePath !== undefined && source.registrySchema[typePath].reflectTypes?.includes('Serialize')) {
      this.data = new SerializedData(typePath, access, source.registrySchema);
    } else if (typePath !== undefined) {
      const kind = source.registrySchema[typePath].kind;
      switch (kind) {
        case 'Value':
          this.data = new SerializedData(typePath, access, source.registrySchema);
          break;
        case 'Enum':
          if (isPrimitive(access)) {
            this.data = new EnumData(typePath, (access ?? '').toString(), source.registrySchema);
            break;
          }
          if (access.length === 1) {
            this.data = new EnumData(typePath, Object.keys(access)[0], source.registrySchema);
            this.children.push(new SyncNode(this.source, [...path, this.data.variant], this.data.childTypePath()));
            break;
          }
          this.data = new SerializedData(typePath, access, source.registrySchema);
          break;
        case 'Tuple':
          this.data = new TupleData(typePath, source.registrySchema);
          if (this.data.fieldTypePaths.length === 1) {
            this.children.push(new SyncNode(this.source, [...path], this.data.fieldTypePaths[0]));
            break;
          }
          for (const item of (access as BrpValue[]).keys()) {
            this.children.push(new SyncNode(this.source, [...path, item], this.data.fieldTypePaths[item]));
          }
          break;
        case 'TupleStruct':
          this.data = new TupleStructData(typePath, source.registrySchema);
          if (this.data.fieldTypePaths.length === 1) {
            this.children.push(new SyncNode(this.source, [...path, undefined], this.data.fieldTypePaths[0]));
            break;
          }
          for (const item of (access as BrpValue[]).keys()) {
            this.children.push(new SyncNode(this.source, [...path, item], this.data.fieldTypePaths[item]));
          }
          break;
        case 'Array':
        case 'List':
          this.data = new ArrayData(typePath, source.registrySchema);
          for (const item of (access as BrpValue[]).keys()) {
            this.children.push(new SyncNode(this.source, [...path, item], this.data.childTypePath));
          }
          break;
        case 'Set':
          this.data = new SetData(typePath, source.registrySchema);
          break;
        case 'Struct':
          this.data = new StructData(typePath, source.registrySchema);
          for (const fieldName of this.data.fieldNames()) {
            this.children.push(new SyncNode(this.source, [...path, fieldName], this.data.childTypePath(fieldName)));
          }
          break;
        case 'Map':
          this.data = new MapData(typePath, source.registrySchema);
          break;
      }
    } else {
      console.error(`Error in ExtSync.constructor(): ${access} is unknown`);
      this.data = new SerializedData(typePath ?? '()', access, source.registrySchema);
    }
  }
  public access(path: DataPathSegment[]): BrpValue {
    let access: BrpValue = this.source.mapOfComponents;

    for (const key of path) {
      // skip fake pathSegments
      if (key === undefined) continue;

      // access next level
      if (isBrpArray(access) && typeof key === 'number') {
        access = access[key];
        continue;
      } else if (isBrpObject(access) && typeof key === 'string') {
        access = access[key];
        continue;
      }
      console.error('Error in ExtSync.access(): parsing fail');
      return null;
    }
    return access;
  }
  public debugTree(level: number = 0): string {
    let result = '| '.repeat(level);

    const spaced = (s: string) => {
      const width = 20;
      return s + ' '.repeat(width - s.length) + ' ';
    };

    if (this.data instanceof SerializedData) {
      result += this.data.kind.toUpperCase() + '+SERDE';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath} = ${JSON.stringify(this.data.value)}\n`;
    }
    if (this.data instanceof EnumData) {
      result += 'ENUM        ';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath} = ${this.data.variant}\n`;
    }
    if (this.data instanceof TupleData) {
      result += 'TUPLE       ';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath}:\n`;
    }
    if (this.data instanceof TupleStructData) {
      result += 'TUPLE_STRUCT';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath}:\n`;
    }
    if (this.data instanceof ArrayData) {
      result += 'ARRAY       ';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath}:\n`;
    }
    if (this.data instanceof SetData) {
      result += 'SET         ';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath}:\n`;
    }
    if (this.data instanceof StructData) {
      result += 'STRUCT      ';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath}:\n`;
    }
    if (this.data instanceof MapData) {
      result += 'MAP         ';
      result = spaced(result);
      result += `${this.pathSegment ?? 'X'} --> ${this.data.typePath}:\n`;
    }
    if (this.data instanceof ComponentsData) {
      result += 'ROOT:\n';
    }

    this.children.forEach((child) => (result += child.debugTree(level + 1)));
    return result;
  }
  public sync() {} // TODO
}

export class DataSyncManager {
  private root: SyncNode;
  constructor(public mapOfComponents: BrpComponentRegistry, public registrySchema: BrpRegistrySchema) {
    this.root = new SyncNode(this, [], undefined);
  }
  sync() {
    this.root.sync();
  }
  debugTree(): string {
    return this.root.debugTree();
  }
}

function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}

// function typePathFromStruct(registrySchema: BrpRegistrySchema, parent: TypePath, fieldName: string): TypePath {
//   const properties = registrySchema[parent].properties;
//   if (properties !== undefined) return resolveTypePathFromRef(properties[fieldName]);
//   return '()';
// }
// function typePathFromStructSerializedAsArray(
//   registrySchema: BrpRegistrySchema,
//   parent: TypePath,
//   fieldName: number
// ): TypePath {
//   const properties = registrySchema[parent].properties;
//   if (properties !== undefined) {
//     return resolveTypePathFromRef(properties[Object.keys(properties)[fieldName]]);
//   }
//   return '()';
// }
// function typePathInTupleStruct(registrySchema: BrpRegistrySchema, parent: TypePath, fieldName: number) {
//   const prefixItems = registrySchema[parent].prefixItems;
//   if (prefixItems !== undefined) {
//     return resolveTypePathFromRef(prefixItems[fieldName]);
//   }
//   return '()';
// }

function typePathFromSchema(registrySchema: BrpRegistrySchema, parent: TypePath, fieldName: string | number): TypePath {
  const fun = () => {
    let result = '()';
    const schema = registrySchema[parent];
    if (schema === undefined) return result;

    const items = registrySchema[parent].items;
    if (items !== false && items !== undefined) {
      result = resolveTypePathFromRef(items);
    }

    const properties = registrySchema[parent].properties;
    if (properties !== undefined && typeof fieldName === 'string') {
      result = resolveTypePathFromRef(properties[fieldName]);
    }
    if (properties !== undefined && typeof fieldName === 'number') {
      result = resolveTypePathFromRef(properties[Object.keys(properties)[fieldName]]);
    }

    const prefixItems = registrySchema[parent].prefixItems;
    if (prefixItems !== undefined && typeof fieldName === 'number') {
      result = resolveTypePathFromRef(prefixItems[Math.min(fieldName, prefixItems.length - 1)]);
    }

    return result;
  };

  const result = fun();
  if (result === '()') console.error(`Error in typePathFromSchema(): unknown TypePath in ${parent}`);
  return result;
}
