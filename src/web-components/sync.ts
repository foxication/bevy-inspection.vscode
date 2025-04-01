import {
  BrpComponentRegistry,
  BrpRegistrySchema,
  BrpSchema,
  BrpValue,
  isBrpArray,
  isBrpObject,
  TypePath,
  TypePathReference,
} from '../protocol/types';

type DataPathSegment = string | number | undefined;

class SerializedData {
  constructor(public readonly schema: BrpSchema, public value: BrpValue) {}
  // TODO: set()
}

class EnumData {
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

class TupleData {
  constructor(public readonly schema: BrpSchema) {}
  get childTypePaths(): readonly TypePath[] {
    return (this.schema.prefixItems ?? []).map((ref) => {
      return resolveTypePathFromRef(ref);
    });
  }
  // TODO: set()
}

class ArrayData {
  constructor(public readonly schema: BrpSchema) {}
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
  // TODO: set()
  // TODO: insert()
  // TODO: append()
  // TODO: remove()
}

class SetData {
  constructor(public readonly schema: BrpSchema) {}
  get childTypePath(): TypePath {
    if (typeof this.schema.items !== 'object') return '()';
    return resolveTypePathFromRef(this.schema.items);
  }
  // TODO: append()
  // TODO: remove()
}

class StructData {
  constructor(public readonly schema: BrpSchema) {}
  get properties(): readonly { property: string; typePath: TypePath }[] {
    return (this.schema.required ?? []).map((name) => {
      if (this.schema.properties === undefined) return { property: name, typePath: '()' };
      return { property: name, typePath: resolveTypePathFromRef(this.schema.properties[name]) };
    });
  }
  // TODO: set()
}

class MapData {
  constructor(public readonly schema: BrpSchema) {}
  get keyTypePath(): TypePath {
    if (this.schema.keyType === undefined) return '()';
    return resolveTypePathFromRef(this.schema.keyType);
  }
  get valueTypePath(): TypePath {
    if (this.schema.valueType === undefined) return '()';
    return resolveTypePathFromRef(this.schema.valueType);
  }
  // TODO: set()
  // TODO: insert()
  // TODO: append()
  // TODO: remove()
}

class ComponentsData {
  constructor(public componentNames: TypePath[]) {}
}

// class Visual {
//   constructor(private element: HTMLElement) {}
// }

class SyncNode {
  private source: DataSyncManager;
  private path: DataPathSegment[];
  private children: SyncNode[] = [];
  private data:
    | SerializedData
    | EnumData
    | TupleData
    | ArrayData
    | SetData
    | StructData
    | MapData
    | ComponentsData
    | undefined;
  // private visual: Visual; // TODO

  constructor(source: DataSyncManager, path: DataPathSegment[], typePath: TypePath | undefined) {
    this.source = source;
    this.path = path;

    const access = this.access(path);

    // ComponentsData
    if (path.length === 0) {
      if (!isBrpObject(access)) {
        console.error(`Error: ${path} is not an BrpObject`);
        this.data = undefined;
        return;
      }
      this.data = new ComponentsData(Object.keys(access));
      for (const childTypePath of this.data.componentNames) {
        this.children.push(new SyncNode(source, [...path, childTypePath], childTypePath));
      }
      return;
    }

    // Error scenarios
    if (typePath === undefined) {
      console.error(`Error: ${path} has undefined typePath`);
      this.data = undefined;
      return;
    }
    const schema = getSchemaRecursively(typePath, source.registrySchema);
    if (schema === undefined) {
      console.error(`Error: schema for ${path} is not found`);
      this.data = undefined;
      return;
    }

    // SerializedData
    if (schema.reflectTypes?.includes('Serialize')) {
      this.data = new SerializedData(schema, access);
      return;
    }

    // Parsing
    switch (schema.kind) {
      case 'Value':
        console.error(`Error: value ${path} is not serializable`);
        this.data = undefined;
        break;
      case 'Enum':
        if (typeof access === 'string') {
          const variant = schema.typePath + '::' + access;
          this.data = new EnumData(schema, variant);
          break;
        }
        if (isBrpObject(access) && Object.keys(access).length >= 1) {
          const variant = schema.typePath + '::' + Object.keys(access)[0];
          this.data = new EnumData(schema, variant);
          this.children.push(new SyncNode(this.source, [...path, this.data.variantName], this.data.variant));
          break;
        }
        console.error(`Error in parsing enum: ${access}`);
        this.data = undefined;
        break;
      case 'Tuple':
      case 'TupleStruct': {
        this.data = new TupleData(schema);
        if (this.data.childTypePaths.length === 1) {
          this.children.push(new SyncNode(this.source, [...path, undefined], this.data.childTypePaths[0]));
          break;
        }
        let index = 0;
        for (const childTypePath of this.data.childTypePaths) {
          this.children.push(new SyncNode(this.source, [...path, index], childTypePath));
          index++;
        }
        break;
      }
      case 'Array':
      case 'List':
        this.data = new ArrayData(schema);
        if (!isBrpArray(access)) {
          console.error(`Error in parsing: ${path} is not an array`);
          break;
        }
        for (const item of access.keys()) {
          this.children.push(new SyncNode(this.source, [...path, item], this.data.childTypePath));
        }
        break;
      case 'Set':
        this.data = new SetData(schema);
        if (!isBrpArray(access)) {
          console.error(`Error in parsing: ${path} is not a set`);
          break;
        }
        for (const item of access.keys()) {
          this.children.push(new SyncNode(this.source, [...path, item], this.data.childTypePath));
        }
        break;
      case 'Struct':
        this.data = new StructData(schema);
        for (const { property, typePath: childTypePath } of this.data.properties) {
          this.children.push(new SyncNode(this.source, [...path, property], childTypePath));
        }
        break;
      case 'Map':
        this.data = new MapData(schema);
        if (!isBrpObject(access)) {
          console.error(`Error in parsing: ${path} is not a map`);
          break;
        }
        for (const key of Object.keys(access)) {
          this.children.push(new SyncNode(this.source, [...path, key], this.data.valueTypePath));
        }
        break;
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
      console.error('Error in ExtSync.access(): tried to parse ' + JSON.stringify(path));
      return null;
    }
    return access;
  }
  public debugTree(level: number, filter?: TypePath[]): string {
    const pathSegment = this.path.length >= 1 ? this.path[this.path.length - 1] : undefined;
    const spaced = (s: string) => {
      const width = 45;
      return s + ' '.repeat(Math.max(width - s.length, 0));
    };

    // Set treeSegment
    let treeSegment = '| '.repeat(level);
    if (this.data instanceof ComponentsData) treeSegment += 'COMPONENTS:';
    else treeSegment += pathSegment ?? '...';

    // Set description
    let description = '';
    if (this.data === undefined) {
      description += '__parsing_error__';
      return spaced(treeSegment) + ' ' + description + '\n'; // Parsing error
    }
    if (!(this.data instanceof ComponentsData)) description += this.data.schema.kind;
    if (this.data instanceof SerializedData) description += '+Serde';
    if (!(this.data instanceof ComponentsData)) {
      description += '(' + this.data.schema.typePath + ')';
    }
    if (this.data instanceof SerializedData) {
      description += ' = ';
      description += JSON.stringify(this.data.value);
    }
    if (this.data instanceof EnumData) {
      description += '/';
      description += JSON.stringify(this.data.variantName);
    }

    // Set after
    let after = '';
    this.children.forEach((child) => {
      const toSkip =
        this.data instanceof ComponentsData &&
        filter !== undefined &&
        !(child.data instanceof ComponentsData) &&
        !filter.includes(child.data?.schema.typePath ?? '');

      if (!toSkip) after += child.debugTree(level + 1, filter);
    });

    return spaced(treeSegment) + ' ' + description + '\n' + after;
  }
  public sync(path: DataPathSegment[]) {
    // Set data
    const access = this.access(path);
    if (this.data instanceof ComponentsData) {
      for (const childTypePath of this.data.componentNames) {
        this.children.forEach((child) => child.sync([...path, childTypePath]));
      }
      return;
    }
    if (this.data instanceof SerializedData) {
      if (this.data.value === access) return;
      console.log(`Updating ${path} = ${this.data.value}`);
      this.data.value = access;
    }
    if (this.data instanceof EnumData && typeof access === 'string') {
      if (this.data.variant === access) return;
      console.log(`Updating ${path} = ${this.data.variant}`);
      this.data.variant = access;
    }
    // if (this.data instanceof EnumData && isBrpObject(access)) {}

    this.children.forEach((child) => child.sync(path));
  }
}

export class DataSyncManager {
  private root: SyncNode;
  constructor(public mapOfComponents: BrpComponentRegistry, public registrySchema: BrpRegistrySchema) {
    this.root = new SyncNode(this, [], undefined);
  }
  sync() {
    this.root.sync([]);
  }
  debugTree(filter?: TypePath[]): string {
    return this.root.debugTree(0, filter);
  }
}

function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}

function getSchemaRecursively(typePath: TypePath, registrySchema: BrpRegistrySchema): BrpSchema | undefined {
  // TypePath
  if (Object.keys(registrySchema).includes(typePath)) return registrySchema[typePath];

  // TypePath as part of Enum
  const splittedPath = typePath.split('::');
  if (splittedPath.length < 2) {
    console.error(`SerializedData Error in making splittedPath from: ${typePath}`);
    return undefined;
  }
  const shortPath = '::' + splittedPath[splittedPath.length - 1];
  const parentTypePath = typePath.slice(0, typePath.length - shortPath.length);
  if (!Object.keys(registrySchema).includes(parentTypePath)) {
    console.error(`SerializedData Error - enumTypePath doesn't exist: ${parentTypePath}`);
    return undefined;
  }
  const result = registrySchema[parentTypePath].oneOf?.find((value) => {
    if (typeof value === 'string') return false;
    return value.typePath === typePath && Object.keys(value).includes('kind');
  }) as BrpSchema | undefined;
  if (result === undefined) {
    console.error(`SerializedData Error - schema of ${parentTypePath} doesn't include: ${typePath}`);
    return undefined;
  }
  return result;
}
