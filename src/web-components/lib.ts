import { TypePath, BrpValue, BrpComponentRegistry } from '../protocol';

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
  | { cmd: 'update'; data: BrpComponentRegistry }
  | { cmd: 'update_component'; component: TypePath; value: BrpValue };
