import { TypePath } from './protocol';

// Add more element classes for componentsView

export type ValueType = boolean | number | string;

export class ComponentAndChildren {
  typePath: TypePath;
  children: (NamedValueElement | AnyValue)[];

  constructor(name: string, children: typeof this.children) {
    this.typePath = name;
    this.children = children;
  }
}

export class ComponentError {
  typePath: TypePath;
  children: (NamedValueElement | AnyValue)[];

  constructor(name: string, children: typeof this.children) {
    this.typePath = name;
    this.children = children;
  }
}

export class AnyValue {
  value: ValueType;

  constructor(value: ValueType) {
    this.value = value;
  }
}

export class NamedValueElement {
  name: string;
  children: (NamedValueElement | AnyValue)[];
  value?: ValueType;

  constructor(name: string, children: typeof this.children, value?: ValueType) {
    this.name = name;
    this.children = children;
    this.value = value;
  }
}

export type InspectionElement =
  | ComponentAndChildren
  | ComponentError
  | AnyValue
  | NamedValueElement;
