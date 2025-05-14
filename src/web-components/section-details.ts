import { EntityFocus } from '../common';
import { BrpValue } from '../protocol';
import { HTMLButtonCustom, HTMLMerged, HTMLSelectCustom } from './elements';

export class SectionDetails {
  private title: HTMLElement;
  private connection: HTMLMerged;
  private entityId: HTMLMerged;
  private updateMode: HTMLMerged;
  private intervalRange: HTMLMerged;
  private manualUpdate: HTMLMerged;

  private doUpdate: boolean = true;
  private interval: number = 100; // by default

  constructor(private section: HTMLElement) {
    this.title = document.createElement('h3');
    this.title.textContent = 'Entity';

    this.connection = HTMLMerged.create();
    this.connection.label = 'Connection';
    this.connection.setTooltipFrom('Connection');
    this.connection.vscodeContext({ details: 'connection' });

    this.entityId = HTMLMerged.create();
    this.entityId.label = 'Entity ID';
    this.entityId.setTooltipFrom('Entity ID');
    this.entityId.vscodeContext({ details: 'entity_id' });

    this.updateMode = HTMLMerged.create();
    this.updateMode.label = 'Update Mode';
    this.updateMode.setTooltipFrom('Update Mode');
    this.updateMode.setOptionsManual('Live', ['Live', 'Manual'], (v: BrpValue) => {
      if (v === 'Live') return this.switchToLiveAndUpdate();
      if (v === 'Manual') return this.switchToManualAndUpdate();
      console.error('cannot parse option from updateMode');
    });
    this.updateMode.vscodeContext({ details: 'update_mode' });

    this.intervalRange = HTMLMerged.create();
    this.intervalRange.label = 'Update Interval';
    this.intervalRange.setTooltipFrom('Update Interval in Milliseconds');
    this.intervalRange.setValue(this.interval);
    if (this.intervalRange.htmlRight !== undefined) {
      this.intervalRange.htmlRight.value.mutability = this.changeInterval;
    }
    this.intervalRange.vscodeContext({ details: 'interval' });

    this.manualUpdate = HTMLMerged.create();
    this.manualUpdate.style.display = 'none'; // hidden at start
    this.manualUpdate.label = 'Update Control';
    this.manualUpdate.setTooltipFrom('Update Mode');
    const clickable = HTMLButtonCustom.create();
    clickable.setValue('Update (Clickable)');
    clickable.mutability = () => this.onManualUpdate();
    this.manualUpdate.insertMutatable(clickable);

    // Setup
    this.section.style.display = 'none';
    this.section.append(
      this.title,
      this.connection,
      this.entityId,
      this.updateMode,
      this.intervalRange,
      this.manualUpdate
    );
  }

  update(focus: EntityFocus, status: 'online' | 'offline') {
    this.section.removeAttribute('style');
    this.connection.setValue(status === 'online' ? focus.host : 'Offline');
    this.entityId.setValue(focus.entityId.toString());
  }

  getConnection(): string | undefined {
    const result = this.connection.htmlRight?.value.buffer;
    return typeof result === 'string' ? result : undefined;
  }
  getEntityId(): string | undefined {
    const result = this.entityId.htmlRight?.value.buffer;
    return typeof result === 'string' ? result : undefined;
  }
  getUpdateMode() {
    return this.doUpdate ? 'Live' : 'Manual';
  }
  getInterval(): number {
    return this.interval;
  }

  private changeInterval = (v: BrpValue) => {
    if (typeof v !== 'number') return console.error(`interval is not number`);
    const minValue = 5;
    const maxValue = 1000;
    this.interval = Math.min(Math.max(v, minValue), maxValue);
    this.intervalRange.htmlRight?.value.setValue(this.interval);
  };

  onManualUpdate = () => {};

  switchToManualAndUpdate() {
    if (this.doUpdate) {
      this.doUpdate = false;

      // set selection
      const select = this.updateMode.htmlRight?.value;
      if (select instanceof HTMLSelectCustom && select.getAvailable().includes('Manual')) {
        select.select('Manual');
      } else {
        console.error('Cannot update option for updateMode');
      }

      // visibility
      this.intervalRange.style.display = 'none';
      this.manualUpdate.removeAttribute('style');
    }
    // forced update
    this.onManualUpdate();
  }

  switchToLiveAndUpdate() {
    if (this.doUpdate === false) {
      this.doUpdate = true;

      // set selection
      const select = this.updateMode.htmlRight?.value;
      if (select instanceof HTMLSelectCustom && select.getAvailable().includes('Live')) {
        select.select('Live');
      } else {
        console.error('Cannot update option for updateMode');
      }

      // visibility
      this.intervalRange.removeAttribute('style');
      this.manualUpdate.style.display = 'none';
    }
    // start watch
    this.onManualUpdate();
  }
}
