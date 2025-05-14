import { forcedShortPath } from '../common';
import { BrpResponseError, BrpResponseErrors, BrpValue, TypePath } from '../protocol/types';
import { HTMLMerged } from './elements';

export class SectionErrors {
  private title: HTMLElement;
  private errors: { [typePath: TypePath]: { error: BrpResponseError; html: HTMLMerged } } = {};

  constructor(private section: HTMLElement) {
    this.title = document.createElement('h3');
    this.title.textContent = 'Errors';
    this.section.append(this.title);
    this.section.style.display = 'none';
  }

  getErrorMessage(typePath: TypePath): BrpValue | undefined {
    return (Object.keys(this.errors).includes(typePath) ? this.errors[typePath] : undefined)?.error
      .message;
  }

  update(applyErrors: BrpResponseErrors) {
    // Clear
    Object.values(this.errors).forEach((item) => item.html.remove());
    this.errors = {};

    // Set section visibility
    if (Object.keys(applyErrors).length === 0) this.section.style.display = 'none';

    // Update
    for (const [typePath, error] of Object.entries(applyErrors)) this.push(typePath, error);
  }

  push(typePath: TypePath, error: BrpResponseError) {
    // Update visibility of section
    this.section.style.removeProperty('display');

    // Create element
    const element = new HTMLMerged();
    const shortPath = forcedShortPath(typePath);
    element.label = shortPath;
    element.setTooltipFrom({
      label: shortPath,
      componentPath: typePath,
      mutationPath: '',
      schemas: [],
      propertiesList: [
        {
          component: typePath,
          code: error.code.toString(),
          hasData: `${error.data !== undefined}`,
        },
      ],
    });
    element.setValue(error.message);
    element.allowValueWrapping();
    element.vscodeContext({ label: shortPath, type: typePath, errorPath: typePath });

    // Save access to element
    this.errors[typePath] = { error, html: element };

    // Insert element
    this.section.appendChild(element);
  }

  debugList(): string {
    let result = 'ERRORS:\n';
    for (const key of Object.keys(this.errors)) result += key + '\n';
    return result;
  }
}
