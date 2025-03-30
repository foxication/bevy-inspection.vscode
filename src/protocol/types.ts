export type EntityId = number;
export type TypePath = string;

export type BrpResponse<R> = {
  jsonrpc: string;
  id: number;
  result?: R;
  error?: BrpError;
};

export type BrpError = {
  code: number;
  message: string;
  data?: BrpValue;
};
export type BrpErrors = { [key: TypePath]: BrpError };

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
  errors: BrpErrors;
};

export type BrpGetWatchStrictResult = {
  components: BrpObject;
  removed: TypePath[];
};

export type BrpListWatchResult = {
  added: TypePath[];
  removed: TypePath[];
};

export const BevyVersions = ['0.15', '0.16'] as const;
export type BevyVersion = (typeof BevyVersions)[number];
export type CommonTypePath = 'ChildOf' | 'Children' | 'Name';

export type TypePathReference = { type: { $ref: string }; typePath?: string };
export type BrpSchema = {
  // Essential
  typePath: TypePath;
  shortPath: string;
  kind: 'Enum' | 'Value' | 'Struct' | 'TupleStruct' | 'Tuple' | 'Array' | 'List' | 'Map' | 'Set';
  type: 'object' | 'array' | 'set' | 'string' | 'uint' | 'int' | 'usize' | 'float' | 'boolean';

  // Optional
  keyType?: TypePathReference;
  valueType?: TypePathReference;
  additionalProperties?: boolean;
  crateName?: string;
  items?: false | TypePathReference;
  prefixItems?: TypePathReference[];
  modulePath?: string;
  reflectTypes?: ('Serialize' | 'Deserialize' | 'Default' | 'Component' | 'Resource')[];
  required?: string[];
  properties?: { [property: string]: TypePathReference };
  oneOf?: (string | { shortPath: string; typePath: TypePath } | BrpSchema)[];
};
export type BrpRegistrySchema = { [key: TypePath]: BrpSchema };
