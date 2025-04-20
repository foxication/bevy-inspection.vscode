import '@vscode-elements/elements/dist/vscode-tree/index.js';
import { DataSyncManager } from './sync';
import { BrpValue, BrpComponentRegistry, BrpRegistrySchema, BrpObject, TypePath } from '../protocol/types';
import { defineCustomElements } from './elements';
import { EntityFocus } from '../connection-list';

export type WebviewMessage =
  | {
      cmd: 'mutate_component';
      data: { focus: EntityFocus; component: string; path: string; value: BrpValue };
    }
  | {
      cmd: 'request_of_sync_registry_schema';
      host: string;
    };

export type VSCodeMessage =
  | { cmd: 'debug_output' }
  | {
      cmd: 'update_all';
      focus: EntityFocus;
      data: BrpComponentRegistry;
    }
  | {
      cmd: 'sync_registry_schema';
      host: string;
      data: BrpRegistrySchema;
      available: string[];
    }
  | {
      cmd: 'update_components';
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
  const componentList = document.querySelector('#section-component-list') as HTMLDivElement;
  if (componentList === null) return console.error('#section-component-list is not found in DOM');
  const syncRoot = new DataSyncManager(componentList);
  const requestRegistrySchema = () => {
    if (syncRoot.focus === undefined) return console.error('requestRegistrySchema: no focus');
    postWebviewMessage({
      cmd: 'request_of_sync_registry_schema',
      host: syncRoot.focus.host,
    });
  };

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    switch (message.cmd) {
      case 'debug_output':
        console.log(syncRoot.debugTree());
        break;
      case 'sync_registry_schema':
        syncRoot.syncRegistrySchema(message.available, message.host, message.data);
        if (syncRoot.getRegistrySchema() !== undefined) syncRoot.sync();
        break;
      case 'update_all':
        setEntityInfo(message.focus);
        syncRoot.focus = message.focus;
        syncRoot.mapOfComponents = message.data;
        if (syncRoot.getRegistrySchema() !== undefined) syncRoot.sync();
        else requestRegistrySchema();
        break;
      case 'update_components':
        Object.entries(message.components).forEach(([typePath, value]) => {
          syncRoot.mapOfComponents[typePath] = value;
        });
        message.removed.forEach((component) => {
          delete syncRoot.mapOfComponents[component];
        });
        if (syncRoot.getRegistrySchema() !== undefined) syncRoot.sync();
        else requestRegistrySchema();
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
