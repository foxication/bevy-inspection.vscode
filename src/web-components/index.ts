import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { DataSyncManager } from './sync';
import { BrpValue, BrpComponentRegistry, BrpRegistrySchema, BrpObject, TypePath, BrpErrors } from '../protocol/types';
import { defineCustomElements } from './elements';
import { EntityFocus } from '../connection-list';
import { ErrorList } from './errors';

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
    };

export type VSCodeMessage =
  | { cmd: 'debug_output' }
  | {
      cmd: 'update_all';
      focus: EntityFocus;
      components: BrpComponentRegistry;
      errors: BrpErrors;
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
    };

// VSCode Access
const vscode = acquireVsCodeApi();
export function postWebviewMessage(message: WebviewMessage) {
  vscode.postMessage(message);
}

// Define custom elements
defineCustomElements();

// Main script
(function () {
  const componentList = document.querySelector('#component-tree') as HTMLDivElement;
  if (componentList === null) return console.error('componentList is not found in DOM');
  const syncRoot = new DataSyncManager(componentList);

  const errorList = document.querySelector('#error-list') as HTMLDListElement;
  if (errorList === null) return console.error('errorList is not found in DOM');
  const errorsRoot = new ErrorList(errorList);

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    switch (message.cmd) {
      case 'debug_output':
        console.log(syncRoot.debugTree());
        console.log(errorsRoot.debugList());
        break;
      case 'sync_registry_schema':
        syncRoot.syncRegistrySchema(message.available, message.host, message.data);
        switch (syncRoot.trySync()) {
          case 'done':
            if (syncRoot.focus !== undefined) postWebviewMessage({ cmd: 'ready_for_watch', focus: syncRoot.focus });
            break;
          case 'no_registry_schema':
            console.error('registry schema did not load');
            break;
        }
        break;
      case 'update_all':
        setEntityInfo(message.focus);
        syncRoot.focus = message.focus;
        syncRoot.mapOfComponents = message.components;
        errorsRoot.update(message.errors);
        switch (syncRoot.trySync()) {
          case 'done':
            postWebviewMessage({ cmd: 'ready_for_watch', focus: message.focus });
            break;
          case 'no_registry_schema':
            postWebviewMessage({ cmd: 'request_for_registry_schema', host: message.focus.host });
            break;
        }
        break;
      case 'update_components':
        if (syncRoot.focus === undefined) break;
        if (syncRoot.focus.host !== message.focus.host) break;
        if (syncRoot.focus.entityId !== message.focus.entityId) break;
        Object.entries(message.components).forEach(([typePath, value]) => (syncRoot.mapOfComponents[typePath] = value));
        message.removed.forEach((component) => delete syncRoot.mapOfComponents[component]);
        syncRoot.trySync();
        break;
    }
  });

  function setEntityInfo(focus: EntityFocus) {
    const hostLabel = document.querySelector('#entity-info-host');
    const idLabel = document.querySelector('#entity-info-id');
    if (hostLabel !== null) hostLabel.textContent = focus.host;
    if (idLabel !== null) idLabel.textContent = focus.entityId.toString();
  }
})();
