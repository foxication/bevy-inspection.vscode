import { EntityFocus } from '../common';
import { BrpValue } from '../protocol';
import { HTMLMerged } from './elements';

export class SectionDetails {
  private title: HTMLElement;
  private connection: HTMLMerged;
  private entityId: HTMLMerged;
  private intervalRange: HTMLMerged;
  private interval: number = 100; // by default

  constructor(private section: HTMLElement) {
    this.title = document.createElement('h3');
    this.title.textContent = 'Entity';

    this.connection = HTMLMerged.create();
    this.connection.label = 'Connection';
    this.connection.vscodeContext({ details: 'connection' });

    this.entityId = HTMLMerged.create();
    this.entityId.label = 'ID';
    this.entityId.setTooltipFrom('Protocol-specific ID (unused in Bevy application logic)');
    this.entityId.vscodeContext({ details: 'entityId' });

    this.intervalRange = HTMLMerged.create();
    this.intervalRange.label = 'Update Interval';
    this.intervalRange.setTooltipFrom('Update Interval in Milliseconds');

    // Setup
    this.section.style.display = 'none';
    this.section.append(this.title, this.connection, this.entityId, this.intervalRange);
  }

  update(focus: EntityFocus, status: 'online' | 'offline') {
    this.section.removeAttribute('style');
    this.connection.setValue(status === 'online' ? focus.host : 'Offline');
    this.entityId.setValue(focus.entityId.toString());
    this.intervalRange.setValue(this.interval);
    if (this.intervalRange.htmlRight !== undefined) {
      this.intervalRange.htmlRight.value.mutability = this.changeInterval;
    }
  }

  getInterval() {
    return this.interval;
  }

  private changeInterval = (v: BrpValue) => {
    if (typeof v !== 'number') return console.error(`interval is not number`);
    const minValue = 5;
    const maxValue = 1000;
    this.interval = Math.min(Math.max(v, minValue), maxValue);
    this.intervalRange.setValue(this.interval);
  };
}
