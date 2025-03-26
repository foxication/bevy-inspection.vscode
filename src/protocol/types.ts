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

export type BrpValue = string | number | boolean | null | BrpValue[] | BrpObject;
export type BrpObject = { [key: TypePath]: BrpValue };

export type BrpStructurePath = (TypePath | number)[];
export class BrpStructure {
  private tree: BrpValue;

  constructor(tree: BrpValue) {
    this.tree = tree;
  }

  has(path: BrpStructurePath = []): boolean {
    return BrpStructure.hasBrpValue(this.tree, path);
  }
  get(path: BrpStructurePath = []): BrpValue | undefined {
    return BrpStructure.getBrpValue(this.tree, path);
  }
  set(path: BrpStructurePath = [], value: BrpValue) {
    if (path.length === 0) {
      this.tree = value;
      return;
    }
    BrpStructure.setBrpValue(this.tree, path, value);
  }
  keys(path: BrpStructurePath = []): TypePath[] | number[] {
    const iterable = this.get(path);
    if (typeof iterable !== 'object') return [];
    if (iterable === undefined || iterable === null) return [];

    if (iterable instanceof Array) return [...iterable.keys()];
    return Object.keys(iterable);
  }
  values(path: BrpStructurePath = []): BrpValue[] {
    const iterable = this.get(path);
    if (typeof iterable !== 'object') return [];
    if (iterable === undefined || iterable === null) return [];

    return Object.values(iterable);
  }

  private static hasBrpValue(value?: BrpValue, path: BrpStructurePath = []): boolean {
    if (value === undefined) return false;
    if (path.length === 0) return true;
    if (typeof value !== 'object' || value === null) return false;

    // Array
    const key = path[0]; // length >= 1
    if (value instanceof Array) {
      if (typeof key !== 'number') return false;
      return this.hasBrpValue(value[key], path.slice(1));
    }

    // Object
    if (typeof key !== 'string') return false;
    return this.hasBrpValue(value[key], path.slice(1));
  }

  private static getBrpValue(value?: BrpValue, path: BrpStructurePath = []): BrpValue | undefined {
    if (value === undefined) return undefined;
    if (path.length === 0) return value;
    if (typeof value !== 'object' || value === null) return undefined;

    // Array
    const key = path[0];
    if (value instanceof Array) {
      if (typeof key !== 'number') return null;
      return BrpStructure.getBrpValue(value[key], path.slice(1));
    }

    // Object
    if (typeof key !== 'string') return null;
    return BrpStructure.getBrpValue(value[key], path.slice(1));
  }

  private static setBrpValue(value: BrpValue, path: BrpStructurePath = [], setter: BrpValue): void {
    if (path.length === 0) return;
    if (typeof value !== 'object' || value === null) return;

    // Array
    const key = path[0];
    if (value instanceof Array) {
      if (typeof key !== 'number') return;
      if (path.length === 1) {
        value[key] = setter;
        return;
      }
      BrpStructure.setBrpValue(value[key], path.slice(1), setter);
      return;
    }

    // Object
    if (typeof key !== 'string') return;
    if (path.length === 1) {
      value[key] = setter;
      return;
    }
    BrpStructure.setBrpValue(value[key], path.slice(1), setter);
  }
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

export type BevyVersion = '0.15' | '0.16';
export type CommonTypePath = 'ChildOf' | 'Children' | 'Name';
