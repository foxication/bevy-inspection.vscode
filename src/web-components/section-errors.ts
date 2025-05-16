import { forcedShortPath } from '../common';
import { BrpResponseError, BrpResponseErrors, BrpValue, TypePath } from '../protocol/types';
import { InformationRenderer, TreeItemVisual } from './visuals';

export class SectionErrors {
  private title: HTMLElement;
  private errors: { [typePath: TypePath]: { error: BrpResponseError; visual: TreeItemVisual } } =
    {};

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
    Object.values(this.errors).forEach((item) => item.visual.remove());
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
    const visual = TreeItemVisual.createEmpty();
    const shortPath = forcedShortPath(typePath);
    visual.extSetLabel(shortPath);
    visual.extSetTooltipFrom({
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
    visual.extVscodeContext({ label: shortPath, type: typePath, errorPath: typePath });

    // Add information
    const renderer = InformationRenderer.create();
    renderer.extSetValue(error.message);
    visual.extInsertRenderer(renderer);

    // Save access to element
    this.errors[typePath] = { error, visual: visual };

    // Insert element
    this.section.appendChild(visual);
  }

  debugList(): string {
    let result = 'ERRORS:\n';
    for (const key of Object.keys(this.errors)) result += key + '\n';
    return result;
  }
}
