import { EntityFocus } from '../common';
import { BrpValue } from '../protocol';
import {
  ButtonAsEditor,
  InformationRenderer,
  NumberEditor,
  SelectionEditor,
  TreeItemVisual,
} from './visuals';

export class SectionDetails {
  private title: HTMLElement;
  private connection: [TreeItemVisual, InformationRenderer];
  private entityId: [TreeItemVisual, InformationRenderer];
  private updateMode: [TreeItemVisual, SelectionEditor];
  private intervalRange: [TreeItemVisual, NumberEditor];
  private manualUpdate: [TreeItemVisual, ButtonAsEditor];

  private doUpdate: boolean = true;
  private interval: number = 100; // by default

  constructor(private section: HTMLElement) {
    this.title = document.createElement('h3');
    this.title.textContent = 'Entity';

    this.connection = [TreeItemVisual.createEmpty(), InformationRenderer.create()];
    this.connection[0].extSetLabel('Connection');
    this.connection[0].extSetTooltipFrom('Connection');
    this.connection[0].extVscodeContext({ details: 'connection' });
    this.connection[0].extInsertRenderer(this.connection[1]);

    this.entityId = [TreeItemVisual.createEmpty(), InformationRenderer.create()];
    this.entityId[0].extSetLabel('Entity ID');
    this.entityId[0].extSetTooltipFrom('Entity ID');
    this.entityId[0].extVscodeContext({ details: 'entity_id' });
    this.entityId[0].extInsertRenderer(this.entityId[1]);

    this.updateMode = [TreeItemVisual.createEmpty(), SelectionEditor.create()];
    this.updateMode[0].extSetLabel('Update Mode');
    this.updateMode[0].extSetTooltipFrom('Update Mode');
    this.updateMode[0].extVscodeContext({ details: 'update_mode' });
    this.updateMode[0].extInsertEditor(this.updateMode[1]);
    this.updateMode[1].extSetAvailable(['Live', 'Manual'], 'Live');
    this.updateMode[1].extAllowMutation((v: string) => {
      if (v === 'Live') return this.switchToLiveAndUpdate();
      if (v === 'Manual') return this.switchToManualAndUpdate();
      console.error('cannot parse option from updateMode');
    });

    this.intervalRange = [TreeItemVisual.createEmpty(), NumberEditor.create()];
    this.intervalRange[0].extSetLabel('Update Interval');
    this.intervalRange[0].extSetTooltipFrom('Update Interval in Milliseconds');
    this.intervalRange[0].extVscodeContext({ details: 'interval' });
    this.intervalRange[0].extInsertEditor(this.intervalRange[1]);
    this.intervalRange[1].extSetValue(this.interval);
    this.intervalRange[1].extAllowMutation(this.changeInterval);

    this.manualUpdate = [TreeItemVisual.createEmpty(), ButtonAsEditor.create()];
    this.manualUpdate[0].style.display = 'none'; // hidden at start
    this.manualUpdate[0].extSetLabel('Update Control');
    this.manualUpdate[0].extSetTooltipFrom('Update Mode');
    this.manualUpdate[0].extInsertEditor(this.manualUpdate[1]);
    this.manualUpdate[1].extSetActionTitle('Update');
    this.manualUpdate[1].extAllowMutation(() => this.onManualUpdate());

    // Setup
    this.section.style.display = 'none';
    this.section.append(
      this.title,
      this.connection[0],
      this.entityId[0],
      this.updateMode[0],
      this.intervalRange[0],
      this.manualUpdate[0]
    );
  }

  update(focus: EntityFocus, status: 'online' | 'offline') {
    this.section.removeAttribute('style');
    this.connection[1].extSetValue(status === 'online' ? focus.host : 'Offline');
    this.entityId[1].extSetValue(focus.entityId.toString());
  }

  getConnection(): string {
    return this.connection[1].extGetValue();
  }
  getEntityId(): string {
    return this.entityId[1].extGetValue();
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
    this.intervalRange[1].extSetValue(this.interval);
  };

  onManualUpdate = () => {};

  switchToManualAndUpdate() {
    if (this.doUpdate) {
      this.doUpdate = false;

      // set selection
      if (this.updateMode[1].extGetAvailable().includes('Manual')) {
        this.updateMode[1].extSetValue('Manual');
      } else {
        console.error('Cannot update option for updateMode');
      }

      // visibility
      this.intervalRange[0].style.display = 'none';
      this.manualUpdate[0].removeAttribute('style');
    }
    // forced update
    this.onManualUpdate();
  }

  switchToLiveAndUpdate() {
    if (this.doUpdate === false) {
      this.doUpdate = true;

      // set selection
      if (this.updateMode[1].extGetAvailable().includes('Live')) {
        this.updateMode[1].extSetValue('Live');
      } else {
        console.error('Cannot update option for updateMode');
      }

      // visibility
      this.intervalRange[0].removeAttribute('style');
      this.manualUpdate[0].style.display = 'none';
    }
    // start watch
    this.onManualUpdate();
  }
}
