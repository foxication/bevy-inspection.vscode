import { postWebviewMessage } from '.';
import { EntityFocus, forcedShortPath, resolveTypePathFromRef } from '../common';
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
} from '../protocol/types';
import { TooltipData } from './elements';
import {
  ArrayVisual,
  JsonBooleanVisual,
  ComponentListVisual,
  EnumVisual,
  ErrorVisual,
  JsonArrayVisual,
  JsonObjectVisual,
  ListVisual,
  MapVisual,
  JsonNullVisual,
  JsonNumberVisual,
  SetVisual,
  JsonStringVisual,
  StructVisual,
  TupleVisual,
  Visual,
  VisualWithSync,
} from './visual';

export type PathSegment = string | number;
export type OptionalPathSegment = PathSegment | undefined;

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
      if (child.segment === undefined) return onWithoutLabel;
      if (segments.includes(child.segment)) return true;
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
    const result = this.collection.find((node) => {
      if (node.segment === undefined) return true;
      return node.segment === segment;
    });
    if (result !== undefined && result.segment === undefined) return result.children.get(segment);
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
    this.collection.forEach((child) => (child instanceof DataSync ? child.sync() : undefined));
  }
  remove(toRemove: PathSegment) {
    const whiteList = this.collection
      .map((child) => child.segment)
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
  getByPath(path: PathSegment[]): DataWithAccess | undefined {
    if (path.length === 0) return this instanceof DataWithAccess ? this : undefined;
    return this.children.get(path[0])?.getByPath(path.splice(1));
  }
  getStartAnchor() {
    return this.visual.dom;
  }
  getEndAnchor() {
    return this.children.getLast()?.visual.dom ?? this.getStartAnchor();
  }

  abstract visual: Visual;
  abstract getValue(): BrpValue | undefined;
  abstract getDebugTree(): string;
}

//
// Root DataSync
//

export class ComponentListData extends RootOfData {
  visual: ComponentListVisual;
  private mapOfComponents: BrpComponentRegistry = {};
  private registry: BrpRegistrySchema = {};
  private focus: EntityFocus | undefined = undefined;

  constructor(public section: HTMLElement) {
    super();
    this.visual = new ComponentListVisual(this, section);
    this.section.style.display = 'none';
    return this;
  }

  getValue(): BrpObject {
    return this.mapOfComponents;
  }
  getFocus() {
    return this.focus;
  }
  getSchema(typePath: TypePath): BrpSchemaUnit | undefined {
    if (Object.keys(this.registry).includes(typePath)) return this.registry[typePath];
    return undefined;
  }
  getComponentList(): TypePath[] {
    return Object.keys(this.mapOfComponents);
  }
  switchFocus(registry: BrpRegistrySchema, focus: EntityFocus, clearList = false) {
    this.registry = registry;
    this.focus = focus;
    if (clearList) {
      this.mapOfComponents = {};
      this.children.clear(); // sync
      this.updateVisibilityOfSection();
    }
  }
  insertComponents(components: BrpComponentRegistry) {
    const insert = Object.keys(components);

    // Apply
    for (const typePath of insert) this.mapOfComponents[typePath] = components[typePath];

    // Get TypePaths
    const TypePathListOrdered = Object.keys(this.mapOfComponents).sort((a, b) => {
      const aShort = this.getSchema(a)?.shortPath ?? forcedShortPath(a);
      const bShort = this.getSchema(b)?.shortPath ?? forcedShortPath(b);
      return aShort > bShort ? 1 : bShort > aShort ? -1 : 0;
    });

    // Remove and create children
    this.children.updateOnOrderedLabels(TypePathListOrdered, (typePath, anchor) => {
      const schema = this.getSchema(typePath.toString());
      const result =
        schema !== undefined
          ? createSyncFromSchema(this, typePath, schema, anchor)
          : new ErrorData(this, typePath, undefined, `schema is not found for ${typePath}`, anchor);
      return result;
    });

    this.children.forEach((child) => {
      if (insert.includes(child.getPath()[0]) && child instanceof DataSync) child.sync();
    });

    this.updateVisibilityOfSection();
  }
  removeComponent(component: TypePath) {
    if (!this.getComponentList().includes(component)) {
      return console.error(`syncComponent(): specified component is not found`);
    }
    delete this.mapOfComponents[component];
    this.children.remove(component);

    this.updateVisibilityOfSection();
  }
  getDebugTree(): string {
    let result = 'Components:\n';
    this.children.forEach((node) => (result += node.getDebugTree()));
    return result;
  }

  private updateVisibilityOfSection() {
    if (Object.keys(this.mapOfComponents).length === 0) this.section.style.display = 'none';
    else this.section.style.removeProperty('display');
  }
}

//
// DataSync with parent
//

export abstract class DataWithAccess extends RootOfData {
  getRoot(): ComponentListData {
    if (this.parent instanceof ComponentListData) return this.parent;
    return this.parent.getRoot();
  }
  getValue(): BrpValue | undefined {
    if (this.segment === undefined) return this.parent.getValue();
    const iterable = this.parent.getValue();
    if (iterable === undefined) return undefined;
    if (isBrpObject(iterable) && typeof this.segment === 'string') {
      return iterable[this.segment];
    }
    if (isBrpArray(iterable) && typeof this.segment === 'number') {
      return iterable[this.segment];
    }
    return undefined;
  }
  getValueAsNull(): null | undefined {
    const result = this.getValue();
    if (result === null) return result;
    return undefined;
  }
  getValueAsNumber(): number | undefined {
    const result = this.getValue();
    if (typeof result === 'number') return result;
    return undefined;
  }
  getValueAsString(): string | undefined {
    const result = this.getValue();
    if (typeof result === 'string') return result;
    return undefined;
  }
  getValueAsBoolean(): boolean | undefined {
    const result = this.getValue();
    if (typeof result === 'boolean') return result;
    return undefined;
  }
  getValueAsArray(): BrpValue[] | undefined {
    const result = this.getValue();
    if (result !== undefined && isBrpArray(result)) return result;
    return undefined;
  }
  getValueAsObject(): BrpObject | undefined {
    const result = this.getValue();
    if (result !== undefined && isBrpObject(result)) return result;
    return undefined;
  }
  getPath(): [string, ...PathSegment[]] {
    if (this.parent instanceof ComponentListData) {
      if (this.segment === undefined) {
        console.error('component is not with label');
        return [''];
      }
      return [this.segment.toString()];
    }
    if (this.segment === undefined) return this.parent.getPath();
    return [...this.parent.getPath(), this.segment];
  }
  getPathSerialized() {
    return this.getPath()
      .map((value) => value.toString())
      .join('.');
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
  requestValueMutation: (value: BrpValue) => void = (value: BrpValue) => {
    const [component, path] = this.getMutationPath();
    const focus = this.getRoot().getFocus();
    if (focus === undefined) return;
    postWebviewMessage({ cmd: 'mutate_component', data: { focus, component, path, value } });
  };
  getLabelToRender(): string {
    if (this.segment === undefined) {
      if (this.parent instanceof DataWithAccess) return this.parent.getLabelToRender();
      return '???';
    }
    return this.segment.toString();
  }
  getTooltip(): TooltipData {
    if (this.segment === undefined && this.parent instanceof DataWithAccess) {
      const result = this.parent.getTooltip();
      return result;
    } else {
      const [componentPath, mutationPath] = this.getMutationPath();
      const result: TooltipData = {
        label: this.getLabelToRender(),
        componentPath,
        mutationPath,
        schemas: [],
        propertiesList: [],
      };
      return result;
    }
  }
  getDebugInfo(): string {
    return this.getPathSerialized() + ' = ' + JSON.stringify(this.getValue());
  }
  getDebugTree(): string {
    let result = this.getLabelToRender();
    if (this instanceof DataSyncWithSchema) result += ' => ' + this.schema.typePath + '\n';
    function shifted(text: string) {
      return text
        .split('\n')
        .map((line) => '  ' + line)
        .join('\n');
    }
    this.children.forEach((node) => (result += shifted(node.getDebugTree())));
    return result;
  }
  // return schema, if segment undefined => schema of parent is added
  getSchema(): BrpSchemaUnit[] {
    if (this.parent instanceof ComponentListData) return [];
    if (this.segment === undefined) return this.parent.getSchema();
    return [];
  }

  abstract parent: ComponentListData | DataWithAccess;
  abstract segment: OptionalPathSegment;
}

export abstract class DataSync extends DataWithAccess {
  abstract sync(): void;
}

export abstract class DataSyncWithSchema extends DataSync {
  getTooltip(): TooltipData {
    const result = super.getTooltip();
    result.schemas.push(this.schema);
    return result;
  }
  getLabelToRender(): string {
    if (this.parent instanceof ComponentListData) return this.schema.shortPath;
    return super.getLabelToRender();
  }
  getSchema(): BrpSchemaUnit[] {
    if (this.parent instanceof ComponentListData) return [this.schema];
    if (this.segment === undefined) return [...this.parent.getSchema(), this.schema];
    return [this.schema];
  }

  abstract schema: BrpSchemaUnit;
}

export abstract class BrpValueSync extends DataSync {
  getTooltip(): TooltipData {
    const result = super.getTooltip();
    const addSection = (name: string) => result.propertiesList.push({ jsonValueType: name });
    if (this instanceof NullSync) addSection('Null');
    if (this instanceof StringSync) addSection('String');
    if (this instanceof NumberSync) addSection('Number');
    if (this instanceof BooleanSync) addSection('Boolean');
    if (this instanceof JsonObjectSync) addSection('Object');
    if (this instanceof JsonArraySync) addSection('Array');
    return result;
  }
  requestValueMutation = (value: BrpValue) => {
    // Modify parent.value
    const parentValue = this.parent.getValue();
    if (parentValue === undefined) return console.error('parent.value is undefined');
    if (this.segment === undefined) {
      if (this.parent.requestValueMutation !== undefined) {
        this.parent.requestValueMutation(value);
      }
    } else {
      if (typeof this.segment === 'string' && isBrpObject(parentValue)) {
        parentValue[this.segment] = value;
      }
      if (typeof this.segment === 'number' && isBrpArray(parentValue)) {
        parentValue[this.segment] = value;
      }
      if (this.parent.requestValueMutation !== undefined) {
        this.parent.requestValueMutation(parentValue);
      }
    }
  };

  abstract parent: SerializedSync | BrpValueSync;
}

//
// Schema Defined Data
//

function createSyncFromSchema(
  parent: ComponentListData | DataWithAccess,
  label: OptionalPathSegment,
  schema: BrpSchemaUnit,
  anchor: HTMLElement
) {
  if (
    schema.reflectTypes !== undefined &&
    schema.reflectTypes.includes('Serialize') &&
    !(schema.kind === 'Enum' && schema.type === 'string')
  ) {
    return new SerializedSync(parent, label, schema, anchor);
  }
  switch (schema.kind) {
    case 'Array':
      return new ArraySync(parent, label, schema, anchor);
    case 'Enum':
      switch (schema.type) {
        case 'string':
          return new EnumAsStringSync(parent, label, schema, anchor);
        case 'object':
          return new ErrorData(parent, label, undefined, 'Not Implemented', anchor);
      }
      break;
    case 'List':
      return new ListSync(parent, label, schema, anchor);
    case 'Map':
      return new MapSync(parent, label, schema, anchor);
    case 'Set':
      return new SetSync(parent, label, schema, anchor);
    case 'Struct':
      return new StructSync(parent, label, schema, anchor);
    case 'Tuple':
    case 'TupleStruct':
      return new TupleSync(parent, label, schema, anchor);
    case 'Value':
      return new SerializedSync(parent, label, schema, anchor);
  }
}

export class ArraySync extends DataSyncWithSchema {
  visual: ArrayVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public segment: OptionalPathSegment,
    public schema: BrpArraySchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new ArrayVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsArray();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.items));
    if (value === undefined || childSchema === undefined) {
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
    public segment: OptionalPathSegment,
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
    public segment: OptionalPathSegment,
    public schema: BrpListSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new ListVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsArray();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.items));
    if (value === undefined || childSchema === undefined) {
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
    public segment: OptionalPathSegment,
    public schema: BrpMapSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new MapVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsObject();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.valueType));
    if (value === undefined || childSchema === undefined) {
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
    public segment: OptionalPathSegment,
    public schema: BrpSetSchema,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new SetVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsArray();
    const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(this.schema.items));
    if (value === undefined || childSchema === undefined) {
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
    public segment: OptionalPathSegment,
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
    const value = this.getValueAsObject();
    if (value === undefined) {
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }

    // Default
    this.children.updateOnOrderedLabels(Object.keys(properties).sort(), (segment, anchor) => {
      const childSchema = this.getRoot().getSchema(resolveTypePathFromRef(properties[segment]));
      if (childSchema !== undefined) {
        return createSyncFromSchema(this, segment, childSchema, anchor);
      }
      return new ErrorData(this, segment, undefined, 'Schema is not found', anchor);
    });
    this.children.sync();
  }
}

export class TupleSync extends DataSyncWithSchema {
  visual: Visual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public segment: OptionalPathSegment,
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
    const created = new ErrorData(this, undefined, undefined, errorMessage, anchor);
    this.children.push(created);
    this.visual = created.visual;
  }
  sync(): void {
    // scenario: empty tuplestruct
    // scenario: tuplestruct is single value
    const prefixItems = this.schema.prefixItems ?? [];
    if (prefixItems.length === 1) return this.children.sync();

    // exception: BrpValue is not array
    const value = this.getValueAsArray();
    if (value === undefined) {
      return console.error(`Cannot read a BrpValue: ${this.getDebugInfo()}`);
    }

    // scenario: update children and sync
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

//
// Serialized Data
//

export class SerializedSync extends DataSyncWithSchema {
  visual: JsonNullVisual | JsonStringVisual | JsonNumberVisual | ErrorVisual;
  constructor(
    public parent: ComponentListData | DataWithAccess,
    public segment: OptionalPathSegment,
    public schema: BrpSchemaUnit,
    anchor: HTMLElement
  ) {
    super();
    // Scneario: undefined
    const value = this.getValue();
    if (value === undefined) {
      const created = new ErrorData(this, undefined, undefined, 'BrpValue is undefined', anchor);
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
  label: OptionalPathSegment,
  value: BrpValue,
  anchor: HTMLElement
) {
  // Scenario: null
  if (value === null) {
    return new NullSync(parent, label, anchor);
  }

  // Scenario: string
  if (typeof value === 'string') {
    return new StringSync(parent, label, anchor);
  }

  // Scenario: number
  if (typeof value === 'number') {
    return new NumberSync(parent, label, anchor);
  }

  // Scenario: boolean
  if (typeof value === 'boolean') {
    return new BooleanSync(parent, label, anchor);
  }

  // Scenario: object
  if (isBrpObject(value)) {
    return new JsonObjectSync(parent, label, anchor);
  }

  // Scenario: array
  return new JsonArraySync(parent, label, anchor);
}

export class NullSync extends BrpValueSync {
  visual: JsonNullVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public segment: OptionalPathSegment,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonNullVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsNull();
    if (value !== undefined) this.visual.set(value);
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class StringSync extends BrpValueSync {
  visual: JsonStringVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public segment: OptionalPathSegment,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonStringVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsString();
    if (value !== undefined) this.visual.set(value);
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class NumberSync extends BrpValueSync {
  visual: JsonNumberVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public segment: OptionalPathSegment,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonNumberVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsNumber();
    if (value !== undefined) this.visual.set(value);
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class BooleanSync extends BrpValueSync {
  visual: JsonBooleanVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public segment: OptionalPathSegment,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonBooleanVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValue();
    this.visual.set(typeof value === 'boolean' ? value : null);
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

export class JsonObjectSync extends BrpValueSync {
  visual: JsonObjectVisual;
  constructor(
    public parent: SerializedSync | BrpValueSync,
    public segment: OptionalPathSegment,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonObjectVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsObject();
    if (value !== undefined) {
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
    public segment: OptionalPathSegment,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new JsonArrayVisual(this, anchor);
  }
  sync(): void {
    const value = this.getValueAsArray();
    if (value !== undefined) {
      this.children.updateOnOrderedArray(value.length, (segment, anchor) =>
        createBrpValueSync(this, segment, value[segment], anchor)
      );
    }
    this.children.sync();
    if (value === undefined) console.error(`BrpValue is not found`);
  }
}

//
// Error Data
//

export class ErrorData extends DataWithAccess {
  visual: ErrorVisual;

  constructor(
    public parent: DataWithAccess | ComponentListData,
    public segment: OptionalPathSegment,
    public code: number | undefined,
    message: string,
    anchor: HTMLElement
  ) {
    super();
    this.visual = new ErrorVisual(this, anchor, { code, message });
  }
  getTooltip(): TooltipData {
    const result = super.getTooltip();
    result.propertiesList.push({
      treeItem: 'Error',
      errorCode: (this.code ?? 'undefined').toString(),
    });
    return result;
  }
  getDebugTree(): string {
    return `${this.getLabelToRender()} => ${this.visual.error.message}\n`;
  }
}
