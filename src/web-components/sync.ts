import { EntityFocus } from '../connection-list';
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
  ArrayVisual,
  ComponentsVisual,
  EnumVisual,
  ErrorVisual,
  ExpandableVisual,
  ListVisual,
  MapVisual,
  SerializedVisual,
  SetVisual,
  StructVisual,
  TupleVisual,
  VisualUnit,
} from './visual';

export type DataPathSegment = string | number | undefined;

class SyncNodeCollection {
  private collection: SyncNode[] = [];
  constructor(private sync: SyncNode) {}
  private updateIsExpandable() {
    if ('isExpandable' in this.sync.visual) {
      this.sync.visual.isExpandable = this.collection.length > 0;
    }
  }

  push(node: SyncNode) {
    this.collection.push(node);
    this.updateIsExpandable();
  }
  shrink(newLength: number) {
    if (newLength >= this.collection.length) return; // skip
    for (let index = newLength; index < this.collection.length; index++) this.collection[index].preDestruct();
    this.collection.length = newLength;
    this.updateIsExpandable();
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
  public readonly visual: VisualUnit;

  constructor(
    parent: SyncNode | DataSyncManager,
    anchor: HTMLElement,
    path: DataPathSegment[],
    typePath: TypePath | undefined
  ) {
    this.parent = parent;
    this.path = path;
    const source = this.source();
    const access = this.access(path);

    const pushChild = (pathSegment: DataPathSegment, typePath: TypePath) => {
      this.children.push(new SyncNode(this, this.endAnchor, [...this.path, pathSegment], typePath));
    };

    // ComponentsData
    if (path.length === 0) {
      const mapOfComponents = isBrpObject(access) ? access : {};
      const componentNames = sortByShortPath(Object.keys(mapOfComponents), source.getRegistrySchema() ?? {});
      this.visual = new ComponentsVisual(this, anchor, componentNames);
      for (const childTypePath of componentNames) {
        pushChild(childTypePath, childTypePath);
      }
      return this;
    }

    // Get schema
    if (typePath === undefined) {
      this.visual = new ErrorVisual(this, anchor, { code: undefined, message: `typePath is undefined` });
      return this;
    }
    const schema = getSchemaRecursively(typePath, source.getRegistrySchema() ?? {});
    if (schema === undefined) {
      this.visual = new ErrorVisual(this, anchor, { code: undefined, message: `schema is not found` });
      return this;
    }

    // SerializedData
    if (schema.reflectTypes?.includes('Serialize')) {
      this.visual = new SerializedVisual(this, anchor, schema, access);
      return this;
    }

    // Parsing other types of Data
    switch (schema.kind) {
      case 'Value': {
        this.visual = new ErrorVisual(this, anchor, { code: undefined, message: `Value is not serializable` });
        break;
      }
      case 'Enum': {
        if (typeof access === 'string') {
          const childTypePath = schema.typePath + '::' + access;
          this.visual = new EnumVisual(this, anchor, schema, childTypePath);
          break;
        }
        if (isBrpObject(access) && Object.keys(access).length >= 1) {
          const childTypePath = schema.typePath + '::' + Object.keys(access)[0];
          this.visual = new EnumVisual(this, anchor, schema, childTypePath);
          pushChild(Object.keys(access)[0], childTypePath);
          break;
        }
        this.visual = new ErrorVisual(this, anchor, { code: undefined, message: `cannot deserialize Enum` });
        break;
      }
      case 'Tuple':
      case 'TupleStruct': {
        this.visual = new TupleVisual(this, anchor, schema);
        if (this.visual.childTypePaths.length === 1) pushChild(undefined, this.visual.childTypePaths[0]);
        else this.visual.childTypePaths.forEach((childTypePath, index) => pushChild(index, childTypePath));
        break;
      }
      case 'Array':
        this.visual = new ArrayVisual(this, anchor, schema);
        if (!isBrpArray(access)) break;
        for (const item of access.keys()) pushChild(item, this.visual.childTypePath);
        break;
      case 'List':
        this.visual = new ListVisual(this, anchor, schema);
        if (!isBrpArray(access)) break;
        for (const item of access.keys()) pushChild(item, this.visual.childTypePath);
        break;
      case 'Set': {
        this.visual = new SetVisual(this, anchor, schema);
        if (!isBrpArray(access)) break;
        for (const item of access.keys()) pushChild(item, this.visual.childTypePath);
        break;
      }
      case 'Struct': {
        this.visual = new StructVisual(this, anchor, schema);
        for (const { property: p, typePath: tp } of this.visual.properties) pushChild(p, tp);
        break;
      }
      case 'Map': {
        this.visual = new MapVisual(this, anchor, schema);
        if (!isBrpObject(access)) break;
        for (const key of Object.keys(access).sort()) pushChild(key, this.visual.valueTypePath);
        break;
      }
    }
  }
  public source(): DataSyncManager {
    if (this.parent instanceof DataSyncManager) return this.parent;
    return this.parent.source();
  }
  public access(path: DataPathSegment[] = this.path): BrpValue {
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
  public sync() {
    const access = this.access(this.path);
    const source = this.source();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const debugOutput = (message: string) => {}; // console.log(message);

    // Overwrite Serialized
    if (this.visual instanceof SerializedVisual) {
      if (this.visual.value !== access) {
        debugOutput(
          `Update: ${JSON.stringify(this.path)} = ${JSON.stringify(this.visual.value)} --> ${JSON.stringify(access)}`
        );
        this.visual.value = access;
        if (this.visual instanceof SerializedVisual) this.visual.set(access);
      }
    }

    // Restructure Enum
    if (this.visual instanceof EnumVisual) {
      if (typeof access === 'string') {
        const variant = this.visual.schema.typePath + '::' + access;
        if (this.visual.variantTypePath !== variant) {
          debugOutput(`Update: ${JSON.stringify(this.path)} = ${this.visual.variantTypePath} --> ${access}`);
          this.visual.variantTypePath = variant;
          this.children.shrink(0);
        }
      } else if (isBrpObject(access) && Object.keys(access).length === 1) {
        const variant = this.visual.schema.typePath + '::' + Object.keys(access)[0];
        if (this.visual.variantTypePath !== variant) {
          debugOutput(
            `Update: ${JSON.stringify(this.path)} = ${this.visual.variantTypePath} --> ${JSON.stringify(access)}`
          );
          this.visual.variantTypePath = variant;
          this.children.shrink(0);
          this.children.push(new SyncNode(source, this.visual.dom, [...this.path, this.visual.variantName], variant));
        }
      } else {
        debugOutput(`Error in parsing EnumData: ${JSON.stringify(this.path)}`);
      }
    }

    // Shrink List + Set
    if (this.visual instanceof ListVisual || this.visual instanceof SetVisual) {
      if (!isBrpArray(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpArray`);
      }
      if (isBrpArray(access) && this.children.unwrap().length > access.length) {
        this.children.shrink(access.length);
        debugOutput(`Shrink: ${JSON.stringify(this.path)}`);
      }
    }

    // Shrink Map + Components
    if (this.visual instanceof MapVisual || this.visual instanceof ComponentsVisual) {
      if (!isBrpObject(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpObject`);
      }
      if (isBrpObject(access)) {
        const prevLength = this.children.unwrap().length;
        this.children.filter((child) => {
          return typeof child.lastPathSegment === 'string' && Object.keys(access).includes(child.lastPathSegment);
        });
        if (prevLength !== this.children.unwrap().length) debugOutput(`Shrink: ${JSON.stringify(this.path)}`);
      }
    }

    // Sync children
    this.children.unwrap().forEach((child) => child.sync());

    // Extend List + Set
    if (this.visual instanceof ListVisual || this.visual instanceof SetVisual) {
      if (!isBrpArray(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpArray`);
      }
      if (isBrpArray(access)) {
        for (let index = this.children.unwrap().length; index < access.length; index++) {
          this.children.push(new SyncNode(source, this.endAnchor, [...this.path, index], this.visual.childTypePath));
          debugOutput(`Extend: ${JSON.stringify([...this.path, index])}`);
        }
      }
    }

    // Extend Map + Components
    if (this.visual instanceof MapVisual || this.visual instanceof ComponentsVisual) {
      if (!isBrpObject(access)) {
        console.error(`Error in parsing: ${JSON.stringify(this.path)} is not a BrpObject`);
      }
      if (isBrpObject(access)) {
        let anchor: HTMLElement = this.visual.dom;
        const sorted =
          this.visual instanceof MapVisual
            ? Object.keys(access).sort()
            : sortByShortPath(Object.keys(access), source.getRegistrySchema() ?? {});
        for (const key of sorted) {
          const exists = this.children.unwrap().find((child) => {
            if (typeof child.lastPathSegment !== 'string') return false;
            return key === child.lastPathSegment;
          });
          if (exists === undefined) {
            const childTypePath = this.visual instanceof MapVisual ? this.visual.valueTypePath : key;
            const newNode = new SyncNode(source, anchor, [...this.path, key], childTypePath);
            debugOutput(`Extend: ${JSON.stringify([...this.path, key])}`);
            this.children.push(newNode);
            anchor = newNode.endAnchor;
          } else {
            anchor = exists.endAnchor;
          }
        }
      }
    }
  }

  get lastPathSegment(): DataPathSegment {
    if (this.path.length === 0) return undefined;
    return this.path[this.path.length - 1];
  }
  get startAnchor(): HTMLElement {
    return this.visual.dom;
  }
  get endAnchor(): HTMLElement {
    const length = this.children.unwrap().length;
    if (length === 0) return this.visual.dom;
    return this.children.unwrap()[length - 1].endAnchor;
  }

  preDestruct() {
    this.children.shrink(0);
    this.visual.preDestruct();
  }
  show() {
    this.visual.show();
    this.showChildren();
  }
  showChildren() {
    if (this.visual instanceof ExpandableVisual && this.visual.isExpanded) {
      this.children.unwrap().forEach((child) => child.show());
    }
  }
  hide() {
    this.visual.hide();
    this.hideChildren();
  }
  hideChildren() {
    this.children.unwrap().forEach((child) => child.hide());
  }

  get pathSerialized(): string {
    if (this.parent instanceof DataSyncManager) return ''; // Root
    if (
      this.lastPathSegment === undefined ||
      this.parent.visual instanceof SerializedVisual ||
      this.parent.visual instanceof ErrorVisual
    ) {
      return this.parent.pathSerialized; // Skip
    }
    const segment = this.lastPathSegment.toString();
    if (this.parent.visual instanceof ComponentsVisual) return segment; // Component
    if (
      this.parent.visual instanceof MapVisual ||
      this.parent.visual instanceof StructVisual ||
      this.parent.visual instanceof TupleVisual
    ) {
      return this.parent.pathSerialized + '.' + segment; // Dot
    }
    if (
      this.parent.visual instanceof ArrayVisual ||
      this.parent.visual instanceof ListVisual ||
      this.parent.visual instanceof SetVisual
    ) {
      return this.parent.pathSerialized + '[' + segment + ']'; // Array Item
    }
    console.error('Error in "pathSerialized": parsing error');
    return this.parent.pathSerialized;
  }
  public debugTree(level: number, direction: DataPathSegment[]): string {
    const pathSegment = this.path.length >= 1 ? this.path[this.path.length - 1] : undefined;
    const spaced = (s: string) => {
      const width = 45;
      return s + ' '.repeat(Math.max(width - s.length, 0));
    };

    // Set treeSegment
    let treeSegment = '| '.repeat(level);
    if (this.visual instanceof ComponentsVisual) treeSegment += 'COMPONENTS:';
    else treeSegment += pathSegment ?? '...';

    // Set description
    let description = '';
    if (this.visual instanceof ErrorVisual) {
      description += 'ERROR: ' + this.visual.error.message;
      return spaced(treeSegment) + ' ' + description + '\n'; // Parsing error
    }
    if ('schema' in this.visual) description += this.visual.schema.kind;
    if (this.visual instanceof SerializedVisual) description += '+Serde';
    if ('schema' in this.visual) description += '(' + this.visual.schema.typePath + ')';
    if (this.visual instanceof SerializedVisual) description += ' = ' + JSON.stringify(this.visual.value);
    if (this.visual instanceof EnumVisual) description += '/' + JSON.stringify(this.visual.variantName);

    // Set after
    let after = '';
    this.children.unwrap().forEach((child) => {
      const childPathSegment = child.path.length > 0 ? child.path[child.path.length - 1] : undefined;
      const directionPathSegment = direction.length > 0 ? direction[0] : undefined;
      if (childPathSegment === undefined) after += child.debugTree(level + 1, direction);
      if (childPathSegment === directionPathSegment || directionPathSegment === undefined) {
        after += child.debugTree(level + 1, direction.slice(1));
      }
    });

    return spaced(treeSegment) + ' ' + description + '\n' + after;
  }
}

export class DataSyncManager {
  private root: SyncNode;
  private registrySchemas: { [host: string]: BrpRegistrySchema } = {};
  public mapOfComponents: BrpComponentRegistry = {};
  public focus: EntityFocus | undefined;

  constructor(public readonly mount: HTMLElement) {
    this.root = new SyncNode(this, mount, [], undefined);
  }
  source(): DataSyncManager {
    return this;
  }
  getRegistrySchema(): BrpRegistrySchema | undefined {
    if (this.focus === undefined) return;
    if (!Object.keys(this.registrySchemas).includes(this.focus.host)) return;
    return this.registrySchemas[this.focus.host];
  }
  syncRegistrySchema(available: string[], host: string, schema: BrpRegistrySchema) {
    this.registrySchemas[host] = schema;
    Object.keys(this.registrySchemas)
      .filter((toFilter) => !available.includes(toFilter))
      .forEach((toRemove) => delete this.registrySchemas[toRemove]);
  }
  setMapOfComponents(components: BrpComponentRegistry) {
    this.mapOfComponents = components;
  }
  trySync() {
    if (this.getRegistrySchema() === undefined) return 'no_registry_schema';
    this.root.sync();
    return 'done';
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

function sortByShortPath(typePaths: TypePath[], registrySchema: BrpRegistrySchema): TypePath[] {
  return typePaths
    .map((typePath) => {
      return { typePath, schema: getSchemaRecursively(typePath, registrySchema) };
    })
    .sort(({ schema: a }, { schema: b }) => {
      if (a === undefined && b !== undefined) return -1;
      if (a !== undefined && b === undefined) return 1;
      if (a === undefined || b === undefined) return 0;
      if (a.shortPath < b.shortPath) return -1;
      if (a.shortPath > b.shortPath) return 1;
      return 0;
    })
    .map((item) => {
      return item.typePath;
    });
}
