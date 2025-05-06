import { EntityFocus } from '../common';
import { HTMLMerged } from './elements';

export class SectionDetails {
  private title: HTMLElement;
  private connection: HTMLMerged;
  private entityId: HTMLMerged;

  constructor(private section: HTMLElement) {
    this.title = document.createElement('h3');
    this.title.textContent = 'Entity';

    this.connection = HTMLMerged.create();
    this.connection.label = 'Connection';

    this.entityId = HTMLMerged.create();
    this.entityId.label = 'ID (fake)';

    this.section.style.display = 'none';
    this.section.append(this.title, this.connection, this.entityId);
  }

  update(focus: EntityFocus, status: 'online' | 'offline') {
    this.section.removeAttribute('style');
    this.connection.setValue(status === 'online' ? focus.host : 'Offline');
    this.entityId.setValue(focus.entityId.toString());
  }
}
