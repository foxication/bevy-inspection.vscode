import { SyncNode } from './sync';

export class Visual {
  private element: HTMLElement;
  constructor(public readonly sync: SyncNode) {
    this.element = document.createElement('div');
    this.element.style.width = '100%';
    this.element.style.height = '20px';
    
    sync.source().mount?.append(this.element);
  }
}
