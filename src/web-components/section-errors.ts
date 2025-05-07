import { forcedShortPath } from '../common';
import { BrpResponseError, BrpResponseErrors, BrpValue, TypePath } from '../protocol/types';
import { HTMLMerged } from './elements';

export class SectionErrors {
  private title: HTMLElement;
  private errors: { [typePath: TypePath]: HTMLMerged } = {};
  private serialized: string;

  constructor(private section: HTMLElement) {
    this.title = document.createElement('h3');
    this.title.textContent = 'Errors';
    this.section.append(this.title);
    this.section.style.display = 'none';
    this.serialized = this.serialize({});
  }

  getErrorMessage(typePath: TypePath): BrpValue | undefined {
    const found = this.errors[typePath] as HTMLMerged | undefined;
    if (found === undefined) return undefined;
    return found?.htmlRight?.value.buffer;
  }

  update(applyErrors: BrpResponseErrors) {
    // Clear
    if (Object.keys(applyErrors).length === 0) this.section.style.display = 'none';
    Object.values(this.errors).forEach((element) => element.remove());
    this.errors = {};

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
      sections: [
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
    this.errors[typePath] = element;

    // Insert element
    this.section.appendChild(element);
  }

  debugList(): string {
    return this.serialized; // TODO: reimplement
  }

  private serialize(errors: BrpResponseErrors) {
    const spaced = (s: string) => {
      const width = 45;
      return s + ' '.repeat(Math.max(width - s.length, 0));
    };
    let result = 'ERRORS:\n';
    for (const key of Object.keys(errors)) result += spaced(key) + ' ' + errors[key].message + '\n';
    return result;
  }
}
