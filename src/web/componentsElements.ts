import * as extStyles from './componentsStyles';
import { entityData, onEntityDataChange } from './components';
import { labelFromPath } from './lib';
import { BrpStructurePath, BrpValue } from 'bevy-remote-protocol/src/types';

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
export class ExtExpandable extends HTMLElement {
  content = document.createElement('div') as ExtExpandableContent;
  path: BrpStructurePath = [];

  connectedCallback() {
    if (this.shadowRoot !== null) console.error('shadow root already exists');

    // Root scenario
    if (this.path.length === 0) {
      // Create list of components
      for (const key of entityData.keys()) {
        const declaration = document.createElement('ext-expandable') as ExtDeclaration;
        declaration.path = [key];
        this.content.append(declaration);
      }
      // Create shadow DOM
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.expandable];
      shadow.appendChild(this.content);
      return;
    }

    const label = (this.path[this.path.length - 1].toString() ?? '').replace(/::/g, ' :: ');
    const isComponent = this.path.length === 1;
    const inArray = entityData.get(this.path.slice(0, -1)) || isComponent;
    const isArray = entityData.get(this.path) instanceof Array;
    const indent = Math.max(this.path.length - 1, 0);
    const indentPx = Math.max(indent * 22 - 6, 0);

    const indentation = () => {
      const element = document.createElement('div');
      element.style.width = indentPx.toString() + 'px';
      element.classList.add('indent');
      return element;
    };
    const chevron = () => {
      const element = document.createElement('vscode-icon');
      element.setAttribute('name', 'chevron-right');
      element.setAttribute('class', 'rotatable');
      return element;
    };
    const labelElement = () => {
      const element = document.createElement('span');
      element.textContent = label ?? '';
      return element;
    };
    const icon = () => {
      const element = document.createElement('vscode-icon');
      element.setAttribute('name', 'symbol-method');
      element.setAttribute('class', 'component-type-icon');
      return element;
    };
    const space = () => {
      const element = document.createElement('div');
      element.classList.add('space');
      return element;
    };
    const removeButton = () => {
      const removeIcon = () => {
        const removeIcon = document.createElement('vscode-icon');
        removeIcon.setAttribute('name', 'trash');
        return removeIcon;
      };
      const element = document.createElement('button');
      element.appendChild(removeIcon());
      element.classList.add('autohide');
      element.tabIndex = -1;
      return element;
    };
    const appendButton = () => {
      const appendIcon = () => {
        const element = document.createElement('vscode-icon');
        element.setAttribute('name', 'expand-all');
        return element;
      };
      const element = document.createElement('button');
      element.appendChild(appendIcon());
      element.classList.add('autohide');
      element.tabIndex = -1;
      return element;
    };
    const gripper = () => {
      const element = document.createElement('ext-gripper') as ExtGripper;
      element.indexed = this;
      return element;
    };
    const buttons = () => {
      const element = document.createElement('div');
      element.classList.add('buttons');
      if (isArray) element.appendChild(appendButton());
      if (inArray) element.appendChild(removeButton());
      if (inArray) element.appendChild(gripper());
      return element;
    };
    const summary = () => {
      const element = document.createElement('summary');
      if (indentPx >= 0) element.append(indentation());
      element.appendChild(chevron());
      if (isComponent) element.appendChild(icon());
      element.appendChild(labelElement());
      element.appendChild(space());
      element.appendChild(buttons());
      return element;
    };
    const content = () => {
      this.content.setAttribute('class', 'details-content');
      if (isArray) this.content.onReorder = () => this.onReorder(this.path);

      const declaration = (path: BrpStructurePath) => {
        const element = document.createElement('ext-declaration') as ExtDeclaration;
        element.path = path;
        return element;
      };
      const expandable = (path: BrpStructurePath) => {
        const element = document.createElement('ext-expandable') as ExtExpandable;
        element.path = path;
        return element;
      };

      const children = entityData.get(this.path);
      if (children === undefined) return this.content;

      // single value (for components)
      if (typeof children !== 'object' || children === null) {
        this.content.appendChild(declaration(this.path));
        return this.content;
      }

      // Array of expandables or declarations
      if (children instanceof Array) {
        for (const key of children.keys()) {
          const path = this.path.concat(key);
          const child = entityData.get(path);
          if (typeof child !== 'object' || child === null) this.content.appendChild(declaration(path));
          else this.content.appendChild(expandable(path));
        }
        return this.content;
      }

      // Named expandables or declarations (Object)
      for (const key of Object.keys(children)) {
        const path = this.path.concat(key);
        const child = entityData.get(path);
        if (typeof child !== 'object' || child === null) this.content.appendChild(declaration(path));
        else this.content.appendChild(expandable(path));
      }
      return this.content;
    };
    const details = () => {
      const element = document.createElement('details');
      element.setAttribute('open', '');
      element.appendChild(summary());
      element.appendChild(content());
      return element;
    };

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.expandable];
    shadow.appendChild(details());
  }
  public onReorder(root: BrpStructurePath) {
    let index = 0;
    for (const child of this.content.children) {
      if (child instanceof ExtExpandable) console.error(`not implemented`);
      if (child instanceof ExtDeclaration) child.path = root.concat(index);
      index += 1;
    }
  }
}
export class ExtDeclaration extends HTMLElement {
  label = document.createElement('label') as HTMLElement;
  value: ExtValue | undefined;
  path: BrpStructurePath = [];

  connectedCallback() {
    if (this.shadowRoot !== null) console.error('shadow root already exists');
    if (this.path.length === 0) return;
    const hideLabel = this.path.length === 1;
    const inArray = entityData.get(this.path.slice(0, -1)) instanceof Array;

    this.label.textContent = hideLabel ? '' : labelFromPath(this.path);

    const background = () => {
      const element = document.createElement('div');
      element.classList.add('background');
      return element;
    };
    const removeButton = () => {
      const removeIcon = () => {
        const element = document.createElement('vscode-icon');
        element.name = 'trash';
        return element;
      };
      const element = document.createElement('button');
      element.appendChild(removeIcon());
      element.classList.add('compact-tall');
      element.tabIndex = -1;
      return element;
    };
    const gripper = () => {
      const element = document.createElement('ext-gripper') as ExtGripper;
      element.indexed = this;
      return element;
    };
    const valueHolder = () => {
      const element = document.createElement('div');
      element.classList.add('value');
      switch (typeof entityData.get(this.path)) {
        case 'number': {
          this.value = document.createElement('ext-number') as ExtNumber;
          this.value.path = this.path;
          element.appendChild(this.value);
          break;
        }
        case 'boolean': {
          this.value = document.createElement('ext-boolean') as ExtBoolean;
          this.value.path = this.path;
          element.appendChild(this.value);
          break;
        }
        default: {
          this.value = document.createElement('ext-string') as ExtString;
          this.value.path = this.path;
          element.appendChild(this.value);
          break;
        }
      }
      if (inArray) element.appendChild(removeButton());
      if (inArray) element.appendChild(gripper());
      return element;
    };

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.declaration];
    shadow.appendChild(background());
    shadow.appendChild(this.label);
    shadow.appendChild(valueHolder());
  }
}
class ExtValue extends HTMLElement {
  lastValue: BrpValue = null;
  path: BrpStructurePath = [];

  get value(): BrpValue {
    if (!entityData.has(this.path)) {
      console.error(`${this.id} => this path not in table`);
    }
    this.lastValue = entityData.get(this.path) ?? null;
    return this.lastValue;
  }

  set value(v: BrpValue) {
    if (!entityData.has(this.path)) {
      console.error(`${this.id} => this path not in table`);
      return;
    }
    const previous = entityData.get(this.path);
    if (typeof v !== typeof previous) {
      console.error(`${this.id} => types of newValue and oldValue don't match`);
      return;
    }
    if (typeof v === 'number' && !Number.isFinite(v)) {
      console.error(`${this.id} => number is not finite`);
      return;
    }
    this.lastValue = v;
    entityData.set(this.path, v);
    if (previous !== v) onEntityDataChange(this.path);
  }

  get valueAsString(): string {
    const result = this.value;
    if (typeof result !== 'object') return result.toString();
    if (result === null) return 'NULL';
    if (result instanceof Array) return '[ ARRAY ]';
    return '{ OBJECT }';
  }
}
class ExtString extends ExtValue {
  connectedCallback() {
    if (this.shadowRoot !== null) console.error('shadow root already exists');
    const isDisabled = entityData.get(this.path) === null;

    const field = () => {
      const element = document.createElement('input');
      element.type = 'text';
      element.disabled = isDisabled;
      element.onfocus = () => {
        this.setAttribute('focused', '');
      };
      element.onkeydown = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          element.value = this.valueAsString;
          element.blur();
          e.preventDefault();
        }
        if (e.key === 'Enter') {
          element.blur();
        }
      };
      element.onchange = () => {
        this.value = element.value;
        element.blur();
      };
      element.onblur = () => {
        element.value = this.valueAsString;
        this.removeAttribute('focused');
      };
      return element;
    };
    const area = () => {
      const element = document.createElement('textarea');
      element.disabled = isDisabled;
      element.rows = 5;
      element.oninput = () => {
        element.style.height = 'auto';
        element.style.height = element.scrollHeight + 'px';
      };
      element.onfocus = () => {
        this.setAttribute('focused', '');
      };
      element.onkeydown = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          element.value = this.valueAsString;
          element.blur();
          e.preventDefault();
        }
        if (e.ctrlKey && e.key === 'Enter') {
          element.blur();
        }
      };
      element.onchange = () => {
        this.value = element.value;
        element.blur();
      };
      element.onblur = () => {
        element.value = this.valueAsString;
        element.scrollTo(0, 0);
        this.removeAttribute('focused');
      };
      return element;
    };
    const toArea = () => {
      const iconArea = () => {
        const element = document.createElement('vscode-icon');
        element.setAttribute('name', 'list-selection');
        return element;
      };
      const element = document.createElement('button');
      element.classList.add('inside');
      element.tabIndex = -1;
      element.appendChild(iconArea());
      return element;
    };
    const toField = () => {
      const iconField = () => {
        const element = document.createElement('vscode-icon');
        element.name = 'symbol-string';
        return element;
      };
      const element = document.createElement('button');
      element.classList.add('inArea', 'inside');
      element.tabIndex = -1;
      element.appendChild(iconField());
      return element;
    };

    const areaElement = area();
    const fieldElement = field();
    const toAreaButton = toArea();
    const toFieldButton = toField();

    toAreaButton.onclick = () => {
      areaElement.value = this.valueAsString;
      areaElement.style.removeProperty('display');
      toFieldButton.style.removeProperty('display');
      fieldElement.style.display = 'none';
      toAreaButton.style.display = 'none';
    };
    toFieldButton.onclick = () => {
      fieldElement.value = this.valueAsString;
      areaElement.style.display = 'none';
      toFieldButton.style.display = 'none';
      fieldElement.style.removeProperty('display');
      toAreaButton.style.removeProperty('display');
    };

    const buttonCollection = () => {
      const element = document.createElement('div');
      element.classList.add('button-collection', 'autohide');
      element.appendChild(toAreaButton);
      element.appendChild(toFieldButton);
      return element;
    };

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.input, extStyles.textArea];

    shadow.appendChild(areaElement);
    shadow.appendChild(fieldElement);
    if (!isDisabled) shadow.appendChild(buttonCollection());

    // Set initial mode
    if (this.valueAsString.indexOf('\n') > -1) toAreaButton.onclick(new MouseEvent(''));
    else toFieldButton.onclick(new MouseEvent(''));
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
    if (this.shadowRoot !== null) console.error('shadow root already exists');

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
    if (this.shadowRoot !== null) console.error('shadow root already exists');

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
    if (this.shadowRoot !== null) console.error('shadow root already exists');

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
