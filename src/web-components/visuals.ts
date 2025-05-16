import { DataSync, ErrorData, RootOfData } from './section-components';
import { VscodeIcon } from '@vscode-elements/elements/dist/vscode-icon';
import * as VslStyles from './styles';
import { BrpSchemaUnit, TypePath } from '../protocol/types';

const EXT_BOOLEAN_NAME = 'extension-boolean';
const EXT_BUTTON_NAME = 'extension-button';
const EXT_INFO_NAME = 'extension-info';
const EXT_NULL_NAME = 'extension-null';
const EXT_NUMBER_NAME = 'extension-number';
const EXT_SELECT_NAME = 'extension-select';
const EXT_STRING_NAME = 'extension-string';
const EXT_TREE_ITEM_NAME = 'extension-tree-item';

export function defineCustomElements() {
  customElements.define(EXT_BOOLEAN_NAME, BooleanEditor);
  customElements.define(EXT_BUTTON_NAME, ButtonAsEditor);
  customElements.define(EXT_INFO_NAME, InformationRenderer);
  customElements.define(EXT_NULL_NAME, NullRenderer);
  customElements.define(EXT_NUMBER_NAME, NumberEditor);
  customElements.define(EXT_SELECT_NAME, SelectionEditor);
  customElements.define(EXT_STRING_NAME, StringEditor);
  customElements.define(EXT_TREE_ITEM_NAME, TreeItemVisual);
}

export type TooltipData = {
  label: string;
  componentPath: TypePath;
  mutationPath: string;
  schemas: BrpSchemaUnit[];
  propertiesList: { [key: string]: string }[];
};

export class TreeItemVisual extends HTMLElement {
  static extIconExpanded = 'dash';
  static extIconCollapsed = 'chevron-down';

  private extLeft: HTMLSpanElement;
  private extRight?: {
    wrapper: HTMLDivElement;
    editor?: ValueRenderer<unknown> | ValueEditor<unknown>;
    iconEnum?: VscodeIcon;
    iconExpand?: VscodeIcon;
  };

  constructor() {
    super();
    this.extLeft = document.createElement('span');
  }
  connectedCallback() {
    if (this.shadowRoot !== null) return; // already exists
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [VslStyles.merged];
    shadow.append(this.extLeft, ...(this.extRight ? [this.extRight.wrapper] : []));
    this.extReplaceRightMembers();
  }

  static createEmpty() {
    const creation = new TreeItemVisual();
    return creation;
  }
  static createWithLabel(sync: DataSync) {
    const creation = new TreeItemVisual();

    // Left side
    const label = sync.getLabelToRender();
    const types = sync.getSchema().map((schema) => schema.typePath);
    creation.extSetLevel(sync.getLevel());
    creation.extSetLabel(label);
    creation.extSetTooltipFrom(sync.getTooltip());
    creation.extVscodeContext({
      label: label,
      type: types.length === 0 ? undefined : types.join('(') + ')'.repeat(types.length - 1),
      path: sync.getPathSerialized(),
    });
    return creation;
  }
  static createFromErrorData(data: ErrorData) {
    const creation = new TreeItemVisual();

    // Left side
    const label = data.getLabelToRender();
    creation.extSetLevel(data.getLevel());
    creation.extSetLabel(label);
    creation.extSetTooltipFrom(data.getTooltip());
    creation.extVscodeContext({
      label: label,
      path: data.getPathSerialized(),
    });

    // Right side
    const renderer = InformationRenderer.create();
    renderer.extSetValue(data.message);
    creation.extInsertRenderer(renderer);

    return creation;
  }

  extSetLevel(l: number) {
    this.extLeft.style.textIndent = (l * 16).toString() + 'px';
  }
  extSetLabel(text: string) {
    this.extLeft.textContent = text;
  }
  extSetTooltipFrom(data: TooltipData | string) {
    // Simple
    if (typeof data === 'string') {
      this.extLeft.title = data;
      return;
    }

    // Label
    let result = data.label;

    // Path - if not part of serialized value
    if (data.schemas.length > 0) {
      result += '\n\n[Path]';
      result += `\ncomponentPath = ${data.componentPath}`;
      if (data.mutationPath !== '') result += `\nmutationPath = ${data.mutationPath}`;
    }

    // Schema
    let index = 0;
    function fitText(text: string, width: number) {
      return text.length > width ? text.substring(0, width) + '...' : text;
    }
    result += data.schemas
      .map(
        (schema) =>
          `\n\n${++index}: [Schema]` +
          Object.entries(schema)
            .map(([key, value]) => '\n' + key + ' = ' + fitText(value, 50))
            .join('')
      )
      .join('');

    // More in properties
    result += data.propertiesList
      .map(
        (properties) =>
          `\n\n${++index}: [Properties]` +
          Object.entries(properties)
            .map(([key, value]) => '\n' + key + ' = ' + fitText(value, 50))
            .join('')
      )
      .join('');

    // Apply
    this.extLeft.title = result;
  }
  private extCreateRightWrapper(): HTMLDivElement {
    const result = document.createElement('div');
    result.classList.add('right-side');
    return result;
  }
  private extReplaceRightMembers() {
    if (this.extRight === undefined) return;
    this.shadowRoot?.replaceChildren(this.extLeft, this.extRight.wrapper);
    this.extRight.wrapper.replaceChildren(
      ...[this.extRight.editor, this.extRight.iconEnum, this.extRight.iconExpand].filter(
        (element) => element !== undefined
      )
    );
  }
  extVscodeContext(data: { [key: string]: string | undefined }) {
    const result: { [key: string]: string } = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) result[key] = value;
    });
    this.setAttribute('data-vscode-context', JSON.stringify(data));
  }
  extInsertRenderer<T>(renderer: ValueRenderer<T>) {
    // Initialize
    this.extRight = {
      wrapper: this.extCreateRightWrapper(),
      editor: renderer,
    };

    // Styles
    this.extRight.wrapper.classList.add('right-side-extend');

    // Structurize
    this.extReplaceRightMembers();
  }
  extInsertEditor<T>(editor: ValueEditor<T>) {
    // Initialize
    this.extRight = {
      wrapper: this.extCreateRightWrapper(),
      editor: editor,
    };

    // Styles
    this.extRight.wrapper.classList.add('right-side-extend');

    // Structurize
    this.extReplaceRightMembers();
  }
  extEnableExpansibility(sync: RootOfData) {
    // create element
    this.extRight?.iconExpand?.remove();
    if (this.extRight === undefined) this.extRight = { wrapper: this.extCreateRightWrapper() };
    this.extRight.iconExpand = this.createChevron();
    this.extReplaceRightMembers();

    this.extShowChildren = (forced: boolean) => {
      if (forced || this.extGetExpansionState() === 'expanded') {
        sync.children.forEach((child) => {
          if (child.visual instanceof TreeItemVisual) child.visual.extShow();
        });
      }
    };
    this.extHideChildren = () => {
      sync.children.forEach((child) => {
        if (child.visual instanceof TreeItemVisual) child.visual.extHide();
      });
    };

    // implement
    this.onclick = () => {
      if (this.extRight?.iconExpand === undefined) return; // skip - no children
      switch (this.extGetExpansionState()) {
        case 'expanded':
          this.extRight.iconExpand.setAttribute('name', TreeItemVisual.extIconCollapsed);
          if (this.extHideChildren !== undefined) this.extHideChildren();
          break;
        case 'disabled':
        case 'collapsed':
          this.extRight.iconExpand.setAttribute('name', TreeItemVisual.extIconExpanded);
          if (this.extShowChildren !== undefined) this.extShowChildren(true);
          break;
      }
    };
  }
  extRemoveExpansibility() {
    if (this.extRight?.iconExpand === undefined) return;

    this.onclick = () => {};
    this.extShowChildren = () => {};
    this.extHideChildren = () => {};
    this.extRight.iconExpand = undefined;
    this.extReplaceRightMembers();
  }
  extGetExpansionState(): 'expanded' | 'collapsed' | 'disabled' {
    if (this.extRight?.iconExpand === undefined) return 'disabled';
    const state = this.extRight?.iconExpand.getAttribute('name');
    if (state === TreeItemVisual.extIconExpanded) return 'expanded';
    if (state === TreeItemVisual.extIconCollapsed) return 'collapsed';
    return 'expanded';
  }
  extGetIsExpandable() {
    return this.extRight?.iconExpand !== undefined;
  }
  private createChevron() {
    const chevron = document.createElement('vscode-icon');
    chevron.setAttribute('name', TreeItemVisual.extIconExpanded);
    chevron.setAttribute('class', 'rotatable');
    return chevron;
  }
  extShow() {
    this.style.removeProperty('display');
    if (this.extShowChildren !== undefined) this.extShowChildren(false);
  }
  extHide() {
    this.style.display = 'none';
    if (this.extHideChildren !== undefined) this.extHideChildren();
  }
  extShowChildren: undefined | ((forced: boolean) => void) = undefined;
  extHideChildren: undefined | (() => void) = undefined;
}

//
// Value Rendering
//

abstract class ValueRenderer<T> extends HTMLElement {
  private extValue: T;

  constructor(defaultValue: T) {
    super();
    this.extValue = defaultValue;
  }
  connectedCallback() {
    if (this.shadowRoot !== null) return; // skip if already exists

    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = this.extStyles;
    shadow.append(this.extInternal);
  }
  extGetValue(): T {
    return this.extValue;
  }
  extSetValue(v: T): void {
    this.extValue = v;
    this.extRenderOnValueChanged();
  }

  abstract extStyles: CSSStyleSheet[];
  abstract extInternal: HTMLElement;
  abstract extRenderOnValueChanged(): void;
}

export class InformationRenderer extends ValueRenderer<string> {
  extStyles = [VslStyles.editableText];
  extInternal: HTMLDivElement;

  static create() {
    return document.createElement(EXT_INFO_NAME) as InformationRenderer;
  }

  constructor() {
    super('');
    this.extInternal = document.createElement('div');
    this.extInternal.innerText = '';
    this.extInternal.style.textWrap = 'wrap';
    this.extInternal.style.wordBreak = 'break-all'; // TODO - move it to styles
  }

  extRenderOnValueChanged(): void {
    this.extInternal.innerText = this.extGetValue();
  }
}

export class NullRenderer extends ValueRenderer<null> {
  extStyles = [VslStyles.editableText];
  extInternal: HTMLDivElement;

  static create() {
    return document.createElement(EXT_NULL_NAME) as NullRenderer;
  }

  constructor() {
    super(null);
    this.extInternal = document.createElement('div');
    this.extInternal.innerText = 'Null';
  }

  extRenderOnValueChanged(): void {}
}

//
// Value Editing
//

abstract class ValueEditor<T> extends ValueRenderer<T> {
  private extMutability: ((v: T) => void) | undefined;

  constructor(defaultValue: T) {
    super(defaultValue);
  }

  extAllowMutation(callback: (v: T) => void) {
    this.extMutability = callback;
  }
  extTryMutation(v: T) {
    if (this.extMutability === undefined) return;
    this.extMutability(v);
  }
}

export class NumberEditor extends ValueEditor<number> {
  extStyles = [VslStyles.editableText];
  extInternal: HTMLDivElement;
  private extInEditMode: boolean = false;

  static create() {
    return document.createElement(EXT_NUMBER_NAME) as NumberEditor;
  }

  constructor() {
    super(0);
    this.extInternal = document.createElement('div');
    this.extInternal.contentEditable = 'plaintext-only';

    // Interactions
    this.extInternal.onfocus = () => {
      this.extInEditMode = true;
      this.setAttribute('focused', '');
    };
    this.extInternal.onkeydown = (e) => {
      // unfocus without changes
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.extRenderOnValueChanged();
        this.extInternal.blur();
        e.preventDefault();
      }

      // apply changes
      if (!(e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        try {
          const parsed = JSON.parse(this.extInternal.innerText);
          this.extTryMutation(parsed);
        } catch {
          console.error(`Error in parsing brpValue`);
        }
        this.extInternal.blur();
      }
    };
    this.extInternal.onblur = () => {
      this.extInEditMode = false;
      this.extRenderOnValueChanged();
      this.extInternal.scrollTo(0, 0);
      this.removeAttribute('focused');
    };
  }
  extRenderOnValueChanged() {
    if (!this.extInEditMode) this.extInternal.innerText = this.extGetValue().toString();
  }
}

export class StringEditor extends ValueEditor<string> {
  extStyles = [VslStyles.editableText];
  extInternal: HTMLDivElement;
  private extInEditMode: boolean = false;

  static create() {
    return document.createElement(EXT_STRING_NAME) as StringEditor;
  }

  constructor() {
    super('');
    this.extInternal = document.createElement('div');
    this.extInternal.contentEditable = 'plaintext-only';

    // Interactions
    this.extInternal.onfocus = () => {
      this.extInEditMode = true;
      this.setAttribute('focused', '');
    };
    this.extInternal.onkeydown = (e) => {
      // unfocus without changes
      if (e.key === 'Escape' || e.key === 'Esc') {
        this.extRenderOnValueChanged();
        this.extInternal.blur();
        e.preventDefault();
      }

      // apply changes
      if (!(e.shiftKey || e.ctrlKey) && e.key === 'Enter') {
        try {
          // remove last newline as contentEditable mode gives unpredictable results
          this.extTryMutation(this.extInternal.innerText.trimEnd());
        } catch {
          /* empty */
        }
        this.extInternal.blur();
      }
    };
    this.extInternal.onblur = () => {
      this.extInEditMode = false;
      this.extInternal.innerText = this.extGetValue();
      this.extInternal.scrollTo(0, 0);
      this.removeAttribute('focused');
    };
  }

  extRenderOnValueChanged() {
    if (!this.extInEditMode) this.extInternal.innerText = this.extGetValue();
  }
}

export class BooleanEditor extends ValueEditor<boolean> {
  extStyles = [VslStyles.editableText];
  extInternal: HTMLDivElement;

  static create() {
    return document.createElement(EXT_BOOLEAN_NAME) as BooleanEditor;
  }

  constructor() {
    super(false);
    this.extInternal = document.createElement('div');

    this.extInternal.onclick = () => {
      this.extTryMutation(!this.extGetValue());
    };
  }

  extRenderOnValueChanged() {
    this.extInternal.innerText = this.extGetValue() ? 'True' : 'False';
  }
}

export class SelectionEditor extends ValueEditor<string> {
  extStyles = [VslStyles.select];
  extInternal: HTMLSelectElement;

  // private selectedVariant: HTMLOptionElement;
  private extAvailableVariants: { [variant: string]: HTMLOptionElement };

  static create() {
    return document.createElement(EXT_SELECT_NAME) as SelectionEditor;
  }

  constructor() {
    const defaultVariantValue = 'unknown';
    super(defaultVariantValue);

    const defaultVariant = document.createElement('option');
    defaultVariant.value = defaultVariantValue;
    defaultVariant.textContent = defaultVariantValue;
    this.extAvailableVariants = { [defaultVariantValue]: defaultVariant };

    this.extInternal = document.createElement('select');
    this.extInternal.replaceChildren(defaultVariant);
    this.extInternal.onchange = () => {
      this.extTryMutation(this.extInternal.value);
    };
  }

  extRenderOnValueChanged() {
    const selection = this.extGetValue();
    if (!Object.keys(this.extAvailableVariants).includes(selection)) {
      return console.error(`No such variant in available`);
    }
    this.extInternal.innerText = this.extGetValue();
  }
  setAvailable(available: string[], selection?: string) {
    if (available.length < 1) return console.error(`Cannot set empty variants`);
    this.extAvailableVariants = available.reduce((acc, variant) => {
      const element = document.createElement('option');
      element.value = variant;
      element.textContent = variant;
      acc[variant] = element;
      return acc;
    }, {} as typeof this.extAvailableVariants);
    this.extInternal.replaceChildren(...Object.values(this.extAvailableVariants));
    this.extSetValue(selection ?? available[0]);
  }
  getAvailable() {
    return Object.keys(this.extAvailableVariants);
  }
}

export class ButtonAsEditor extends ValueEditor<undefined> {
  extStyles = [VslStyles.editableText];
  extInternal: HTMLDivElement;

  static create() {
    return document.createElement(EXT_BUTTON_NAME) as ButtonAsEditor;
  }

  constructor() {
    super(undefined);
    this.extInternal = document.createElement('div');
    this.extInternal.innerText = 'Unknown';
    this.extInternal.onclick = () => {
      this.extTryMutation(undefined);
    };
  }

  extRenderOnValueChanged() {}

  extSetActionTitle(title: string) {
    this.extInternal.innerText = title;
  }
}
