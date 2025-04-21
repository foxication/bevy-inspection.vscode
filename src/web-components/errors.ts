import { BrpErrors } from '../protocol';
import { HTMLMerged } from './elements';

export class DataErrorsManager {
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

  update(errors: BrpErrors) {
    // Toggle section visibility
    if (Object.keys(errors).length > 0) this.section.style.removeProperty('display');
    else this.section.style.display = 'none';

    // Remove & Create
    this.errors.forEach((element) => element.remove());
    this.errors = [];
    let anchor = this.title as HTMLElement;
    for (const key of Object.keys(errors)) {
      const element = new HTMLMerged();
      element.label = key;
      element.tooltip =
        `TypePath: ${key}\n` + `Code: ${errors[key].code}\n` + `Contains data: ${errors[key].data !== undefined}`;
      element.brpValue = errors[key].message;
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

  private serialize(errors: BrpErrors) {
    const spaced = (s: string) => {
      const width = 45;
      return s + ' '.repeat(Math.max(width - s.length, 0));
    };
    let result = 'ERRORS:\n';
    for (const key of Object.keys(errors)) result += spaced(key) + ' ' + errors[key].message + '\n';
    return result;
  }
}
