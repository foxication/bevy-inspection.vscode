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
import { Visual } from './visual';

export type DataPathSegment = string | number | undefined;

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

export class SyncNode {
  public readonly parent: SyncNode | DataSyncManager;
  public readonly path: DataPathSegment[];
  public children: SyncNode[] = [];
  public readonly data:
    | SerializedData
    | EnumData
    | TupleData
    | ArrayData
    | ListData
    | SetData
    | StructData
    | MapData
    | ComponentsData
    | ErrorData;
  private visual: Visual;

  constructor(parent: SyncNode | DataSyncManager, path: DataPathSegment[], typePath: TypePath | undefined) {
    this.parent = parent;
    this.path = path;

    const source = this.source();
    const access = this.access(path);
    const createVisual = () => {
      const mount = this.source().mount;
      const level = Math.max(this.path.length - 1, 0);
      const label = typeof this.lastPathSegment === 'number' ? this.lastPathSegment.toString() : this.lastPathSegment;
      return new Visual(this, level, label, mount);
    };

    // ComponentsData
    if (path.length === 0) {
      if (!isBrpObject(access)) {
        this.data = new ErrorData(undefined, `expected BrpObject`, path);
        this.visual = createVisual();
        return;
      }
      this.data = new ComponentsData(Object.keys(access));
      this.visual = createVisual();
      for (const childTypePath of this.data.componentNames) {
        this.children.push(new SyncNode(this, [...path, childTypePath], childTypePath));
      }
      this.updateVisualOnChildrenAppend();
      return;
    }

    // Get schema
    if (typePath === undefined) {
      this.data = new ErrorData(undefined, `typePath is undefined`, path);
      this.visual = createVisual();
      return;
    }
    const schema = getSchemaRecursively(typePath, source.registrySchema);
    if (schema === undefined) {
      this.data = new ErrorData(undefined, `schema is not found`, path);
      this.visual = createVisual();
      return;
    }

    // SerializedData
    if (schema.reflectTypes?.includes('Serialize')) {
      this.data = new SerializedData(schema, access);
      this.visual = createVisual();
      return;
    }

    // Parsing other types of Data
    switch (schema.kind) {
      case 'Value':
        this.data = new ErrorData(undefined, `Value is not serializable`, path);
        this.visual = createVisual();
        break;
      case 'Enum':
        if (typeof access === 'string') {
          const variant = schema.typePath + '::' + access;
          this.data = new EnumData(schema, variant);
          this.visual = createVisual();
          break;
        }
        if (isBrpObject(access) && Object.keys(access).length >= 1) {
          const variant = schema.typePath + '::' + Object.keys(access)[0];
          this.data = new EnumData(schema, variant);
          this.visual = createVisual();
          this.children.push(new SyncNode(this, [...path, this.data.variantName], this.data.variant));
          this.updateVisualOnChildrenAppend();
          break;
        }
        this.data = new ErrorData(undefined, `cannot deserialize Enum`, path);
        this.visual = createVisual();
        break;
      case 'Tuple':
      case 'TupleStruct': {
        this.data = new TupleData(schema);
        this.visual = createVisual();
        if (this.data.childTypePaths.length === 1) {
          this.children.push(new SyncNode(this, [...path, undefined], this.data.childTypePaths[0]));
          this.updateVisualOnChildrenAppend();
          break;
        }
        let index = 0;
        for (const childTypePath of this.data.childTypePaths) {
          this.children.push(new SyncNode(this, [...path, index], childTypePath));
          index++;
        }
        this.updateVisualOnChildrenAppend();
        break;
      }
      case 'Array':
        this.data = new ArrayData(schema);
        this.visual = createVisual();
        if (!isBrpArray(access)) {
          this.data = new ErrorData(undefined, `expected BrpArray`, path);
          this.visual = createVisual();
          break;
        }
        for (const item of access.keys()) {
          this.children.push(new SyncNode(this, [...path, item], this.data.childTypePath));
        }
        this.updateVisualOnChildrenAppend();
        break;
      case 'List':
        this.data = new ListData(schema);
        this.visual = createVisual();
        if (!isBrpArray(access)) {
          this.data = new ErrorData(undefined, `expected BrpArray`, path);
          this.visual = createVisual();
          break;
        }
        for (const item of access.keys()) {
          this.children.push(new SyncNode(this, [...path, item], this.data.childTypePath));
        }
        this.updateVisualOnChildrenAppend();
        break;
      case 'Set':
        this.data = new SetData(schema);
        this.visual = createVisual();
        if (!isBrpArray(access)) {
          this.data = new ErrorData(undefined, `expected BrpArray`, path);
          this.visual = createVisual();
          break;
        }
        for (const item of access.keys()) {
          this.children.push(new SyncNode(this, [...path, item], this.data.childTypePath));
        }
        this.updateVisualOnChildrenAppend();
        break;
      case 'Struct':
        this.data = new StructData(schema);
        this.visual = createVisual();
        for (const { property, typePath: childTypePath } of this.data.properties) {
          this.children.push(new SyncNode(this, [...path, property], childTypePath));
        }
        this.updateVisualOnChildrenAppend();
        break;
      case 'Map':
        this.data = new MapData(schema);
        this.visual = createVisual();
        if (!isBrpObject(access)) {
          this.data = new ErrorData(undefined, `expected BrpObject`, path);
          this.visual = createVisual();
          break;
        }
        for (const key of Object.keys(access)) {
          this.children.push(new SyncNode(this, [...path, key], this.data.valueTypePath));
        }
        this.updateVisualOnChildrenAppend();
        break;
    }
  }
  private updateVisualOnChildrenAppend() {
    if (this.visual === undefined) return;
    this.visual.hasChildren = this.children.length > 0;
  }
  public source(): DataSyncManager {
    if (this.parent instanceof DataSyncManager) return this.parent;
    return this.parent.source();
  }
  public access(path: DataPathSegment[]): BrpValue {
    let access: BrpValue = this.source().mapOfComponents;

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
  public debugTree(level: number, direction: DataPathSegment[]): string {
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
    if (this.data instanceof ErrorData) {
      description += 'ERROR: ' + this.data.message;
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
      const childPathSegment = child.path.length > 0 ? child.path[child.path.length - 1] : undefined;
      const directionPathSegment = direction.length > 0 ? direction[0] : undefined;
      if (childPathSegment === undefined) {
        after += child.debugTree(level + 1, direction);
        return;
      }
      if (directionPathSegment === childPathSegment || directionPathSegment === undefined) {
        after += child.debugTree(level + 1, direction.slice(1));
        return;
      }
    });

    return spaced(treeSegment) + ' ' + description + '\n' + after;
  }
  public sync() {
    const access = this.access(this.path);
    const source = this.source();

    // Overwrite Serialized
    if (this.data instanceof SerializedData) {
      if (this.data.value !== access) {
        console.log(
          `Update: ${JSON.stringify(this.path)} = ${JSON.stringify(this.data.value)} --> ${JSON.stringify(access)}`
        );
        this.data.value = access;
        this.visual?.update(access);
      }
    }

    // Restructure Enum
    if (this.data instanceof EnumData) {
      if (typeof access === 'string') {
        const variant = this.data.schema.typePath + '::' + access;
        if (this.data.variant !== variant) {
          console.log(`Update: ${JSON.stringify(this.path)} = ${this.data.variant} --> ${access}`);
          this.data.variant = variant;
          this.children.forEach((child) => child.preDestruct());
          this.children = [];
        }
      } else if (isBrpObject(access) && Object.keys(access).length === 1) {
        const variant = this.data.schema.typePath + '::' + Object.keys(access)[0];
        if (this.data.variant !== variant) {
          console.log(`Update: ${JSON.stringify(this.path)} = ${this.data.variant} --> ${JSON.stringify(access)}`);
          this.data.variant = variant;
          this.children.forEach((child) => child.preDestruct());
          this.children = [new SyncNode(source, [...this.path, this.data.variantName], variant)];
        }
      } else {
        console.log(`Error in parsing EnumData: ${JSON.stringify(this.path)}`);
      }
    }

    // Shrink List + Set
    if (this.data instanceof ListData || this.data instanceof SetData) {
      if (!isBrpArray(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpArray`);
      }
      if (isBrpArray(access) && this.children.length > access.length) {
        for (let index = access.length; index < this.children.length; index++) this.children[index].preDestruct();
        this.children.length = access.length;
        console.log(`Shrink: ${JSON.stringify(this.path)}`);
      }
    }

    // Shrink Map + Components
    if (this.data instanceof MapData || this.data instanceof ComponentsData) {
      if (!isBrpObject(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpObject`);
      }
      if (isBrpObject(access)) {
        const prevLength = this.children.length;
        this.children = this.children.filter((child) => {
          if (typeof child.lastPathSegment !== 'string' || !Object.keys(access).includes(child.lastPathSegment)) {
            child.preDestruct();
            return false;
          }
          return true;
        });
        if (prevLength !== this.children.length) console.log(`Shrink: ${JSON.stringify(this.path)}`);
      }
    }

    // Sync children
    this.children.forEach((child) => child.sync());

    // Extend List + Set
    if (this.data instanceof ListData || this.data instanceof SetData) {
      if (!isBrpArray(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpArray`);
      }
      if (isBrpArray(access)) {
        let index = this.children.length;
        while (this.children.length < access.length) {
          this.children.push(new SyncNode(source, [...this.path, index], this.data.childTypePath));
          console.log(`Extend: ${JSON.stringify([...this.path, index])}`);
          index++;
        }
      }
    }

    // Extend Map + Components
    if (this.data instanceof MapData || this.data instanceof ComponentsData) {
      if (!isBrpObject(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpObject`);
      }
      if (isBrpObject(access)) {
        for (const key of Object.keys(access)) {
          const exists = this.children.find((child) => {
            if (typeof child.lastPathSegment !== 'string') return false;
            return key === child.lastPathSegment;
          });
          if (exists === undefined) {
            const childTypePath = this.data instanceof MapData ? this.data.valueTypePath : key;
            this.children.push(new SyncNode(source, [...this.path, key], childTypePath));
            console.log(`Extend: ${JSON.stringify([...this.path, key])}`);
          }
        }
      }
    }
  }

  get lastPathSegment(): DataPathSegment {
    if (this.path.length === 0) return undefined;
    return this.path[this.path.length - 1];
  }

  preDestruct() {
    this.children.forEach((child) => child.preDestruct());
    this.visual?.preDestruct();
  }
  show() {
    this.visual?.show();
    this.showChildren();
  }
  showChildren() {
    if (this.visual !== undefined && this.visual.isExpanded) this.children.forEach((child) => child.show());
  }
  hide() {
    this.visual?.hide();
    this.hideChildren();
  }
  hideChildren() {
    this.children.forEach((child) => child.hide());
  }
}

export class DataSyncManager {
  private root: SyncNode;
  constructor(
    public mapOfComponents: BrpComponentRegistry,
    public registrySchema: BrpRegistrySchema,
    public readonly mount: HTMLElement,
  ) {
    this.root = new SyncNode(this, [], undefined);
  }
  source(): DataSyncManager {
    return this;
  }
  sync() {
    this.root.sync();
  }
  debugTree(direction: DataPathSegment[] = []): string {
    return this.root.debugTree(0, direction);
  }
  get lastPathSegment(): DataPathSegment {
    return '';
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
