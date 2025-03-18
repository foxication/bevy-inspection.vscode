import { BrpValueWrapped, TypePath } from 'bevy-remote-protocol';

export type BrpStructurePath = (TypePath | number)[];

export function labelFromPath(path: BrpStructurePath): string {
  if (path.length > 0) return path[path.length - 1].toString();
  return 'NULL';
}

export function serializePath(path: BrpStructurePath): string {
  return path
    .map((value) => {
      return typeof value === 'string' ? '/' + value : '.' + value.toString();
    })
    .join();
}
export function deserializePath(path: string): BrpStructurePath {
  return path
    .split('.')
    .map((value) => {
      return value.split('/');
    })
    .flat()
    .filter((value) => value !== '')
    .map((value) => {
      return isFinite(parseInt(value[0])) ? parseInt(value) : value;
    });
}
export function doesValueObjectHas(obj: BrpValueWrapped, path: BrpStructurePath): boolean {
  // if itself
  if (path.length === 0) return true;

  // if object OR array contains such path
  const holder = obj.get(path.slice(0, path.length - 1));
  if (holder instanceof Object && holder !== null) {
    return Object.keys(holder).includes(path[path.length - 1].toString());
  }

  return false;
}
