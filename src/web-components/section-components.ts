import { postWebviewMessage } from '.';
import { EntityFocus } from '../common';
import {
  BrpArraySchema,
  BrpComponentRegistry,
  BrpListSchema,
  BrpMapSchema,
  BrpObject,
  BrpRegistrySchema,
  BrpSchemaUnit,
  BrpSetSchema,
  BrpStructSchema,
  BrpTupleSchema,
  BrpTupleStructSchema,
  BrpValue,
  isBrpArray,
  isBrpObject,
  TypePath,
  TypePathReference,
} from '../protocol/types';
import {
  ArrayVisual,
  ComponentListVisual,
  ErrorVisual,
  ListVisual,
  MapVisual,
  SerializedVisual,
  SetVisual,
  StructVisual,
  TupleStructVisual,
  TupleVisual,
  Visual,
} from './visual';

export type PathSegment = string | number;

//
// Children of DataSync
//

class ChildrenOfSyncNode {
  private collection: DataWithAccess[] = [];
  constructor(public node: RootOfData) {}

  private updateIsExpandable() {
    if ('isExpandable' in this.node.visual) {
      this.node.visual.isExpandable = this.collection.length > 0;
    }
  }
  private removeVisualsRecursively(node: DataWithAccess) {
    node.children.forEach((child) => this.removeVisualsRecursively(child));
    node.visual.dom.remove();
  }
  private filter(segments: PathSegment[]) {
    this.collection = this.collection.filter((child) => {
      if (segments.includes(child.label)) return true;
      this.removeVisualsRecursively(child);
      return false;
    });
  }

  clear() {
    this.collection.forEach((child) => this.removeVisualsRecursively(child));
    this.collection = [];
    this.updateIsExpandable();
  }
  push(node: DataWithAccess) {
    this.collection.push(node);
    this.updateIsExpandable();
  }
  get(segment: PathSegment): DataWithAccess | undefined {
    return this.collection.find((node) => node.label === segment);
  }
  getLast(): DataWithAccess | undefined {
    if (this.collection.length === 0) return undefined;
    return this.collection[this.collection.length - 1];
  }
  updateOnOrderedArray(
    length: number,
    onCreation: (segment: number, anchor: HTMLElement) => DataWithAccess
  ) {
    const range = [...Array(length).keys()];
    this.filter(range);
    let anchor = this.node.getStartAnchor();
    this.collection = range.map((segment) => {
      const result = this.get(segment) ?? onCreation(segment, anchor);
      anchor = result.getEndAnchor();
      return result;
    });
    this.updateIsExpandable();
  }
  updateOnOrderedLabels(
    orderedSegments: string[],
    onCreation: (segment: string, anchor: HTMLElement) => DataWithAccess
  ) {
    this.filter(orderedSegments);
    let anchor = this.node.getStartAnchor();
    this.collection = orderedSegments.map((segment) => {
      const result = this.get(segment) ?? onCreation(segment, anchor);
      anchor = result.getEndAnchor();
      return result;
    });
    this.updateIsExpandable();
  }
  forEach(fn: (value: DataWithAccess, index: number, array: DataWithAccess[]) => void) {
    return this.collection.forEach(fn);
  }
  sync() {
    this.collection.forEach((child) => {
      if (child instanceof DataSync) child.sync();
    });
  }
}

//
// DataSyncBasic is DataSync shared with ComponentListSync
//

export abstract class RootOfData {
  children = new ChildrenOfSyncNode(this);
  getChild(path: PathSegment[]): DataWithAccess | undefined {
    if (path.length === 0) return this instanceof DataWithAccess ? this : undefined;
    return this.children.get(path[0])?.getChild(path.splice(1));
  }
  getStartAnchor() {
    return this.visual.dom;
  }
  getEndAnchor() {
    return this.children.getLast()?.visual.dom ?? this.getStartAnchor();
  }

  abstract visual: Visual;
  abstract getDebugTree(): string;
}

//
// Root DataSync
//

export class ComponentListData extends RootOfData {
  // Creation
  constructor(public section: HTMLElement) {
    super();
    this.visual = new ComponentListVisual(this, section);
    return this;
  }

  // Data
  private mapOfComponents: BrpComponentRegistry = {};
  private registry: BrpRegistrySchema = {};
  private focus: EntityFocus | undefined = undefined;
  getValue(): BrpObject {
    return this.mapOfComponents;
  }
  syncRoot(registry: BrpRegistrySchema, focus: EntityFocus, components: BrpComponentRegistry) {
    this.registry = registry;
    this.focus = focus;
    this.mapOfComponents = components;

    // Get TypePaths
    const TypePathListOrdered = Object.keys(this.mapOfComponents).sort((a, b) => {
      function shortPath(typePath: string) {
        return typePath.split('<')[0].split('::')[0];
      }
      const aShort = this.getSchema(a)?.shortPath ?? shortPath(a);
      const bShort = this.getSchema(b)?.shortPath ?? shortPath(b);
      return aShort > bShort ? 1 : bShort > aShort ? -1 : 0;
    });

    // Remove and create children
    this.children.updateOnOrderedLabels(TypePathListOrdered, (typePath, anchor) => {
      const schema = this.getSchema(typePath.toString());
      const result =
        schema !== undefined
          ? createSyncFromSchema(this, typePath, schema, anchor)
          : new ErrorData(this, typePath, undefined, 'schema is not found', anchor);
      return result;
    });

    // Sync children
    this.children.forEach((node) => {
      if (node instanceof DataSync) node.sync();
    });

    // Update visibility of 'Components' section
    if (Object.keys(this.mapOfComponents).length === 0) this.section.style.display = 'none';
    else this.section.style.removeProperty('display');
  }
  getFocus() {
    return this.focus;
  }
  getSchema(typePath: TypePath): BrpSchemaUnit | undefined {
    if (Object.keys(this.registry).includes(typePath)) return this.registry[typePath];
    return undefined;
  }

  // Visuals
  visual: ComponentListVisual;

  // Debug
  getDebugTree(): string {
    let result = 'Components:\n';
    this.children.forEach((node) => (result += node.getDebugTree()));
    return result;
  }
}

//
// DataSync with parent
//

export abstract class DataWithAccess extends RootOfData {
  getPathSerialized() {
    return this.getPath()
      .map((value) => value.toString())
      .join('.');
  }
  getRoot(): ComponentListData {
    if (this.parent instanceof ComponentListData) return this.parent;
    return this.parent.getRoot();
  }
  getValue(): BrpValue | undefined {
    const iterable = this.parent.getValue();
    if (iterable === undefined) return undefined;
    if (isBrpObject(iterable) && typeof this.label === 'string') {
      return iterable[this.label];
    }
    if (isBrpArray(iterable) && typeof this.label === 'number') {
      return iterable[this.label];
    }
    return undefined;
  }
  getPath(): [string, ...PathSegment[]] {
    if (this.parent instanceof ComponentListData) return [this.label.toString()];
    return [...this.parent.getPath(), this.label];
  }
  getMutationPath(): [string, string] {
    const [component, ...path] = this.getPath();
    return [
      component,
      path
        .map((segment) => {
          if (typeof segment === 'string') return '[' + segment + ']';
          else return '.' + segment;
        })
        .join(''),
    ];
  }
  getDebugInfo(): string {
    return this.getPathSerialized() + ' = ' + JSON.stringify(this.getValue());
  }
  getDebugTree(): string {
    let result = this.label.toString();
    if (this instanceof DataSync) result += ' => ' + this.schema;
    this.children.forEach((node) => (result += node.getDebugTree()));
    return result;
  }
  requestValueMutation: ((value: BrpValue) => void) | undefined = (value: BrpValue) => {
    const [component, path] = this.getMutationPath();
    const focus = this.getRoot().getFocus();
    if (focus === undefined) return;
    postWebviewMessage({ cmd: 'mutate_component', data: { focus, component, path, value } });
  };

  abstract parent: ComponentListData | DataWithAccess;
  abstract label: PathSegment;
}

export abstract class DataSync extends DataWithAccess {
  abstract schema: BrpSchemaUnit;
  abstract sync(): void;
}

//
// Implementations
//

function createSyncFromSchema(
  parent: ComponentListData | DataWithAccess,
  label: PathSegment,
  schema: BrpSchemaUnit,
  anchor: HTMLElement
) {
  if (schema.reflectTypes !== undefined && schema.reflectTypes.includes('Serialize')) {
    return new SerializedSync(parent, label, schema, anchor);
  }
  switch (schema.kind) {
    case 'Array':
      return new ArraySync(parent, label, schema, anchor);
    case 'Enum':
      return new ErrorData(parent, label, undefined, 'Not implemented', anchor);
    case 'List':
      return new ListSync(parent, label, schema, anchor);
    case 'Map':
      return new MapSync(parent, label, schema, anchor);
    case 'Set':
      return new SetSync(parent, label, schema, anchor);
    case 'Struct':
      return new StructSync(parent, label, schema, anchor);
    case 'Tuple':
      return new TupleSync(parent, label, schema, anchor);
    case 'TupleStruct':
      return new TupleStructSync(parent, label, schema, anchor);
    case 'Value':
      return new SerializedSync(parent, label, schema, anchor);
  }
}

export class ArraySync extends DataSync {
  visual: ArrayVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpArraySchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new ArrayVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.items));
    if (value === undefined || !isBrpArray(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) => {
      return createSyncFromSchema(this, segment, childSchema, anchor);
    });
    this.children.sync();
  }
}

export class ListSync extends DataSync {
  visual: ListVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpListSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new ListVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.items));
    if (value === undefined || !isBrpArray(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) => {
      return createSyncFromSchema(this, segment, childSchema, anchor);
    });
    this.children.sync();
  }
}

export class MapSync extends DataSync {
  visual: MapVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpMapSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new MapVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.valueType));
    if (value === undefined || !isBrpObject(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedLabels(Object.keys(value), (segment, anchor) => {
      return createSyncFromSchema(this, segment, childSchema, anchor);
    });
    this.children.sync();
  }
}

export class SetSync extends DataSync {
  visual: SetVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpSetSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new SetVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.items));
    if (value === undefined || !isBrpArray(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) => {
      return createSyncFromSchema(this, segment, childSchema, anchor);
    });
    this.children.sync();
  }
}

export class StructSync extends DataSync {
  visual: StructVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpStructSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new StructVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    const properties = this.schema.properties;
    if (value === undefined || !isBrpObject(value) || properties === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedLabels(Object.keys(properties), (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(properties[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, segment, childSchema, anchor);
      }
      return new ErrorData(this, segment, undefined, 'Schema is not found', anchor);
    });
    this.children.sync();
  }
}

export class TupleSync extends DataSync {
  visual: TupleVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpTupleSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new TupleVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    const prefixItems = this.schema.prefixItems;
    if (prefixItems === undefined) return this.children.clear();
    if (value === undefined || !isBrpArray(value)) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(prefixItems.length, (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(prefixItems[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, segment, childSchema, anchor);
      }
      return new ErrorData(this, segment, undefined, 'Schema is not found', anchor);
    });
    this.children.sync();
  }
}

export class TupleStructSync extends DataSync {
  visual: TupleStructVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpTupleStructSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new TupleStructVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    const prefixItems = this.schema.prefixItems;
    if (prefixItems === undefined) return this.children.clear();
    if (value === undefined || !isBrpArray(value)) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(prefixItems.length, (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(prefixItems[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, segment, childSchema, anchor);
      }
      return new ErrorData(this, segment, undefined, 'Schema is not found', anchor);
    });
    this.children.sync();
  }
}

export class SerializedSync extends DataSync {
  visual: SerializedVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: PathSegment,
    public schema: BrpSchemaUnit,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new SerializedVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    if (value !== undefined) this.visual.set(value);
    else {
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.sync();
  }
}

export class ErrorData extends DataWithAccess {
  visual: ErrorVisual;
  requestValueMutation = undefined;

  constructor(
    public parent: DataWithAccess | ComponentListData,
    public label: PathSegment,
    code: number | undefined,
    message: string,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new ErrorVisual(this, anchor, { code, message });
  }
  getDebugTree(): string {
    return `${this.label} => ${this.visual.error.message}`;
  }
}

export function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}
