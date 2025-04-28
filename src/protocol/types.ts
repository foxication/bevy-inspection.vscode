export type EntityId = number;
export type TypePath = string;

export type BrpError = 'disconnection' | 'unspecified_error';
export type BrpResponse<R> = {
  jsonrpc: string;
  id: number;
  result?: R;
  error?: BrpResponseError;
};
export type BrpResponseError = {
  code: number;
  message: string;
  data?: BrpValue;
};
export type BrpResponseErrors = { [key: TypePath]: BrpResponseError };

export type BrpValue = BrpPrimitive | BrpValue[] | BrpObject;
export type BrpPrimitive = string | number | boolean | null;
export type BrpObject = { [key: TypePath]: BrpValue };
export type BrpComponentRegistry = { [key: TypePath]: BrpValue };

export function isPrimitive(value: BrpValue): value is BrpPrimitive {
  if (value === null) return true;
  return ['string', 'number', 'boolean'].includes(typeof value);
}

export function isBrpIterable(value: BrpValue): value is BrpObject | BrpValue[] {
  if (value === null) return false;
  return typeof value === 'object';
}

export function isBrpObject(value: BrpValue): value is BrpObject {
  if (value === null) return false;
  return typeof value === 'object' && !(value instanceof Array);
}

export function isBrpArray(value: BrpValue): value is BrpValue[] {
  if (value === null) return false;
  return value instanceof Array;
}

export type BrpGetWatchResult = {
  components: BrpObject;
  removed: TypePath[];
  errors: BrpResponseErrors;
};

export type BrpGetWatchStrictResult = {
  components: BrpObject;
  removed: TypePath[];
};

export type BrpListWatchResult = {
  added: TypePath[];
  removed: TypePath[];
};

export const BevyVersions = ['0.15', '0.16', 'future'] as const;
export type BevyVersion = (typeof BevyVersions)[number];

export type TypePathReference = { type: { $ref: string }; typePath?: string };
// export type BrpSchema = {
//   // Essential
//   typePath: TypePath;
//   shortPath: string;
//   kind: 'Enum' | 'Value' | 'Struct' | 'TupleStruct' | 'Tuple' | 'Array' | 'List' | 'Map' | 'Set';
//   type: 'object' | 'array' | 'set' | 'string' | 'uint' | 'int' | 'usize' | 'float' | 'boolean';

//   // Optional
//   keyType?: TypePathReference;
//   valueType?: TypePathReference;
//   additionalProperties?: boolean;
//   crateName?: string;
//   items?: false | TypePathReference;
//   prefixItems?: TypePathReference[];
//   modulePath?: string;
//   reflectTypes?: ('Serialize' | 'Deserialize' | 'Default' | 'Component' | 'Resource')[];
//   required?: string[];
//   properties?: { [property: string]: TypePathReference };
//   oneOf?: string[] | ({ shortPath: string; typePath: TypePath } | BrpSchema)[];
// };
export type BrpSchemaUnit =
  | BrpArraySchema
  | BrpEnumAsObjectSchema
  | BrpEnumAsStringSchema
  | BrpListSchema
  | BrpMapSchema
  | BrpSetSchema
  | BrpStructSchema
  | BrpTupleSchema
  | BrpTupleStructSchema
  | BrpValueSchema;

export interface BrpSchemaBasic {
  typePath: TypePath;
  shortPath: string;
  reflectTypes?: string[];
  crateName?: string;
  modulePath?: string;
}
export interface BrpArraySchema extends BrpSchemaBasic {
  kind: 'Array';
  type: 'array';
  items: TypePathReference;
}
export interface BrpEnumAsObjectSchema extends BrpSchemaBasic {
  kind: 'Enum';
  type: 'object';
  oneOf: (BrpSchemaBasic | BrpSchemaUnit)[];
}
export interface BrpEnumAsStringSchema extends BrpSchemaBasic {
  kind: 'Enum';
  type: 'string';
  oneOf: string[];
}
export interface BrpListSchema extends BrpSchemaBasic {
  kind: 'List';
  type: 'array';
  items: TypePathReference;
}
export interface BrpMapSchema extends BrpSchemaBasic {
  kind: 'Map';
  type: 'object';
  keyType: TypePathReference;
  valueType: TypePathReference;
}
export interface BrpSetSchema extends BrpSchemaBasic {
  kind: 'Set';
  type: 'set';
  items: TypePathReference;
}
export interface BrpStructSchema extends BrpSchemaBasic {
  kind: 'Struct';
  type: 'Object';
  additionalProperties: false;
  required?: string[];
  properties?: { [property: string]: TypePathReference };
}
export interface BrpTupleSchema extends BrpSchemaBasic {
  kind: 'Tuple';
  type: 'array';
  items: false;
  prefixItems?: TypePathReference[];
}
export interface BrpTupleStructSchema extends BrpSchemaBasic {
  kind: 'TupleStruct';
  type: 'array';
  items: false;
  prefixItems?: TypePathReference[];
}
export interface BrpValueSchema extends BrpSchemaBasic {
  kind: 'Value';
  type: 'object' | 'string' | 'uint' | 'int' | 'usize' | 'float' | 'boolean';
}

export type BrpRegistrySchema = { [key: TypePath]: BrpSchemaUnit };

export type BrpDiscover = {
  info: { title: string; version: string };
  methods: { name: string; params: [] }[];
  openrpc: string;
  servers: { name: string; url: string }[];
};

export type FromShortPath = 'ChildOf' | 'Children' | 'Name';
