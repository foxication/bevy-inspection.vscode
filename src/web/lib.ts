import { BrpObject, BrpValue, BrpStructurePath } from 'bevy-remote-protocol/src/types';

export function labelFromPath(path: BrpStructurePath): string {
  if (path.length > 0) return path[path.length - 1].toString();
  return 'NULL';
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
  | { cmd: 'update'; data: BrpObject };
