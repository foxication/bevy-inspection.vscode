import { BrpResponseErrors, BrpValue, TypePath } from '../protocol/types';
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

  update(errors: BrpResponseErrors) {
    // Toggle section visibility
    if (Object.keys(errors).length > 0) this.section.style.removeProperty('display');
    else this.section.style.display = 'none';

    // Remove & Create
    Object.values(this.errors).forEach((element) => element.remove());
    this.errors = {};
    let anchor = this.title as HTMLElement;
    for (const typePath of Object.keys(errors)) {
      const element = new HTMLMerged();
      const shortPath = this.shortPath(typePath);
      element.label = shortPath;
      element.tooltip =
        `label: ${shortPath}\n` +
        `type: ${typePath}\n` +
        `code: ${errors[typePath].code}\n` +
        `with_data: ${errors[typePath].data !== undefined}`;
      element.setString(errors[typePath].message);
      element.allowValueWrapping();
      element.vscodeContext({ label: shortPath, type: typePath, errorPath: typePath });

      this.errors[typePath] = element;

      anchor.after(element);
      anchor = element;
    }

    // DebugList output
    this.serialized = this.serialize(errors);
  }

  debugList(): string {
    return this.serialized;
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

  private shortPath(typePath: TypePath): string {
    if (typePath === '') return typePath;
    const segments = typePath.split('<')[0].split('::');
    return segments[segments.length - 1];
  }
}
