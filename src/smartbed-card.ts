import { LitElement, html, css, CSSResultGroup, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import type { SmartbedCardConfig, DiscoveredBed, BedEntities } from './types';
import { DEFAULT_CONFIG } from './types';
import { discoverBed, fetchDeviceEntities, inferDevicePrefix } from './entity-discovery';
import { CARD_VERSION, CARD_NAME, CARD_EDITOR_NAME } from './const';

// Import sub-components (side-effects — registers custom elements)
import './components/bed-visualization';
import './components/position-controls';
import './components/preset-buttons';
import './components/massage-controls';
import './components/sensor-row';

console.info(
  `%c  SMARTBED-CARD \n%c  v${CARD_VERSION}    `,
  'color: #6cb4e4; font-weight: bold; background: #1a1a2e',
  'color: white; font-weight: bold; background: #16213e',
);

declare global {
  interface Window {
    customCards: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_NAME,
  name: 'SmartBed Card',
  description: 'Interactive control card for smart adjustable beds (smartbed-mqtt)',
  preview: false,
});

@customElement('smartbed-card')
export class SmartbedCard extends LitElement {
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement(CARD_EDITOR_NAME) as unknown as LovelaceCardEditor;
  }

  public static getStubConfig(): Record<string, unknown> {
    return {};
  }

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: SmartbedCardConfig;

  // Discovered bed entities (fetched async on device_id change)
  @state() private _discovered: DiscoveredBed | null = null;
  @state() private _loading = false;
  @state() private _error: string | null = null;

  // Active split side (for split beds)
  @state() private _activeSide: 'left' | 'right' | 'both' = 'both';

  // All entity_ids this card cares about (for shouldUpdate tracking)
  private _watchedEntityIds: Set<string> = new Set();

  public setConfig(config: SmartbedCardConfig): void {
    if (!config) throw new Error('Invalid configuration');
    this._config = { ...DEFAULT_CONFIG, ...config };
    // Reset discovery when device changes
    this._discovered = null;
    this._error = null;
  }

  protected updated(changedProps: PropertyValues): void {
    super.updated(changedProps);

    // Trigger entity discovery when hass is first available or device_id changes
    if (
      (changedProps.has('hass') || changedProps.has('_config')) &&
      this.hass &&
      this._config?.device_id &&
      !this._discovered &&
      !this._loading
    ) {
      this._fetchAndDiscover();
    }
  }

  private async _fetchAndDiscover(): Promise<void> {
    if (!this._config.device_id || !this.hass) return;
    this._loading = true;
    this._error = null;

    try {
      const entities = await fetchDeviceEntities(this.hass, this._config.device_id);
      if (entities.length === 0) {
        this._error = `No entities found for device: ${this._config.device_id}`;
        return;
      }

      const prefix = inferDevicePrefix(entities);
      const discovered = discoverBed(entities, prefix);
      this._discovered = discovered;

      // Build watched entity_id set for shouldUpdate
      this._watchedEntityIds = new Set(this._collectEntityIds(discovered));
    } catch (err) {
      this._error = `Discovery failed: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this._loading = false;
    }
  }

  private _collectEntityIds(bed: DiscoveredBed): string[] {
    const ids: string[] = [];
    const collect = (e: BedEntities) => {
      Object.values(e.covers).forEach((id) => id && ids.push(id));
      e.presets.forEach((p) => ids.push(p.entity_id));
      e.programPresets.forEach((p) => ids.push(p.entity_id));
      e.massage.sliders.forEach((s) => ids.push(s.entity_id));
      e.massage.steppers.forEach((s) => ids.push(s.entity_id));
      if (e.massage.mode) ids.push(e.massage.mode.entity_id);
      e.sensors.forEach((s) => ids.push(s.entity_id));
      e.switches.forEach((s) => ids.push(s.entity_id));
      e.lights.forEach((l) => ids.push(l.entity_id));
      e.selects.forEach((s) => ids.push(s.entity_id));
    };
    collect(bed.entities);
    if (bed.left) collect(bed.left);
    if (bed.right) collect(bed.right);
    return ids;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._config) return false;

    // Always update on config or internal state changes
    if (changedProps.has('_config') || changedProps.has('_discovered') ||
        changedProps.has('_loading') || changedProps.has('_error') ||
        changedProps.has('_activeSide')) {
      return true;
    }

    // On hass change, only update if any watched entity changed
    if (changedProps.has('hass')) {
      const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
      if (!oldHass) return true; // first render

      for (const entityId of this._watchedEntityIds) {
        if (oldHass.states[entityId] !== this.hass.states[entityId]) return true;
      }
      return false;
    }

    return false;
  }

  protected render() {
    if (!this._config) return html``;

    if (!this._config.device_id) {
      return this._renderEmpty();
    }

    if (this._loading) {
      return this._renderLoading();
    }

    if (this._error) {
      return this._renderError(this._error);
    }

    if (!this._discovered) {
      return this._renderLoading();
    }

    const bed = this._discovered;
    const compact = this._config.compact ?? false;
    const isSplit = bed.isSplit;

    // Determine which side entities to show
    const side = this._activeSide;
    const entities: BedEntities = isSplit && side !== 'both'
      ? (side === 'left' ? bed.left! : bed.right!) ?? bed.entities
      : bed.entities;

    return html`
      <ha-card class="smartbed-card ${compact ? 'compact' : ''}">
        ${this._renderHeader(bed)}
        <div class="card-content">
          ${isSplit ? this._renderSideTabs() : ''}
          ${this._config.show_visualization !== false
            ? html`
                <smartbed-bed-visualization
                  .hass=${this.hass}
                  .covers=${entities.covers}
                ></smartbed-bed-visualization>
              `
            : ''}
          ${this._config.show_controls !== false && Object.values(entities.covers).some(Boolean)
            ? html`
                <div class="section">
                  <div class="section-title">
                    <ha-icon icon="mdi:tune-vertical"></ha-icon>
                    <span>Position</span>
                  </div>
                  <smartbed-position-controls
                    .hass=${this.hass}
                    .covers=${entities.covers}
                    .compact=${compact}
                  ></smartbed-position-controls>
                </div>
              `
            : ''}
          ${this._config.show_presets !== false && (entities.presets.length > 0 || entities.programPresets.length > 0)
            ? html`
                <div class="section">
                  <div class="section-title">
                    <ha-icon icon="mdi:gesture-tap-button"></ha-icon>
                    <span>Presets</span>
                  </div>
                  <smartbed-preset-buttons
                    .hass=${this.hass}
                    .presets=${entities.presets}
                    .programPresets=${entities.programPresets}
                    .compact=${compact}
                    .showProgram=${this._config.show_program_presets ?? false}
                  ></smartbed-preset-buttons>
                </div>
              `
            : ''}
          ${this._config.show_massage !== false &&
            (entities.massage.sliders.length > 0 || entities.massage.steppers.length > 0 || entities.massage.mode)
            ? html`
                <div class="section">
                  <div class="section-title">
                    <ha-icon icon="mdi:vibrate"></ha-icon>
                    <span>Massage</span>
                  </div>
                  <smartbed-massage-controls
                    .hass=${this.hass}
                    .massage=${entities.massage}
                    .compact=${compact}
                  ></smartbed-massage-controls>
                </div>
              `
            : ''}
          ${this._config.show_sensors !== false &&
            (entities.switches.length > 0 || entities.lights.length > 0 ||
             entities.selects.length > 0 || entities.sensors.length > 0)
            ? html`
                <div class="section">
                  <div class="section-title">
                    <ha-icon icon="mdi:chip"></ha-icon>
                    <span>Controls &amp; Sensors</span>
                  </div>
                  <smartbed-sensor-row
                    .hass=${this.hass}
                    .sensors=${entities.sensors}
                    .switches=${entities.switches}
                    .lights=${entities.lights}
                    .selects=${entities.selects}
                    .compact=${compact}
                  ></smartbed-sensor-row>
                </div>
              `
            : ''}
        </div>
      </ha-card>
    `;
  }

  private _renderHeader(bed: DiscoveredBed) {
    const name = this._config.name ??
      (bed.entities.covers.head
        ? this.hass.states[bed.entities.covers.head]?.attributes?.friendly_name?.split(':')[0]
        : undefined) ??
      'Smart Bed';

    return html`
      <div class="card-header">
        <div class="header-title">
          <ha-icon icon="mdi:bed-queen"></ha-icon>
          <span>${name}</span>
        </div>
        ${bed.isSplit
          ? html`<div class="split-badge">Split</div>`
          : ''}
      </div>
    `;
  }

  private _renderSideTabs() {
    return html`
      <div class="side-tabs">
        <button
          class="side-tab ${this._activeSide === 'both' ? 'active' : ''}"
          @click=${() => { this._activeSide = 'both'; }}
        >Both</button>
        <button
          class="side-tab ${this._activeSide === 'left' ? 'active' : ''}"
          @click=${() => { this._activeSide = 'left'; }}
        >Left</button>
        <button
          class="side-tab ${this._activeSide === 'right' ? 'active' : ''}"
          @click=${() => { this._activeSide = 'right'; }}
        >Right</button>
      </div>
    `;
  }

  private _renderEmpty() {
    return html`
      <ha-card>
        <div class="empty-state">
          <ha-icon icon="mdi:bed-queen-outline"></ha-icon>
          <p>No device configured.</p>
          <p class="hint">Edit this card to select your smart bed device.</p>
        </div>
      </ha-card>
    `;
  }

  private _renderLoading() {
    return html`
      <ha-card>
        <div class="loading-state">
          <ha-circular-progress active></ha-circular-progress>
          <p>Discovering bed entities…</p>
        </div>
      </ha-card>
    `;
  }

  private _renderError(message: string) {
    return html`
      <ha-card>
        <div class="error-state">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <p>${message}</p>
        </div>
      </ha-card>
    `;
  }

  public getCardSize(): number {
    let size = 1; // header
    if (this._config.show_visualization !== false) size += 3;
    if (this._config.show_controls !== false) size += 2;
    if (this._config.show_presets !== false) size += 2;
    if (this._config.show_massage !== false) size += 2;
    if (this._config.show_sensors !== false) size += 1;
    return size;
  }

  public getGridOptions() {
    return {
      rows: 6,
      columns: 6,
      min_rows: 4,
      min_columns: 3,
    };
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }

      ha-card {
        overflow: hidden;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px 8px;
        border-bottom: 1px solid var(--divider-color);
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      .header-title ha-icon {
        --mdc-icon-size: 22px;
        color: var(--primary-color);
      }

      .split-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        padding: 2px 8px;
        border-radius: 12px;
        background: var(--primary-color);
        color: var(--text-primary-color, white);
      }

      .card-content {
        padding: 12px 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .compact .card-content {
        gap: 10px;
        padding: 8px 12px 12px;
      }

      /* Side tabs for split beds */
      .side-tabs {
        display: flex;
        gap: 4px;
        background: var(--secondary-background-color);
        border-radius: 10px;
        padding: 3px;
      }

      .side-tab {
        flex: 1;
        padding: 6px 0;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: var(--secondary-text-color);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
        font-family: inherit;
      }

      .side-tab.active {
        background: var(--card-background-color, white);
        color: var(--primary-text-color);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      }

      /* Section headers */
      .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.7px;
        text-transform: uppercase;
        color: var(--secondary-text-color);
      }

      .section-title ha-icon {
        --mdc-icon-size: 14px;
      }

      /* Empty / loading / error states */
      .empty-state,
      .loading-state,
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        text-align: center;
        gap: 8px;
        color: var(--secondary-text-color);
      }

      .empty-state ha-icon,
      .error-state ha-icon {
        --mdc-icon-size: 48px;
        opacity: 0.5;
      }

      .empty-state p,
      .loading-state p,
      .error-state p {
        margin: 0;
        font-size: 14px;
      }

      .empty-state .hint {
        font-size: 12px;
        opacity: 0.7;
      }

      .error-state ha-icon {
        color: var(--error-color, #db4437);
        opacity: 0.8;
      }
    `;
  }
}
