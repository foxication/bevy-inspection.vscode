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
  private collection: DataSync[] = [];
  constructor(public node: DataSyncBasic) {}

  private updateIsExpandable() {
    if ('isExpandable' in this.node.visual) {
      this.node.visual.isExpandable = this.collection.length > 0;
    }
  }
  private removeVisualsRecursively(node: DataSync) {
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
  push(node: DataSync) {
    this.collection.push(node);
    this.updateIsExpandable();
  }
  get(segment: PathSegment): DataSync | undefined {
    return this.collection.find((node) => node.label === segment);
  }
  getLast(): DataSync | undefined {
    if (this.collection.length === 0) return undefined;
    return this.collection[this.collection.length - 1];
  }
  updateOnOrderedArray(
    length: number,
    onCreation: (segment: number, anchor: HTMLElement) => DataSync
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
    onCreation: (segment: string, anchor: HTMLElement) => DataSync
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
  forEach(fn: (value: DataSync, index: number, array: DataSync[]) => void) {
    return this.collection.forEach(fn);
  }
}

//
// DataSyncBasic is DataSync shared with ComponentListSync
//

export abstract class DataSyncBasic {
  children = new ChildrenOfSyncNode(this);
  getChild(path: PathSegment[]): DataSync | undefined {
    if (path.length === 0) return this instanceof DataSync ? this : undefined;
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

export class ComponentListSync extends DataSyncBasic {
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
          ? createSyncFromSchema(this, anchor, typePath, schema)
          : new ErrorSync(this, anchor, typePath, undefined, 'schema is not found');
      return result;
    });

    // Sync children
    this.children.forEach((node) => node.sync());

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

export abstract class DataSync extends DataSyncBasic {
  getPathSerialized() {
    return this.getPath()
      .map((value) => value.toString())
      .join('.');
  }
  getRoot(): ComponentListSync {
    if (this.parent instanceof ComponentListSync) return this.parent;
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
    if (this.parent instanceof ComponentListSync) return [this.label.toString()];
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
    if ('schema' in this.visual) result += ' => ' + this.visual.schema;
    this.children.forEach((node) => (result += node.getDebugTree()));
    return result;
  }
  requestValueMutation: ((value: BrpValue) => void) | undefined = (value: BrpValue) => {
    const [component, path] = this.getMutationPath();
    const focus = this.getRoot().getFocus();
    if (focus === undefined) return;
    postWebviewMessage({ cmd: 'mutate_component', data: { focus, component, path, value } });
  };

  abstract parent: ComponentListSync | DataSync;
  abstract label: PathSegment;
  abstract sync(): void;
}

//
// Implementations
//

function createSyncFromSchema(
  parent: ComponentListSync | DataSync,
  anchor: HTMLElement,
  label: PathSegment,
  schema: BrpSchemaUnit
) {
  if (schema.reflectTypes !== undefined && schema.reflectTypes.includes('Serialize')) {
    return new SerializedSync(parent, anchor, label, schema);
  }
  switch (schema.kind) {
    case 'Array':
      return new ArraySync(parent, anchor, label, schema);
    case 'Enum':
      return new ErrorSync(parent, anchor, label, undefined, 'Not implemented');
    case 'List':
      return new ListSync(parent, anchor, label, schema);
    case 'Map':
      return new MapSync(parent, anchor, label, schema);
    case 'Set':
      return new SetSync(parent, anchor, label, schema);
    case 'Struct':
      return new StructSync(parent, anchor, label, schema);
    case 'Tuple':
      if (schema.prefixItems?.length === 1) {
        const root = parent instanceof ComponentListSync ? parent : parent.getRoot();
        const childTypePath = resolveTypePathFromRef(schema.prefixItems[0]);
        const childSchema = root.getSchema(childTypePath);
        if (childSchema === undefined) {
          const errorMsg = `Schema is not found for single value in ${childTypePath}`;
          return new ErrorSync(parent, anchor, label, undefined, errorMsg);
        } else {
          return createSyncFromSchema(parent, anchor, label, childSchema);
        }
      }
      return new TupleSync(parent, anchor, label, schema);
    case 'TupleStruct':
      if (schema.prefixItems?.length === 1) {
        const root = parent instanceof ComponentListSync ? parent : parent.getRoot();
        const childTypePath = resolveTypePathFromRef(schema.prefixItems[0]);
        const childSchema = root.getSchema(childTypePath);
        if (childSchema === undefined) {
          const errorMsg = `Schema is not found for single value in ${childTypePath}`;
          return new ErrorSync(parent, anchor, label, undefined, errorMsg);
        } else {
          return createSyncFromSchema(parent, anchor, label, childSchema);
        }
      }
      return new TupleStructSync(parent, anchor, label, schema);
    case 'Value':
      return new SerializedSync(parent, anchor, label, schema);
  }
}

export class ArraySync extends DataSync {
  visual: ArrayVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpArraySchema
  ) {
    super();
    this.visual = new ArrayVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.visual.schema.items));
    if (value === undefined || !isBrpArray(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) => {
      return createSyncFromSchema(this, anchor, segment, childSchema);
    });
    this.children.forEach((node) => node.sync());
  }
}

export class ListSync extends DataSync {
  visual: ListVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpListSchema
  ) {
    super();
    this.visual = new ListVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.visual.schema.items));
    if (value === undefined || !isBrpArray(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) => {
      return createSyncFromSchema(this, anchor, segment, childSchema);
    });
    this.children.forEach((node) => node.sync());
  }
}

export class MapSync extends DataSync {
  visual: MapVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpMapSchema
  ) {
    super();
    this.visual = new MapVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(
      resolveTypePathFromRef(this.visual.schema.valueType)
    );
    if (value === undefined || !isBrpObject(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedLabels(Object.keys(value), (segment, anchor) => {
      return createSyncFromSchema(this, anchor, segment, childSchema);
    });
    this.children.forEach((node) => node.sync());
  }
}

export class SetSync extends DataSync {
  visual: SetVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpSetSchema
  ) {
    super();
    this.visual = new SetVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.visual.schema.items));
    if (value === undefined || !isBrpArray(value) || childSchema === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) => {
      return createSyncFromSchema(this, anchor, segment, childSchema);
    });
    this.children.forEach((node) => node.sync());
  }
}

export class StructSync extends DataSync {
  visual: StructVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpStructSchema
  ) {
    super();
    this.visual = new StructVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    const properties = this.visual.schema.properties;
    if (value === undefined || !isBrpObject(value) || properties === undefined) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedLabels(Object.keys(properties), (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(properties[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, anchor, segment, childSchema);
      }
      return new ErrorSync(this, anchor, segment, undefined, 'Schema is not found');
    });
    this.children.forEach((node) => node.sync());
  }
}

export class TupleSync extends DataSync {
  visual: TupleVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpTupleSchema
  ) {
    super();
    this.visual = new TupleVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    const prefixItems = this.visual.schema.prefixItems;
    if (prefixItems === undefined) return this.children.clear();
    if (value === undefined || !isBrpArray(value)) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(prefixItems.length, (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(prefixItems[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, anchor, segment, childSchema);
      }
      return new ErrorSync(this, anchor, segment, undefined, 'Schema is not found');
    });
    this.children.forEach((node) => node.sync());
  }
}

export class TupleStructSync extends DataSync {
  visual: TupleStructVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpTupleStructSchema
  ) {
    super();
    this.visual = new TupleStructVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    const prefixItems = this.visual.schema.prefixItems;
    if (prefixItems === undefined) return this.children.clear();
    if (value === undefined || !isBrpArray(value)) {
      this.children.clear();
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(prefixItems.length, (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(prefixItems[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, anchor, segment, childSchema);
      }
      return new ErrorSync(this, anchor, segment, undefined, 'Schema is not found');
    });
    this.children.forEach((node) => node.sync());
  }
}

export class SerializedSync extends DataSync {
  visual: SerializedVisual;
  constructor(
    public parent: ComponentListSync | DataSync,
    anchor: HTMLElement,
    public label: PathSegment,
    schema: BrpSchemaUnit
  ) {
    super();
    this.visual = new SerializedVisual(this, anchor, schema);
  }
  sync(): void {
    const value = this.getValue();
    if (value !== undefined) this.visual.set(value);
    else {
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.forEach((node) => node.sync());
  }
}

export class ErrorSync extends DataSync {
  visual: ErrorVisual;
  requestValueMutation = undefined;

  constructor(
    public parent: DataSync | ComponentListSync,
    anchor: HTMLElement,
    public label: PathSegment,
    code: number | undefined,
    message: string
  ) {
    super();
    this.visual = new ErrorVisual(this, anchor, { code, message });
  }
  sync(): void {}
  getValue(): BrpValue | undefined {
    return this.visual.error.message;
  }
  getDebugTree(): string {
    return `${this.label} => ${this.visual.error.message}`;
  }
}

export function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}
