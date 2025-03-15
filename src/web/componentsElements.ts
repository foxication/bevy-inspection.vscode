import * as extStyles from './componentsStyles';
import { entityData, onEntityDataChange } from './components';
import { labelFromPath, RealValue } from './lib';

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
class ExtExpandable extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const label = this.getAttribute('label') ?? '';
    const readableLabel = label.replace(/::/g, ' :: ');
    const isComponent = this.hasAttribute('component');
    const isIndexed = this.hasAttribute('indexed');
    const isArray = this.hasAttribute('array');
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

    // Details.summary.add
    const addIcon = document.createElement('vscode-icon');
    addIcon.setAttribute('name', 'add');
    const addButton = document.createElement('button');
    addButton.appendChild(addIcon);

    // Details.summary.gripper
    const gripper = document.createElement('ext-gripper') as ExtGripper;
    gripper.indexed = this;

    // Detials.summary
    const summary = document.createElement('summary');
    if (indent >= 0) summary.append(indentation());
    summary.appendChild(chevron);
    if (isComponent) summary.appendChild(icon());
    summary.appendChild(labelElement);
    summary.appendChild(space);
    if (isArray) summary.appendChild(addButton);
    if (isIndexed) summary.appendChild(gripper);

    // Detials.content
    const content = document.createElement('div');
    content.setAttribute('class', 'details-content');
    content.setAttribute('indent', indent.toString());
    content.innerHTML = this.innerHTML;

    // Detials
    const details = document.createElement('details');
    details.setAttribute('open', '');
    details.appendChild(summary);
    details.appendChild(content);

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons, extStyles.expandable];
    shadow.appendChild(details);
  }
}
class ExtDeclaration extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot !== null) return;

    const path = this.getAttribute('path') ?? '';
    const label = labelFromPath(path);
    const hideLabel = this.hasAttribute('hide-label');
    const isIndexed = this.hasAttribute('indexed');
    const value = entityData.get(path);
    if (!(typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string')) {
      console.error('VALUE is not basic type');
      return;
    }

    // Initialize elements
    const labelElement = document.createElement('label');
    labelElement.setAttribute('for', path);
    labelElement.textContent = hideLabel ? '' : label;

    const valueHolder = document.createElement('div');
    valueHolder.classList.add('value');

    const gripper = document.createElement('ext-gripper') as ExtGripper;
    gripper.indexed = this;

    switch (typeof value) {
      case 'number': {
        const number = document.createElement('ext-number');
        number.id = path;
        valueHolder.appendChild(number);
        break;
      }

      case 'boolean': {
        const checkbox = document.createElement('ext-boolean');
        checkbox.id = path;
        valueHolder.appendChild(checkbox);
        break;
      }

      case 'string': {
        const text = document.createElement('ext-string');
        text.id = path;
        valueHolder.appendChild(text);
        break;
      }
    }
    if (isIndexed) valueHolder.appendChild(gripper);

    // Create shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.declaration];
    shadow.appendChild(labelElement);
    shadow.appendChild(valueHolder);
  }
}
class ExtValue extends HTMLElement {
  get value(): RealValue {
    const result = entityData.get(this.id) ?? null;
    if (result === null) console.error(`${this.id} => this path not in table`);
    return entityData.get(this.id) ?? null;
  }

  set value(v: RealValue) {
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
    entityData.set(this.id, v);
    if (previous !== v) onEntityDataChange(this.id);
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
    const iconArea = document.createElement('vscode-icon');
    iconArea.setAttribute('name', 'list-selection');
    toArea.appendChild(iconArea);

    const toField = document.createElement('button');
    toField.classList.add('inArea');
    toField.classList.add('inside');
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
      area.value = this.value as string;

      area.style.removeProperty('display');
      toField.style.removeProperty('display');
      field.style.display = 'none';
      toArea.style.display = 'none';
    };
    toField.onclick = () => {
      field.value = this.value as string;

      area.style.display = 'none';
      toField.style.display = 'none';
      field.style.removeProperty('display');
      toArea.style.removeProperty('display');
    };

    // Set initial mode
    if ((this.value as string).indexOf('\n') > -1) {
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
    const decreaseIcon = document.createElement('vscode-icon');
    decreaseIcon.setAttribute('name', 'chevron-left');
    decreaseButton.appendChild(decreaseIcon);

    const increaseButton = document.createElement('button');
    increaseButton.classList.add('inside-compact');
    increaseButton.classList.add('autohide');
    const increaseIcon = document.createElement('vscode-icon');
    increaseIcon.setAttribute('name', 'chevron-right');
    increaseButton.appendChild(increaseIcon);

    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    input.classList.add('centered');
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
    shadow.adoptedStyleSheets = [extStyles.booleanInput];
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

  public set indexed(element: HTMLElement) {
    const list = element.parentElement;
    if (list === null) return;

    // Constants
    const gap = 4; // px
    console.log(`gap: ${gap}`);

    // Logics
    this.button.onpointerdown = (eDown) => {
      console.log('gripper in dragged');
      this.button.setPointerCapture(eDown.pointerId);
      element.style.zIndex = '1';

      let minOffset = -element.offsetTop;
      let maxOffset = minOffset + list.offsetHeight - element.offsetHeight;
      let initialClientY = eDown.clientY;

      console.log(`calculated minOffset: ${minOffset}, maxOffet: ${maxOffset}`);

      let prevSibling: HTMLElement | null = null;
      let nextSibling: HTMLElement | null = null;
      const updateSiblings = () => {
        prevSibling = element.previousElementSibling as HTMLElement;
        nextSibling = element.nextElementSibling as HTMLElement;
      };
      updateSiblings();

      this.button.onpointermove = (eMove) => {
        // console.log('gripper is moving');
        const position = (): number => {
          return Math.min(Math.max(eMove.clientY - initialClientY, minOffset), maxOffset);
        };

        // console.log('--------');

        let isTreeChanged = false;
        if (prevSibling instanceof HTMLElement) {
          const prevShift = prevSibling.offsetHeight + gap;
          if (position() <= -prevShift) {
            initialClientY -= prevShift;
            minOffset += prevShift;
            maxOffset += prevShift;

            list.removeChild(element);
            list.insertBefore(element, prevSibling);
            isTreeChanged = true;
          }
          // console.log(`prev: ${prevShift}`);
        }
        if (nextSibling instanceof HTMLElement) {
          const nextShift = nextSibling.offsetHeight + gap;
          if (position() >= nextShift) {
            initialClientY += nextShift;
            minOffset -= nextShift;
            maxOffset -= nextShift;

            list.removeChild(element);
            list.insertBefore(element, nextSibling.nextSibling);
            isTreeChanged = true;
          }
          // console.log(`next: ${nextShift}`);
        }
        if (isTreeChanged) {
          updateSiblings();
          this.button.setPointerCapture(eDown.pointerId); // restore
        }
        element.style.top = position() + 'px';

        // console.log(`position: ${position()}`);
      };

      this.button.onpointerup = () => {
        console.log('gripper is dropped');

        // pointer automatically releases on onpointerup
        this.button.onpointermove = null;
        this.button.onpointerup = null;

        element.style.removeProperty('top');
        element.style.removeProperty('z-index');
      };
    };
  }

  connectedCallback() {
    if (this.shadowRoot !== null) return;

    // Initialize elements
    this.button.classList.add('compact-tall');

    const icon = document.createElement('vscode-icon');
    icon.setAttribute('name', 'gripper');
    this.button.appendChild(icon);

    // Initialize shadow DOM
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [extStyles.buttons];
    shadow.appendChild(this.button);
  }
}
