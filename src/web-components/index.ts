import { SectionSync } from './section-sync';
import {
  BrpValue,
  BrpComponentRegistry,
  BrpRegistrySchema,
  BrpObject,
  TypePath,
  BrpResponseErrors,
} from '../protocol/types';
import { defineCustomElements } from './elements';
import { EntityFocus } from '../connection-list';
import { SectionErrors } from './section-errors';
import { SectionDetails } from './section-details';

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
    };

export type VSCodeMessage =
  | { cmd: 'debug_output' }
  | {
      cmd: 'update_all';
      focus: EntityFocus;
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
  const detailsHTML = document.querySelector('#details') as HTMLDivElement;
  if (detailsHTML === null) return console.error('#details is not found in DOM');
  const detailsSection = new SectionDetails(detailsHTML);

  const componentsHTML = document.querySelector('#component-tree') as HTMLDivElement;
  if (componentsHTML === null) return console.error('#component-tree is not found in DOM');
  const syncSection = new SectionSync(componentsHTML);

  const errorsHTML = document.querySelector('#error-list') as HTMLDListElement;
  if (errorsHTML === null) return console.error('#error-list is not found in DOM');
  const errorsSection = new SectionErrors(errorsHTML);

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    switch (message.cmd) {
      case 'debug_output':
        console.log(syncSection.debugTree());
        console.log(errorsSection.debugList());
        break;
      case 'sync_registry_schema':
        syncSection.syncRegistrySchema(message.available, message.host, message.data);
        switch (syncSection.trySync()) {
          case 'done':
            if (syncSection.focus === undefined) break;
            postWebviewMessage({
              cmd: 'ready_for_watch',
              focus: syncSection.focus,
              components: Object.keys(syncSection.mapOfComponents),
            });
            break;
          case 'no_registry_schema':
            console.error('registry schema did not load');
            break;
        }
        break;
      case 'update_all':
        setEntityInfo(message.focus);
        syncSection.focus = message.focus;
        syncSection.mapOfComponents = message.components;
        detailsSection.update(syncSection.focus);
        errorsSection.update(message.errors);
        switch (syncSection.trySync()) {
          case 'done':
            postWebviewMessage({
              cmd: 'ready_for_watch',
              focus: message.focus,
              components: Object.keys(message.components),
            });
            break;
          case 'no_registry_schema':
            postWebviewMessage({ cmd: 'request_for_registry_schema', host: message.focus.host });
            break;
        }
        break;
      case 'update_components':
        if (syncSection.focus === undefined) break;
        if (syncSection.focus.host !== message.focus.host) break;
        if (syncSection.focus.entityId !== message.focus.entityId) break;
        Object.entries(message.components).forEach(
          ([typePath, value]) => (syncSection.mapOfComponents[typePath] = value)
        );
        message.removed.forEach((component) => delete syncSection.mapOfComponents[component]);
        syncSection.trySync();
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
