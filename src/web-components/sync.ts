import {
  BrpComponentRegistry,
  BrpRegistrySchema,
  BrpSchema,
  BrpValue,
  isBrpArray,
  isBrpObject,
  TypePath,
} from '../protocol/types';
import {
  SerializedData,
  EnumData,
  TupleData,
  ArrayData,
  ListData,
  SetData,
  StructData,
  MapData,
  ComponentsData,
  ErrorData,
} from './data';
import { Visual } from './visual';

export type DataPathSegment = string | number | undefined;

class SyncNodeCollection {
  private collection: SyncNode[] = [];
  constructor(private parent: SyncNode) {}
  private updateVisual() {
    this.parent.visual.hasChildren = this.collection.length > 0;
  }

  push(node: SyncNode) {
    this.collection.push(node);
    this.updateVisual();
  }
  shrink(newLength: number) {
    if (newLength >= this.collection.length) return;
    for (let index = newLength; index < this.collection.length; index++) this.collection[index].preDestruct();
    this.collection.length = newLength;
    this.updateVisual();
  }
  filter(fn: (child: SyncNode) => boolean) {
    this.collection = this.collection.filter((child) => {
      if (!fn(child)) {
        child.preDestruct();
        return false;
      }
      return true;
    });
  }
  unwrap(): SyncNode[] {
    return this.collection;
  }
}

export class SyncNode {
  public readonly parent: SyncNode | DataSyncManager;
  public readonly path: DataPathSegment[];
  public children = new SyncNodeCollection(this);
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
  public visual: Visual;

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
          break;
        }
        let index = 0;
        for (const childTypePath of this.data.childTypePaths) {
          this.children.push(new SyncNode(this, [...path, index], childTypePath));
          index++;
        }
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
        break;
      case 'Struct':
        this.data = new StructData(schema);
        this.visual = createVisual();
        for (const { property, typePath: childTypePath } of this.data.properties) {
          this.children.push(new SyncNode(this, [...path, property], childTypePath));
        }
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
        break;
    }
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
    this.children.unwrap().forEach((child) => {
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const debugLog = (message: string) => {}; // console.log(message);

    // Overwrite Serialized
    if (this.data instanceof SerializedData) {
      if (this.data.value !== access) {
        debugLog(
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
          debugLog(`Update: ${JSON.stringify(this.path)} = ${this.data.variant} --> ${access}`);
          this.data.variant = variant;
          this.children.shrink(0);
        }
      } else if (isBrpObject(access) && Object.keys(access).length === 1) {
        const variant = this.data.schema.typePath + '::' + Object.keys(access)[0];
        if (this.data.variant !== variant) {
          debugLog(`Update: ${JSON.stringify(this.path)} = ${this.data.variant} --> ${JSON.stringify(access)}`);
          this.data.variant = variant;
          this.children.shrink(0);
          this.children.push(new SyncNode(source, [...this.path, this.data.variantName], variant));
        }
      } else {
        debugLog(`Error in parsing EnumData: ${JSON.stringify(this.path)}`);
      }
    }

    // Shrink List + Set
    if (this.data instanceof ListData || this.data instanceof SetData) {
      if (!isBrpArray(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpArray`);
      }
      if (isBrpArray(access) && this.children.unwrap().length > access.length) {
        this.children.shrink(access.length);
        debugLog(`Shrink: ${JSON.stringify(this.path)}`);
      }
    }

    // Shrink Map + Components
    if (this.data instanceof MapData || this.data instanceof ComponentsData) {
      if (!isBrpObject(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpObject`);
      }
      if (isBrpObject(access)) {
        const prevLength = this.children.unwrap().length;
        this.children.filter((child) => {
          return typeof child.lastPathSegment === 'string' && Object.keys(access).includes(child.lastPathSegment);
        });
        if (prevLength !== this.children.unwrap().length) debugLog(`Shrink: ${JSON.stringify(this.path)}`);
      }
    }

    // Sync children
    this.children.unwrap().forEach((child) => child.sync());

    // Extend List + Set
    if (this.data instanceof ListData || this.data instanceof SetData) {
      if (!isBrpArray(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpArray`);
      }
      if (isBrpArray(access)) {
        let index = this.children.unwrap().length;
        while (this.children.unwrap().length < access.length) {
          this.children.push(new SyncNode(source, [...this.path, index], this.data.childTypePath));
          debugLog(`Extend: ${JSON.stringify([...this.path, index])}`);
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
          const exists = this.children.unwrap().find((child) => {
            if (typeof child.lastPathSegment !== 'string') return false;
            return key === child.lastPathSegment;
          });
          if (exists === undefined) {
            const childTypePath = this.data instanceof MapData ? this.data.valueTypePath : key;
            this.children.push(new SyncNode(source, [...this.path, key], childTypePath));
            debugLog(`Extend: ${JSON.stringify([...this.path, key])}`);
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
    this.children.shrink(0);
    this.visual?.preDestruct();
  }
  show() {
    this.visual?.show();
    this.showChildren();
  }
  showChildren() {
    if (this.visual !== undefined && this.visual.isExpanded) this.children.unwrap().forEach((child) => child.show());
  }
  hide() {
    this.visual?.hide();
    this.hideChildren();
  }
  hideChildren() {
    this.children.unwrap().forEach((child) => child.hide());
  }

  mutate(value: BrpValue) {
    console.log('Called SyncNode.mutate()');
    const component = (this.path[0] ?? '').toString();
    const path = this.pathSerialized;
    this.source().mutate(component, path, value);
  }
  get pathSerialized(): string {
    // Never-happen situation
    if (this.parent instanceof DataSyncManager) return '';

    // Skip
    if (
      this.lastPathSegment === undefined &&
      this.parent.data instanceof SerializedData &&
      this.parent.data instanceof ErrorData
    ) {
      return this.parent.pathSerialized;
    }

    const segment = (this.lastPathSegment ?? '').toString();

    // Component
    if (this.parent.data instanceof ComponentsData) return segment;

    // Dot
    if (
      this.parent.data instanceof MapData &&
      this.parent.data instanceof StructData &&
      this.parent.data instanceof TupleData
    ) {
      return this.parent.pathSerialized + '.' + segment;
    }

    // Array Item
    if (
      this.parent.data instanceof ArrayData &&
      this.parent.data instanceof ListData &&
      this.parent.data instanceof SetData
    ) {
      return this.parent.pathSerialized + '[' + segment + ']';
    }

    // Error
    console.error('Error in "pathSerialized": parsing error');
    return this.parent.pathSerialized;
  }
}

export class DataSyncManager {
  private root: SyncNode;
  constructor(
    public mapOfComponents: BrpComponentRegistry,
    public registrySchema: BrpRegistrySchema,
    public readonly mount: HTMLElement,
    public readonly mutate: (component: string, path: string, value: BrpValue) => void
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
