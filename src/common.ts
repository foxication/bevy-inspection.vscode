import {
  BrpComponentRegistry,
  BrpObject,
  BrpRegistrySchema,
  BrpResponseErrors,
  BrpValue,
  EntityId,
  TypePath,
} from './protocol/types';

export type EntityFocusAsObject = { host: string; entityId: number };
export class EntityFocus {
  constructor(public host: string, public entityId: EntityId) {}
  static fromObject(from: EntityFocusAsObject): EntityFocus {
    return new EntityFocus(from.host, from.entityId);
  }
  compare(another: EntityFocus): boolean {
    return this.host === another.host && this.entityId === another.entityId;
  }
  clone() {
    return new EntityFocus(this.host, this.entityId);
  }
  toObject(): EntityFocusAsObject {
    return {
      host: this.host,
      entityId: this.entityId,
    };
  }
}

export type WebviewMessage =
  | {
      cmd: 'mutate_component';
      data: { focus: EntityFocus; component: string; path: string; value: BrpValue };
    }
  | {
      cmd: 'request_for_registry_schema';
      host: string;
    }
  | {
      cmd: 'ready_for_watch';
      focus: EntityFocus;
      components: TypePath[];
    }
  | {
      cmd: 'write_clipboard';
      text: string;
    };

export type VSCodeMessage =
  | { cmd: 'debug_output' }
  | {
      cmd: 'update_all';
      focus: EntityFocusAsObject;
      components: BrpComponentRegistry;
      errors: BrpResponseErrors;
    }
  | {
      cmd: 'sync_registry_schema';
      host: string;
      data: BrpRegistrySchema;
      available: string[];
    }
  | {
      cmd: 'update_components';
      focus: EntityFocus;
      components: BrpObject;
      removed: TypePath[];
    }
  | {
      cmd: 'copy_error_message_to_clipboard';
      component: string;
    }
  | {
      cmd: 'copy_value_to_clipboard';
      path: string;
    };
