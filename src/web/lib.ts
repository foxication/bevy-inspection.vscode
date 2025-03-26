import { TypePath, BrpObject, BrpValue, BrpStructurePath } from 'bevy-remote-protocol/src/types';

export function labelFromPath(path: BrpStructurePath): string {
  if (path.length > 0) return path[path.length - 1].toString();
  return 'NULL';
}

export function serializePath(path: BrpStructurePath): [string, string] {
  if (path.length === 0) return ['', ''];
  return [
    path[0].toString(),
    path
      .slice(1)
      .map((v) => '.' + v)
      .join(''),
  ];
}

export type WebviewMessage =
  | {
      cmd: 'mutate_component';
      data: {
        component: string;
        path: string;
        value: BrpValue;
      };
    }
  | {
      cmd: 'ready_for_watch';
    };

export type VSCodeMessage =
  | {
      cmd: 'set_entity_info';
      host: string;
      entityId: number;
    }
  | { cmd: 'update'; data: BrpObject }
  | { cmd: 'update_component'; component: TypePath; value: BrpValue };

export class BrpPathLabel {
  private _label?: string;
  private _index: string;
  private _kind: 'structItem' | 'tupleItem' | 'listItem';

  constructor(kind: typeof this._kind, index: string, label?: string) {
    this._label = label;
    this._index = index;
    this._kind = kind;
  }

  get default(): string {
    switch (this._kind) {
      case 'listItem':
        return `[${this._index}]`;
      case 'tupleItem':
        return `.${this._index}`;
      case 'structItem':
        if (this._label !== undefined) return `.${this._label}`;
        return `#${this._index}`;
    }
  }
}

export type BrpPath = BrpPathLabel[];

export class BrpStructureCustom {
  private tree: BrpObject;

  constructor(tree: BrpObject) {
    this.tree = tree;
  }

  has(path: BrpPath = []): boolean {
    return BrpStructureCustom.hasBrpValue(this.tree, path);
  }
  get(path: BrpPath = []): BrpValue | undefined {
    return BrpStructureCustom.getBrpValue(this.tree, path);
  }
  set(path: BrpPath = [], value: BrpValue) {
    BrpStructureCustom.setBrpValue(this.tree, path, value);
  }
  keys(path: BrpPath = []): TypePath[] | number[] {
    const iterable = this.get(path);
    if (typeof iterable !== 'object') return [];
    if (iterable === undefined || iterable === null) return [];

    if (iterable instanceof Array) return [...iterable.keys()];
    return Object.keys(iterable);
  }
  values(path: BrpPath = []): BrpValue[] {
    const iterable = this.get(path);
    if (typeof iterable !== 'object') return [];
    if (iterable === undefined || iterable === null) return [];

    return Object.values(iterable);
  }
  remove(path: BrpPath = []) {
    BrpStructureCustom.removeBrpValue(this.tree, path);
  }

  private static hasBrpValue(value?: BrpValue, path: BrpPath = []): boolean {
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

  private static getBrpValue(value?: BrpValue, path: BrpPath = []): BrpValue | undefined {
    if (value === undefined) return undefined;
    if (path.length === 0) return value;
    if (typeof value !== 'object' || value === null) return undefined;

    // Array
    const key = path[0];
    if (value instanceof Array) {
      if (typeof key !== 'number') return null;
      return BrpStructureCustom.getBrpValue(value[key], path.slice(1));
    }

    // Object
    if (typeof key !== 'string') return null;
    return BrpStructureCustom.getBrpValue(value[key], path.slice(1));
  }

  private static setBrpValue(value: BrpValue, path: BrpPath = [], setter: BrpValue): void {
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
      BrpStructureCustom.setBrpValue(value[key], path.slice(1), setter);
      return;
    }

    // Object
    if (typeof key !== 'string') return;
    if (path.length === 1) {
      value[key] = setter;
      return;
    }
    BrpStructureCustom.setBrpValue(value[key], path.slice(1), setter);
  }

  private static removeBrpValue(value: BrpValue, path: BrpPath = []): void {
    if (path.length === 0) return;
    if (value !== 'object') return;
    if (path.length === 1) delete value[path[0].default()];
  }
}
