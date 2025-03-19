import { BrpStructurePath } from "bevy-remote-protocol/src/types";

export function labelFromPath(path: BrpStructurePath): string {
  if (path.length > 0) return path[path.length - 1].toString();
  return 'NULL';
}
