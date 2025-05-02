import { postWebviewMessage } from '.';
import { EntityFocus } from '../common';
import {
  BrpArraySchema,
  BrpComponentRegistry,
  BrpEnumAsStringSchema,
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
  BooleanVisual,
  ComponentListVisual,
  EnumVisual,
  ErrorVisual,
  JsonArrayVisual,
  JsonObjectVisual,
  ListVisual,
  MapVisual,
  NullVisual,
  NumberVisual,
  SerializedVisual,
  SetVisual,
  StringVisual,
  StructVisual,
  TupleVisual,
  Visual,
  VisualWithSync,
} from './visual';

export type PathSegment = string | number;
export type OptionalLabel =
  | { type: 'default'; segment: PathSegment; short?: string }
  | { type: 'skip' };

//
// Children of DataSync
//

class ChildrenOfSyncNode {
  private collection: DataWithAccess[] = [];
  constructor(public node: RootOfData) {}

  private updateIsExpandable() {
    if (this.node.visual instanceof VisualWithSync) {
      this.node.visual.isExpandable = this.collection.length > 0;
    }
  }
  private removeVisualsRecursively(node: DataWithAccess) {
    node.children.forEach((child) => this.removeVisualsRecursively(child));
    node.visual.dom.remove();
  }
  private filter(segments: PathSegment[], onWithoutLabel = false) {
    this.collection = this.collection.filter((child) => {
      switch (child.label.type) {
        case 'default':
          if (segments.includes(child.label.segment)) return true;
          this.removeVisualsRecursively(child);
          return false;
        case 'skip':
          return onWithoutLabel; // remove by default
      }
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
    const result = this.collection.find((node) => {
      switch (node.label.type) {
        case 'default':
          return node.label.segment === segment;
        case 'skip':
          return true;
      }
    });
    if (result?.label.type === 'skip') return result.children.get(segment);
    return result;
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
  remove(toRemove: PathSegment) {
    const whiteList = this.collection
      .map((child) => {
        switch (child.label.type) {
          case 'default':
            return child.label.segment;
          case 'skip':
            return undefined;
        }
      })
      .filter((childSegment) => childSegment !== undefined)
      .filter((childSegment) => childSegment !== toRemove);
    if (whiteList.length < this.collection.length) this.filter(whiteList);
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
    function shortPath(typePath: string) {
      return typePath.split('<')[0].split('::')[0];
    }

    // Get TypePaths
    const TypePathListOrdered = Object.keys(this.mapOfComponents).sort((a, b) => {
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
          : new ErrorData(
              this,
              { type: 'default', segment: typePath, short: shortPath(typePath) },
              undefined,
              'schema is not found',
              anchor
            );
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
  syncComponent(component: TypePath, data: BrpValue) {
    if (!Object.keys(this.mapOfComponents).includes(component)) {
      return console.error(`syncComponent(): specified component is not found`);
    }
    this.mapOfComponents[component] = data;
    const node = this.children.get(component);
    if (node instanceof DataSync) node.sync();
  }
  removeComponent(component: TypePath) {
    if (!Object.keys(this.mapOfComponents).includes(component)) {
      return console.error(`syncComponent(): specified component is not found`);
    }
    delete this.mapOfComponents[component];
    this.children.remove(component);
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
    if (this.label.type === 'skip') return this.parent.getValue();
    const iterable = this.parent.getValue();
    if (iterable === undefined) return undefined;
    if (isBrpObject(iterable) && typeof this.label.segment === 'string') {
      return iterable[this.label.segment];
    }
    if (isBrpArray(iterable) && typeof this.label.segment === 'number') {
      return iterable[this.label.segment];
    }
    return undefined;
  }
  getPath(): [string, ...PathSegment[]] {
    if (this.parent instanceof ComponentListData) {
      if (this.label.type === 'skip') {
        console.error('component is not with label');
        return [''];
      }
      return [this.label.segment.toString()];
    }
    if (this.label.type === 'skip') return this.parent.getPath();
    return [...this.parent.getPath(), this.label.segment];
  }
  getMutationPath(): [string, string] {
    const [component, ...path] = this.getPath();
    return [
      component,
      path
        .map((segment) => {
          if (typeof segment === 'number') return '[' + segment + ']';
          else return '.' + segment;
        })
        .join(''),
    ];
  }
  getDebugInfo(): string {
    return this.getPathSerialized() + ' = ' + JSON.stringify(this.getValue());
  }
  getDebugTree(): string {
    let result = this.getLabelToRender();
    if (this instanceof DataSyncWithSchema) result += ' => ' + this.schema;
    this.children.forEach((node) => (result += node.getDebugTree()));
    return result;
  }
  requestValueMutation: (value: BrpValue) => void = (value: BrpValue) => {
    const [component, path] = this.getMutationPath();
    const focus = this.getRoot().getFocus();
    if (focus === undefined) return;
    postWebviewMessage({ cmd: 'mutate_component', data: { focus, component, path, value } });
  };
  getLabel(): PathSegment {
    switch (this.label.type) {
      case 'default':
        return this.label.segment;
      case 'skip':
        if (this.parent instanceof DataWithAccess) return this.parent.getLabel();
        else return '';
    }
  }
  getLabelToRender(): string {
    switch (this.label.type) {
      case 'default':
        return this.label.short ?? this.label.segment.toString();
      case 'skip':
        if (this.parent instanceof DataWithAccess) return this.parent.getLabelToRender();
        return '???';
    }
  }

  abstract parent: ComponentListData | DataWithAccess;
  abstract label: OptionalLabel;
}

export abstract class DataSync extends DataWithAccess {
  abstract sync(): void;
}

export abstract class DataSyncWithSchema extends DataSync {
  getTooltip(): string {
    let result = '';
    if (this.label.type === 'default') result += '\n' + this.label.segment + '\n';
    if (this.label.type === 'skip' && this.parent instanceof DataSyncWithSchema) {
      result += this.parent.getTooltip() + '\n';
    }
    result += '\ntype: ' + this.schema.typePath;
    result += '\nkind: ' + this.schema.kind;
    if (this.schema.reflectTypes !== undefined) {
      result += '\nreflect: ' + this.schema.reflectTypes.join(', ');
    }
    return result;
  }
  abstract schema: BrpSchemaUnit;
}

export abstract class BrpValueSync extends DataSync {
  getTooltip(): string {
    let result = '';
    if (this.label.type === 'default') result += '\n' + this.label.segment + '\n';
    if (this.label.type === 'skip' && this.parent instanceof DataSyncWithSchema) {
      result += this.parent.getTooltip() + '\n';
    }
    const value = this.getValue();
    if (value === undefined) result += '\ntype: undefined';
    if (value === null) result += '\ntype: null';
    if (typeof value === 'string') result += '\ntype: string';
    if (typeof value === 'number') result += '\ntype: number';
    if (typeof value === 'boolean') result += '\ntype: boolean';
    if (value !== undefined && isBrpObject(value)) result += '\ntype: object';
    if (value !== undefined && isBrpArray(value)) result += '\ntype: array';
    return result;
  }
  requestValueMutation = (value: BrpValue) => {
    // Modify parent.value
    const parentValue = this.parent.getValue();
    if (parentValue === undefined) return console.error('parent.value is undefined');
    switch (this.label.type) {
      case 'default':
        if (typeof this.label.segment === 'string' && isBrpObject(parentValue)) {
          parentValue[this.label.segment] = value;
        }
        if (typeof this.label.segment === 'number' && isBrpArray(parentValue)) {
          parentValue[this.label.segment] = value;
        }
        if (this.parent.requestValueMutation !== undefined) {
          this.parent.requestValueMutation(parentValue);
        }
        break;
      case 'skip':
        if (this.parent.requestValueMutation !== undefined) {
          this.parent.requestValueMutation(value);
        }
        break;
    }
  };

  abstract parent: SerializedSync | BrpValueSync;
}

//
// Implementations
//

function createSyncFromSchema(
  parent: ComponentListData | DataWithAccess,
  label: PathSegment | undefined,
  schema: BrpSchemaUnit,
  anchor: HTMLElement
) {
  const short = schema.reflectTypes?.includes('Component') ? schema.shortPath : undefined;
  const asLabel: OptionalLabel =
    label === undefined ? { type: 'skip' } : { type: 'default', segment: label, short };
  if (
    schema.reflectTypes !== undefined &&
    schema.reflectTypes.includes('Serialize') &&
    !(schema.kind === 'Enum' && schema.type === 'string')
  ) {
    return new SerializedSync(parent, asLabel, schema, anchor);
  }
  switch (schema.kind) {
    case 'Array':
      return new ArraySync(parent, asLabel, schema, anchor);
    case 'Enum':
      switch (schema.type) {
        case 'string':
          return new EnumAsStringSync(parent, asLabel, schema, anchor);
        case 'object':
          return new ErrorData(parent, asLabel, undefined, 'Not Implemented', anchor);
      }
      break;
    case 'List':
      return new ListSync(parent, asLabel, schema, anchor);
    case 'Map':
      return new MapSync(parent, asLabel, schema, anchor);
    case 'Set':
      return new SetSync(parent, asLabel, schema, anchor);
    case 'Struct':
      return new StructSync(parent, asLabel, schema, anchor);
    case 'Tuple':
    case 'TupleStruct':
      return new TupleSync(parent, asLabel, schema, anchor);
    case 'Value':
      return new SerializedSync(parent, asLabel, schema, anchor);
  }
}

export class ArraySync extends DataSyncWithSchema {
  visual: ArrayVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
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
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) =>
      createSyncFromSchema(this, segment, childSchema, anchor)
    );
    this.children.sync();
  }
}

export class EnumAsStringSync extends DataSyncWithSchema {
  visual: EnumVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
    public schema: BrpEnumAsStringSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new EnumVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    if (typeof value !== 'string') return console.error(`BrpValue is not string`);
    this.visual.select(value);
  }
  getVariant(): string | undefined {
    const value = this.getValue();
    const variant = typeof value === 'string' ? value : undefined;
    return variant;
    // case 'object': {
    //   const keys = value !== undefined ? (isBrpObject(value) ? Object.keys(value) : []) : [];
    //   const variant = keys.length === 1 ? keys[0] : undefined;
    //   return variant;
    // }
  }
  getAvailableVariants(): string[] {
    return this.schema.oneOf;
    // case 'object': {
    //   return this.schema.oneOf.map((variant) => variant.shortPath);
    // }
  }
}

export class ListSync extends DataSyncWithSchema {
  visual: ListVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
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
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) =>
      createSyncFromSchema(this, segment, childSchema, anchor)
    );
    this.children.sync();
  }
}

export class MapSync extends DataSyncWithSchema {
  visual: MapVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
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
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedLabels(Object.keys(value).sort(), (segment, anchor) =>
      createSyncFromSchema(this, segment, childSchema, anchor)
    );
    this.children.sync();
  }
}

export class SetSync extends DataSyncWithSchema {
  visual: SetVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
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
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }
    this.children.updateOnOrderedArray(value.length, (segment, anchor) =>
      createSyncFromSchema(this, segment, childSchema, anchor)
    );
    this.children.sync();
  }
}

export class StructSync extends DataSyncWithSchema {
  visual: StructVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
    public schema: BrpStructSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new StructVisual(this, anchor);
  }
  sync(): void {
    // Scenario: empty struct
    const properties = this.schema.properties;
    if (properties === undefined) return;

    // Exception
    const value = this.getValue();
    if (value === undefined || !isBrpObject(value)) {
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }

    // Default
    this.children.updateOnOrderedLabels(Object.keys(properties).sort(), (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(properties[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, segment, childSchema, anchor);
      }
      return new ErrorData(
        this,
        { type: 'default', segment },
        undefined,
        'Schema is not found',
        anchor
      );
    });
    this.children.sync();
  }
}

export class TupleSync extends DataSyncWithSchema {
  visual: Visual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
    public schema: BrpTupleSchema | BrpTupleStructSchema,
    anchor: HTMLElement
  ) {
    super();
    // Scenario: tuple struct by default
    const prefixItems = this.schema.prefixItems ?? [];
    if (prefixItems.length !== 1) {
      this.visual = new TupleVisual(this, anchor);
      return;
    }
    // Scenario: tuple struct with controls/visuals of single child
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(prefixItems[0]));
    if (childSchema !== undefined) {
      const created = createSyncFromSchema(this, undefined, childSchema, anchor);
      this.children.push(created);
      this.visual = created.visual;
      return;
    }
    // Error
    const errorMessage = 'schema is not found for child';
    const created = new ErrorData(this, { type: 'skip' }, undefined, errorMessage, anchor);
    this.children.push(created);
    this.visual = created.visual;
  }
  sync(): void {
    // scenario: empty tuplestruct
    // scenario: tuplestruct is single value
    const prefixItems = this.schema.prefixItems ?? [];
    if (prefixItems.length === 1) return this.children.sync();

    // exception: BrpValue is not array
    const value = this.getValue();
    if (value === undefined || !isBrpArray(value)) {
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }

    // scenario: update children and sync
    this.children.updateOnOrderedArray(prefixItems.length, (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(prefixItems[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, segment, childSchema, anchor);
      }
      return new ErrorData(
        this,
        { type: 'default', segment },
        undefined,
        'Schema is not found',
        anchor
      );
    });
    this.children.sync();
  }
}

export class SerializedSync extends DataSyncWithSchema {
  visual: SerializedVisual | NullVisual | StringVisual | NumberVisual | ErrorVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public label: OptionalLabel,
    public schema: BrpSchemaUnit,
    anchor: HTMLElement
  ) {
    super();
    // Scneario: undefined
    const value = this.getValue();
    if (value === undefined) {
      const created = new ErrorData(
        this,
        { type: 'skip' },
        undefined,
        'BrpValue is undefined',
        anchor
      );
      this.children.push(created);
      this.visual = created.visual;
      return;
    }
    const created = createBrpValueSync(this, undefined, value, anchor);
    this.children.push(created);
    this.visual = created.visual;
  }
  sync(): void {
    const value = this.getValue();
    if (value === undefined) return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    this.children.sync();
  }
}

function createBrpValueSync(
  parent: SerializedSync | BrpValueSync,
  label: PathSegment | undefined,
  value: BrpValue,
  anchor: HTMLElement
) {
  const short =
    parent instanceof SerializedSync
      ? parent.schema.reflectTypes?.includes('Component')
        ? parent.schema.shortPath
        : undefined
      : undefined;
  const asLabel: OptionalLabel =
    label === undefined ? { type: 'skip' } : { type: 'default', segment: label, short };

  // Scenario: null
  if (value === null) {
    return new NullSync(parent, asLabel, anchor);
  }

  // Scenario: string
  if (typeof value === 'string') {
    return new StringSync(parent, asLabel, anchor);
  }

  // Scenario: number
  if (typeof value === 'number') {
    return new NumberSync(parent, asLabel, anchor);
  }

  // Scenario: boolean
  if (typeof value === 'boolean') {
    return new BooleanSync(parent, asLabel, anchor);
  }

  // Scenario: object
  if (isBrpObject(value)) {
    return new JsonObjectSync(parent, asLabel, anchor);
  }

  // Scenario: array
  return new JsonArraySync(parent, asLabel, anchor);
}

export class NullSync extends BrpValueSync {
  visual: NullVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public label: OptionalLabel,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new NullVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    this.visual.set(value ?? null);
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class StringSync extends BrpValueSync {
  visual: StringVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public label: OptionalLabel,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new StringVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    this.visual.set(value ?? '');
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class NumberSync extends BrpValueSync {
  visual: NumberVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public label: OptionalLabel,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new NumberVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    this.visual.set(value ?? 0);
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class BooleanSync extends BrpValueSync {
  visual: BooleanVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public label: OptionalLabel,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new BooleanVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    this.visual.set(value ?? 0);
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class JsonObjectSync extends BrpValueSync {
  visual: JsonObjectVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public label: OptionalLabel,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonObjectVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    if (value !== undefined && isBrpObject(value)) {
      this.children.updateOnOrderedLabels(Object.keys(value).sort(), (segment, anchor) =>
        createBrpValueSync(this, segment, value[segment], anchor)
      );
    }
    this.children.sync();
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class JsonArraySync extends BrpValueSync {
  visual: JsonArrayVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public label: OptionalLabel,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonArrayVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    if (value !== undefined && isBrpArray(value)) {
      this.children.updateOnOrderedArray(value.length, (segment, anchor) =>
        createBrpValueSync(this, segment, value[segment], anchor)
      );
    }
    this.children.sync();
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class ErrorData extends DataWithAccess {
  visual: ErrorVisual;

  constructor(
    public parent: DataWithAccess | ComponentListData,
    public label: OptionalLabel,
    public code: number | undefined,
    message: string,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new ErrorVisual(this, anchor, { code, message });
  }
  getTooltip(): string {
    let result = '';
    if (this.label.type === 'default') result += '\n' + this.label.segment + '\n';
    if (this.label.type === 'skip' && this.parent instanceof DataSyncWithSchema) {
      result += this.parent.getTooltip() + '\n';
    }
    if (this.code !== undefined) result += `\ncode: ${this.code}`;
    return result;
  }
  getDebugTree(): string {
    return `${this.getLabelToRender()} => ${this.visual.error.message}`;
  }
}

export function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}
