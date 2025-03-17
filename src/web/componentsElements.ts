import * as extStyles from './componentsStyles';
import { entityData, onEntityDataChange } from './components';
import { labelFromPath } from './lib';
import { BrpValue } from 'bevy-remote-protocol';

// Initialization
export function initExtElements() {
  customElements.define('ext-expandable', ExtExpandable);
  customElements.define('ext-declaration', ExtDeclaration);
  customElements.define('ext-string', ExtString);
  customElements.define('ext-number', ExtNumber);
  customElements.define('ext-boolean', ExtBoolean);
  customElements.define('ext-gripper', ExtGripper);
}

// ExtElements
class ExtExpandableContent extends HTMLDivElement {
  onReorder = () => {};
}
class ExtExpandable extends HTMLElement {
  content = document.createElement('div') as ExtExpandableContent;

  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const label = this.getAttribute('label') ?? '';
    const readableLabel = label.replace(/::/g, ' :: ');
    const isComponent = this.hasAttribute('component');
    const isIndexed = this.hasAttribute('indexed');
    const arrayRoot = this.getAttribute('array');
    const indent = parseInt(this.parentElement?.getAttribute('indent') ?? '-28') + 22;

    // Detials.summary.indent
    const indentation = () => {
      const element = document.createElement('div');
      element.style.width = indent.toString() + 'px';
      element.classList.add('indent');
      return element;
    };

    // Detials.summary.chevron
    const chevron = document.createElement('vscode-icon');
    chevron.setAttribute('name', 'chevron-right');
    chevron.setAttribute('class', 'rotatable');

    // Detials.summary.label
    const labelElement = document.createElement('span');
    labelElement.textContent = readableLabel ?? '';

    // Details.summary.icon
    const icon = () => {
      const element = document.createElement('vscode-icon');
      element.setAttribute('name', 'symbol-method');
      element.setAttribute('class', 'component-type-icon');
      return element;
    };

    // Details.summary.space
    const space = document.createElement('div');
    space.classList.add('space');

    // Details.summary.buttons.remove
    const removeIcon = document.createElement('vscode-icon');
    removeIcon.setAttribute('name', 'trash');
    const removeButton = document.createElement('button');
    removeButton.appendChild(removeIcon);
    removeButton.classList.add('autohide');
    removeButton.tabIndex = -1;

    // Details.summary.buttons.append
    const appendIcon = document.createElement('vscode-icon');
    appendIcon.setAttribute('name', 'expand-all');
    const appendButton = document.createElement('button');
    appendButton.appendChild(appendIcon);
    appendButton.classList.add('autohide');
    appendButton.tabIndex = -1;

    // Details.summary.buttons.gripper
    const gripper = document.createElement('ext-gripper') as ExtGripper;
    gripper.indexed = this;

    // Details.summary.buttons
    const buttons = document.createElement('div');
    buttons.classList.add('buttons');
    if (arrayRoot !== null) buttons.appendChild(appendButton);
    if (isIndexed) buttons.appendChild(removeButton);
    if (isIndexed) buttons.appendChild(gripper);

    // Detials.summary
    const summary = document.createElement('summary');
    if (indent >= 0) summary.append(indentation());
    summary.appendChild(chevron);
    if (isComponent) summary.appendChild(icon());
    summary.appendChild(labelElement);
    summary.appendChild(space);
    summary.appendChild(buttons);

    // Detials.content
    this.content.setAttribute('class', 'details-content');
    this.content.setAttribute('indent', indent.toString());
    this.content.innerHTML = this.innerHTML;
    if (arrayRoot !== null) {
      this.content.onReorder = () => {
        console.log('reorder is called');
        this.onReorder(arrayRoot);
      };
    }

    // Detials
    const details = document.createElement('details');
    details.setAttribute('open', '');
    details.appendChild(summary);
    details.appendChild(this.content);

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.expandable];
    shadow.appendChild(details);
  }
  public onReorder(root: string) {
    let index = 0;
    for (const child of this.content.children) {
      if (child instanceof ExtExpandable) console.error(`not implemented`);
      if (child instanceof ExtDeclaration) child.changePath(root, index);
      index += 1;
    }
  }
}
class ExtDeclaration extends HTMLElement {
  label = document.createElement('label') as HTMLElement;
  value: ExtValue | undefined;

  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const path = this.getAttribute('path') ?? '';
    const hideLabel = this.hasAttribute('hide-label');
    const isIndexed = this.hasAttribute('indexed');

    // Initialize elements
    const background = document.createElement('div');
    background.classList.add('background');

    this.label.setAttribute('for', path);
    this.label.textContent = hideLabel ? '' : labelFromPath(path);

    const valueHolder = document.createElement('div');
    valueHolder.classList.add('value');

    // Details.summary.buttons.remove
    const removeIcon = document.createElement('vscode-icon');
    removeIcon.setAttribute('name', 'trash');
    const removeButton = document.createElement('button');
    removeButton.appendChild(removeIcon);
    removeButton.classList.add('compact-tall');
    removeButton.tabIndex = -1;

    const gripper = document.createElement('ext-gripper') as ExtGripper;
    gripper.indexed = this;

    switch (typeof entityData.get(path)) {
      case 'number': {
        this.value = document.createElement('ext-number') as ExtNumber;
        this.value.id = path;
        valueHolder.appendChild(this.value);
        break;
      }

      case 'boolean': {
        this.value = document.createElement('ext-boolean') as ExtBoolean;
        this.value.id = path;
        valueHolder.appendChild(this.value);
        break;
      }

      case 'string': {
        this.value = document.createElement('ext-string') as ExtString;
        this.value.id = path;
        valueHolder.appendChild(this.value);
        break;
      }

      default: {
        this.value = document.createElement('ext-string') as ExtString;
        this.value.id = path;
        this.value.setAttribute('disabled', '');
        valueHolder.appendChild(this.value);
      }
    }
    if (isIndexed) valueHolder.appendChild(removeButton);
    if (isIndexed) valueHolder.appendChild(gripper);

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.declaration];
    shadow.appendChild(background);
    shadow.appendChild(this.label);
    shadow.appendChild(valueHolder);
  }
  changePath(root: string, index: number) {
    const path = root + '.' + index;

    // Skip conditions
    if (this.value === undefined) return;
    if (this.getAttribute('path') === path) return;

    // Apply
    this.setAttribute('path', path);
    if (this.label.textContent !== '') this.label.textContent = index.toString();
    this.value.changePath(path);
  }
}
class ExtValue extends HTMLElement {
  lastValue: BrpValue = null;

  get value(): BrpValue {
    if (!entityData.has(this.id)) console.error(`${this.id} => this path not in table`);
    this.lastValue = entityData.get(this.id) ?? null;
    return this.lastValue;
  }

  set value(v: BrpValue) {
    if (!entityData.has(this.id)) {
      console.error(`${this.id} => this path not in table`);
      return;
    }
    const previous = entityData.get(this.id);
    if (typeof v !== typeof previous) {
      console.error(`${this.id} => types of newValue and oldValue don't match`);
      return;
    }
    if (typeof v === 'number' && !Number.isFinite(v)) {
      console.error(`${this.id} => number is not finite`);
      return;
    }
    this.lastValue = v;
    entityData.set(this.id, v);
    if (previous !== v) onEntityDataChange(this.id);
  }
  changePath(path: string) {
    const previous = entityData.get(path);
    if (previous === undefined) {
      console.error(`${path} doesn't exist on table`);
      return;
    }
    this.id = path;
    entityData.set(path, this.lastValue);
    if (previous !== this.lastValue) onEntityDataChange(path);
    else console.log(`${path} without changes`);
  }
}
class ExtString extends ExtValue {
  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const placeholder = this.getAttribute('placeholder');
    const isDisabled = this.hasAttribute('disabled');

    // Initialize field input
    const field = document.createElement('input');
    field.setAttribute('type', 'text');
    field.setAttribute('placeholder', placeholder ?? '');
    if (isDisabled) field.setAttribute('disabled', '');

    // Initialize area input
    const area = document.createElement('textarea');
    if (isDisabled) area.setAttribute('disabled', '');
    area.setAttribute('rows', '5');

    // Initialize buttons
    const toArea = document.createElement('button');
    toArea.classList.add('inside');
    toArea.tabIndex = -1;
    const iconArea = document.createElement('vscode-icon');
    iconArea.setAttribute('name', 'list-selection');
    toArea.appendChild(iconArea);

    const toField = document.createElement('button');
    toField.classList.add('inArea');
    toField.classList.add('inside');
    toField.tabIndex = -1;
    const iconField = document.createElement('vscode-icon');
    iconField.setAttribute('name', 'symbol-string');
    toField.appendChild(iconField);

    const buttonCollection = document.createElement('div');
    buttonCollection.classList.add('button-collection');
    buttonCollection.classList.add('autohide');
    buttonCollection.appendChild(toArea);
    buttonCollection.appendChild(toField);

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.input, extStyles.textArea];

    shadow.appendChild(area);
    shadow.appendChild(field);
    if (!isDisabled) shadow.appendChild(buttonCollection);

    // Switchers
    toArea.onclick = () => {
      area.value = (this.value as string) ?? 'NULL';

      area.style.removeProperty('display');
      toField.style.removeProperty('display');
      field.style.display = 'none';
      toArea.style.display = 'none';
    };
    toField.onclick = () => {
      field.value = (this.value as string) ?? 'NULL';

      area.style.display = 'none';
      toField.style.display = 'none';
      field.style.removeProperty('display');
      toArea.style.removeProperty('display');
    };

    // Set initial mode
    if (((this.value as string) ?? '').indexOf('\n') > -1) {
      toArea.onclick(new MouseEvent(''));
    } else {
      toField.onclick(new MouseEvent(''));
    }

    // Logics of area
    area.oninput = () => {
      area.style.height = 'auto';
      area.style.height = area.scrollHeight + 'px';
    };
    area.onfocus = () => {
      this.setAttribute('focused', '');
    };
    area.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        area.value = this.value as string;
        area.blur();
        e.preventDefault();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        area.blur();
      }
    };
    area.onchange = () => {
      this.value = area.value;
      area.blur();
    };
    area.onblur = () => {
      area.value = this.value as string;
      area.scrollTo(0, 0);
      this.removeAttribute('focused');
    };

    // Logics of field
    field.onfocus = () => {
      this.setAttribute('focused', '');
    };
    field.onkeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        field.value = this.value as string;
        field.blur();
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        field.blur();
      }
    };
    field.onchange = () => {
      this.value = field.value;
      field.blur();
    };
    field.onblur = () => {
      field.value = this.value as string;
      this.removeAttribute('focused');
    };
  }
}
class ExtNumber extends ExtValue {
  getValueAsView() {
    return (this.value as number).toString();
  }

  getValueAsEdit() {
    return (this.value as number).toLocaleString(undefined, {
      style: 'decimal',
      useGrouping: false,
      maximumFractionDigits: 30,
    });
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const isDisabled = this.hasAttribute('disabled');

    // Initialize elements
    const decreaseButton = document.createElement('button');
    decreaseButton.classList.add('inside-compact');
    decreaseButton.classList.add('autohide');
    decreaseButton.tabIndex = -1;
    const decreaseIcon = document.createElement('vscode-icon');
    decreaseIcon.setAttribute('name', 'chevron-left');
    decreaseButton.appendChild(decreaseIcon);

    const increaseButton = document.createElement('button');
    increaseButton.classList.add('inside-compact');
    increaseButton.classList.add('autohide');
    increaseButton.tabIndex = -1;
    const increaseIcon = document.createElement('vscode-icon');
    increaseIcon.setAttribute('name', 'chevron-right');
    increaseButton.appendChild(increaseIcon);

    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.classList.add('centered');
    input.classList.add('wider');
    if (isDisabled) input.setAttribute('disabled', '');
    input.value = (this.value as number).toString();

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.input];
    if (!isDisabled) shadow.appendChild(decreaseButton);
    shadow.appendChild(input);
    if (!isDisabled) shadow.appendChild(increaseButton);

    // Logics of buttons
    decreaseButton.onclick = () => {
      this.value = (this.value as number) - 1;
      input.value = this.getValueAsView();
    };
    increaseButton.onclick = () => {
      this.value = (this.value as number) + 1;
      input.value = this.getValueAsView();
    };

    // Logics of input
    input.onfocus = () => {
      input.value = this.getValueAsEdit();
      this.setAttribute('focused', '');
    };
    input.onkeydown = (e) => {
      if (!('key' in e)) {
        return;
      }
      if (e.key === 'Escape' || e.key === 'Esc') {
        input.value = this.getValueAsView();
        input.blur();
        e.preventDefault();
      }
      if (e.key === 'Enter') {
        input.blur();
      }
    };
    input.onchange = () => {
      this.value = parseFloat(input.value);
      input.blur();
    };
    input.onblur = () => {
      input.value = this.getValueAsView();
      this.removeAttribute('focused');
    };
  }
}
class ExtBoolean extends ExtValue {
  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const isDisabled = this.hasAttribute('disabled');

    // Initialize elements
    const checkbox = document.createElement('vscode-checkbox');
    if (isDisabled) checkbox.setAttribute('disabled', '');
    if (this.value) {
      checkbox.setAttribute('checked', '');
    }

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.hostIsContent, extStyles.wideCheckbox];
    shadow.appendChild(checkbox);

    // Logics
    const observer = new MutationObserver(() => {
      this.value = checkbox.hasAttribute('checked');
    });
    observer.observe(checkbox, { attributes: true, attributeFilter: ['checked'] });
  }
}
class ExtGripper extends HTMLElement {
  private button = document.createElement('button');

  public set indexed(draggable: HTMLElement) {
    const list = draggable.parentElement as ExtExpandableContent;
    if (list === null) return;

    // Constants
    const gap = 4; // px

    // Logics
    this.button.onpointerdown = (eventDown) => {
      this.button.setPointerCapture(eventDown.pointerId);
      draggable.style.zIndex = '1';
      draggable.setAttribute('dragging', '');

      const initialClientY = eventDown.clientY;
      const minOffset = -draggable.offsetTop;
      const maxOffset = minOffset + list.offsetHeight - draggable.offsetHeight;

      let insertAfter: HTMLElement | null = draggable.previousElementSibling as HTMLElement;
      let insertBefore: HTMLElement | null = draggable.nextElementSibling as HTMLElement;
      let elementOffset = 0;

      this.button.onpointermove = (eventMove) => {
        const position = (): number => {
          return Math.min(Math.max(eventMove.clientY - initialClientY, minOffset), maxOffset);
        };
        const moveBackTrigger = () => {
          if (insertAfter === null) return 0;
          return -(insertAfter.offsetHeight + gap);
        };
        const moveForwTrigger = () => {
          if (insertBefore === null) return 0;
          return insertBefore.offsetHeight + gap;
        };

        let change: 'back' | 'none' | 'forward' = 'none';
        if (insertAfter instanceof HTMLElement && position() <= elementOffset + moveBackTrigger() * 0.75) {
          elementOffset += moveBackTrigger();
          [insertAfter, insertBefore] = [insertAfter.previousElementSibling as HTMLElement, insertAfter];
          if (insertAfter === draggable) insertAfter = draggable.previousElementSibling as HTMLElement;
          change = 'back';
        }
        if (insertBefore instanceof HTMLElement && position() >= elementOffset + moveForwTrigger() * 0.75) {
          elementOffset += moveForwTrigger();
          [insertAfter, insertBefore] = [insertBefore, insertBefore.nextElementSibling as HTMLElement];
          if (insertBefore === draggable) insertBefore = draggable.nextElementSibling as HTMLElement;
          change = 'forward';
        }
        if (elementOffset < 0 && change === 'back' && insertBefore instanceof HTMLElement) {
          insertBefore.style.top = (draggable.offsetHeight + gap).toString() + 'px';
        }
        if (elementOffset > 0 && change === 'forward' && insertAfter instanceof HTMLElement) {
          insertAfter.style.top = (-draggable.offsetHeight - gap).toString() + 'px';
        }
        if (elementOffset <= 0 && change === 'forward') {
          insertAfter?.style.removeProperty('top');
        }
        if (elementOffset >= 0 && change === 'back') {
          insertBefore?.style.removeProperty('top');
        }
        draggable.style.top = position() + 'px';
      };

      this.button.onpointerup = () => {
        this.button.onpointermove = null;
        this.button.onpointerup = null;

        draggable.style.removeProperty('top');
        draggable.style.removeProperty('z-index');
        draggable.removeAttribute('dragging');

        if (elementOffset === 0) return;
        for (const child of list.children) (child as HTMLElement)?.style.removeProperty('top');
        if (insertBefore instanceof HTMLElement) insertBefore.before(draggable);
        else list.appendChild(draggable);
        list.onReorder();
      };
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;

    // Initialize elements
    this.button.classList.add('compact-tall');
    this.button.tabIndex = -1;

    const icon = document.createElement('vscode-icon');
    icon.setAttribute('name', 'gripper');
    this.button.appendChild(icon);

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.hostIsContent];
    shadow.appendChild(this.button);
  }
}
