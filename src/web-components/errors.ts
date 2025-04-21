import { BrpResponseErrors, TypePath } from '../protocol';
import { HTMLMerged } from './elements';

export class ErrorList {
  private title: HTMLElement;
  private errors: HTMLMerged[] = [];
  private serialized: string;

  constructor(private section: HTMLElement) {
    this.title = document.createElement('h3');
    this.title.textContent = 'Errors';
    this.section.append(this.title);
    this.section.style.display = 'none';
    this.serialized = this.serialize({});
  }

  update(errors: BrpResponseErrors) {
    // Toggle section visibility
    if (Object.keys(errors).length > 0) this.section.style.removeProperty('display');
    else this.section.style.display = 'none';

    // Remove & Create
    this.errors.forEach((element) => element.remove());
    this.errors = [];
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
      element.brpValue = errors[typePath].message;
      element.allowValueWrapping();

      this.errors.push(element);

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
