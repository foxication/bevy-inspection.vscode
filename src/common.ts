import {
  BrpComponentRegistry,
  BrpRegistrySchema,
  BrpResponseErrors,
  BrpValue,
  EntityId,
  TypePath,
  TypePathReference,
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
      data: { focus: EntityFocusAsObject; component: string; path: string; value: BrpValue };
    }
  | {
      cmd: 'request_for_registry_schema';
      host: string;
    }
  | {
      cmd: 'request_for_component_changes';
      focus: EntityFocusAsObject;
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
    }
  | {
      cmd: 'update_all_offline';
      focus: EntityFocusAsObject;
    }
  | {
      cmd: 'sync_registry_schema';
      host: string;
      data: BrpRegistrySchema;
      available: string[];
    }
  | {
      cmd: 'update_components';
      focus: EntityFocusAsObject;
      list: TypePath[];
      changes: BrpComponentRegistry;
      errors: BrpResponseErrors;
    }
  | {
      cmd: 'copy_error_message_to_clipboard';
      component: string;
    }
  | {
      cmd: 'copy_details_to_clipboard';
      details: string;
    }
  | {
      cmd: 'copy_value_to_clipboard';
      path: string;
    }
  | {
      cmd: 'manual_update';
    }
  | {
      cmd: 'live_update';
    };

export function forcedShortPath(typePath: string) {
  const splitted = typePath.split('<')[0].split('::');
  return splitted[splitted.length - 1];
}

export function resolveTypePathFromRef(ref: TypePathReference): TypePath {
  return ref.type.$ref.slice('#/$defs/'.length);
}
