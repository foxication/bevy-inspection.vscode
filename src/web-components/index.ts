import { BrpRegistrySchema, isBrpIterable } from '../protocol/types';
import { defineCustomElements } from './elements';
import { EntityFocus, VSCodeMessage, WebviewMessage } from '../common';
import { SectionErrors } from './section-errors';
import { SectionDetails } from './section-details';
import { ComponentListData } from './section-components';

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
  const syncRoot = new ComponentListData(componentsHTML);

  const errorsHTML = document.querySelector('#error-list') as HTMLDListElement;
  if (errorsHTML === null) return console.error('#error-list is not found in DOM');
  const errorsSection = new SectionErrors(errorsHTML);

  const onStartHTML = document.querySelector('#start-information') as HTMLDListElement;
  if (onStartHTML === null) return console.error('#start-information is not found in DOM');

  // Configure manual update
  detailsSection.onManualUpdate = () => {
    const focus = syncRoot.getFocus();
    if (focus === undefined) return;
    postWebviewMessage({ cmd: 'request_for_component_changes', focus });
  };

  // Registry schemas
  const registryBuffer: Map<string, BrpRegistrySchema> = new Map();
  let afterRegistryAvailable: (registry: BrpRegistrySchema) => void = () => {};

  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data as VSCodeMessage;
    switch (message.cmd) {
      case 'debug_output':
        console.log(syncRoot.getDebugTree());
        console.log(errorsSection.debugList());
        break;
      case 'sync_registry_schema': {
        [...registryBuffer.keys()]
          .filter((host) => !message.available.includes(host))
          .forEach((host) => {
            registryBuffer.delete(host);
          });
        registryBuffer.set(message.host, message.data);

        // Success
        afterRegistryAvailable(message.data);
        break;
      }
      case 'update_all': {
        const focus = EntityFocus.fromObject(message.focus);

        // Details
        detailsSection.update(focus, 'online');

        // Start watch (function to call)
        afterRegistryAvailable = (registry) => {
          syncRoot.switchFocus(registry, focus);
          postWebviewMessage({
            cmd: 'request_for_component_changes',
            focus: focus.toObject(),
          });
          afterRegistryAvailable = () => {};
        };

        // Start watch
        const registry = registryBuffer.get(message.focus.host);
        if (registry !== undefined) {
          afterRegistryAvailable(registry);
        } else {
          postWebviewMessage({ cmd: 'request_for_registry_schema', host: message.focus.host });
        }

        // Errors
        errorsSection.update({});

        // Start Information
        onStartHTML.style.display = 'none';
        break;
      }
      case 'update_all_offline': {
        const focus = EntityFocus.fromObject(message.focus);

        // Details
        detailsSection.update(focus, 'offline');

        // Components + Errors
        if (syncRoot.getFocus()?.compare(focus) !== true) {
          syncRoot.switchFocus({}, focus, true);
          errorsSection.update({});
        }

        // Start Information
        onStartHTML.style.display = 'none';
        break;
      }
      case 'update_components': {
        if (syncRoot.getFocus()?.compare(EntityFocus.fromObject(message.focus)) !== true) break;

        // Remove components
        syncRoot
          .getComponentList()
          .filter((typePath) => !message.list.includes(typePath))
          .forEach((typePath) => syncRoot.removeComponent(typePath));

        // Apply component changes
        syncRoot.insertComponents(message.changes);

        // Add errors
        Object.entries(message.errors).forEach(([typePath, value]) =>
          errorsSection.push(typePath, value)
        );

        // Continue watch
        if (detailsSection.getUpdateMode() === 'Manual') break;
        setTimeout(() => {
          if (syncRoot.getFocus()?.compare(EntityFocus.fromObject(message.focus)) === true) {
            postWebviewMessage({ cmd: 'request_for_component_changes', focus: message.focus });
          }
        }, detailsSection.getInterval());
        break;
      }
      case 'copy_error_message_to_clipboard': {
        const result = errorsSection.getErrorMessage(message.component)?.toString();
        if (result !== undefined) postWebviewMessage({ cmd: 'write_clipboard', text: result });
        else console.error(`Error message is not found: ${message.component}`);
        break;
      }
      case 'copy_value_to_clipboard': {
        const parsedPath = message.path.split('.').map((segment) => {
          if (/^\d+$/.test(segment)) return parseInt(segment);
          return segment;
        });
        const result = syncRoot.getByPath(parsedPath)?.getValue();
        switch (true) {
          case result === undefined:
            console.error(`Value is not found: ${message.path}`);
            break;
          case result === null:
            postWebviewMessage({ cmd: 'write_clipboard', text: 'null' });
            break;
          case result !== undefined && isBrpIterable(result):
            postWebviewMessage({ cmd: 'write_clipboard', text: JSON.stringify(result) });
            break;
          default:
            postWebviewMessage({ cmd: 'write_clipboard', text: result.toString() });
            break;
        }
        break;
      }
    }
  });
})();
