import { BrpRegistrySchema, BrpObject, isBrpIterable } from '../protocol/types';
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

  // buffer
  let buffer: { focus: EntityFocus; data: BrpObject } | undefined = undefined;
  const registryBuffer: Map<string, BrpRegistrySchema> = new Map();

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
        if (buffer === undefined) break;

        // Success
        syncRoot.syncRoot(message.data, buffer.focus, buffer.data);
        postWebviewMessage({
          cmd: 'ready_for_watch',
          focus: buffer.focus,
          components: Object.keys(buffer.data),
        });
        break;
      }
      case 'update_all': {
        // Buffer
        buffer = { focus: EntityFocus.fromObject(message.focus), data: message.components };

        // Details
        detailsSection.update(buffer.focus);

        // Components
        const registry = registryBuffer.get(message.focus.host);
        if (registry !== undefined) {
          syncRoot.syncRoot(registry, buffer.focus, buffer.data);
          postWebviewMessage({
            cmd: 'ready_for_watch',
            focus: buffer.focus,
            components: Object.keys(buffer.data),
          });
        } else {
          postWebviewMessage({ cmd: 'request_for_registry_schema', host: message.focus.host });
        }

        // Errors
        errorsSection.update(message.errors);
        break;
      }
      case 'update_components': {
        // Checks
        if (syncRoot.getFocus()?.compare(EntityFocus.fromObject(message.focus)) !== true) break;

        // Apply changes
        for (const [typePath, value] of Object.entries(message.components)) {
          syncRoot.syncComponent(typePath, value);
        }
        for (const typePath of message.removed) {
          syncRoot.removeComponent(typePath);
        }
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
