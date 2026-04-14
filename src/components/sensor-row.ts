import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HomeAssistant } from 'custom-card-helpers';
import type { SensorEntity, NamedEntity } from '../types';

/** Derive friendly label from entity */
function entityLabel(entityId: string, hass: HomeAssistant): string {
  const state = hass.states[entityId];
  if (state?.attributes?.friendly_name) {
    const fn = state.attributes.friendly_name as string;
    const colonIdx = fn.lastIndexOf(': ');
    return colonIdx >= 0 ? fn.slice(colonIdx + 2) : fn;
  }
  const slug = entityId.split('.')[1] ?? entityId;
  // Heuristic: last 2-3 underscore parts
  const parts = slug.split('_');
  return parts
    .slice(-3)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function sensorIcon(sensor: SensorEntity, hass: HomeAssistant): string {
  const state = hass.states[sensor.entity_id];
  const dc = state?.attributes?.device_class as string | undefined;
  if (dc === 'temperature') return 'mdi:thermometer';
  if (dc === 'humidity') return 'mdi:water-percent';
  if (dc === 'carbon_dioxide') return 'mdi:molecule-co2';
  if (dc === 'volatile_organic_compounds') return 'mdi:air-filter';
  const slug = sensor.entity_id.split('.')[1] ?? '';
  if (/angle/.test(slug)) return 'mdi:angle-acute';
  if (/temp/.test(slug)) return 'mdi:thermometer';
  if (/humid/.test(slug)) return 'mdi:water-percent';
  if (/co2|carbon/.test(slug)) return 'mdi:molecule-co2';
  if (/presence|occup/.test(slug)) return 'mdi:account';
  return 'mdi:information-outline';
}

function formatSensorValue(entityId: string, hass: HomeAssistant): string {
  const state = hass.states[entityId];
  if (!state) return '—';
  const uom = state.attributes?.unit_of_measurement as string | undefined;
  return uom ? `${state.state} ${uom}` : state.state;
}

function switchIcon(entityId: string, hass: HomeAssistant): string {
  const state = hass.states[entityId];
  const dc = state?.attributes?.device_class as string | undefined;
  if (dc) {
    if (dc === 'outlet') return 'mdi:power-socket';
    if (dc === 'switch') return 'mdi:toggle-switch';
  }
  const slug = entityId.split('.')[1] ?? '';
  if (/light|lamp/.test(slug)) return 'mdi:lightbulb';
  if (/fan/.test(slug)) return 'mdi:fan';
  if (/heat/.test(slug)) return 'mdi:fire';
  if (/snore/.test(slug)) return 'mdi:sleep-off';
  return 'mdi:toggle-switch-outline';
}

function selectIcon(entityId: string): string {
  const slug = entityId.split('.')[1] ?? '';
  if (/fan/.test(slug)) return 'mdi:fan';
  if (/heat/.test(slug)) return 'mdi:fire';
  if (/mode/.test(slug)) return 'mdi:tune';
  return 'mdi:format-list-bulleted';
}

@customElement('smartbed-sensor-row')
export class SensorRow extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public sensors: SensorEntity[] = [];
  @property({ attribute: false }) public switches: NamedEntity[] = [];
  @property({ attribute: false }) public lights: NamedEntity[] = [];
  @property({ attribute: false }) public selects: NamedEntity[] = [];
  @property({ type: Boolean }) public compact = false;

  private _toggleSwitch(entityId: string): void {
    this.hass.callService('switch', 'toggle', { entity_id: entityId });
  }

  private _toggleLight(entityId: string): void {
    this.hass.callService('light', 'toggle', { entity_id: entityId });
  }

  private _setSelect(entityId: string, option: string): void {
    this.hass.callService('select', 'select_option', { entity_id: entityId, option });
  }

  protected render() {
    const hasSensors = this.sensors.length > 0;
    const hasSwitches = this.switches.length > 0;
    const hasLights = this.lights.length > 0;
    const hasSelects = this.selects.length > 0;

    if (!hasSensors && !hasSwitches && !hasLights && !hasSelects) return html``;

    return html`
      <div class="sensor-row ${this.compact ? 'compact' : ''}">
        ${hasSwitches ? this._renderSwitches() : ''}
        ${hasLights ? this._renderLights() : ''}
        ${hasSelects ? this._renderSelects() : ''}
        ${hasSensors ? this._renderSensors() : ''}
      </div>
    `;
  }

  private _renderSwitches() {
    return html`
      ${this.switches.map((sw) => {
        const state = this.hass.states[sw.entity_id];
        const isOn = state?.state === 'on';
        const label = entityLabel(sw.entity_id, this.hass);
        const icon = switchIcon(sw.entity_id, this.hass);
        return html`
          <div class="entity-chip ${isOn ? 'active' : ''}" @click=${() => this._toggleSwitch(sw.entity_id)}>
            <ha-icon .icon=${icon}></ha-icon>
            <span>${label}</span>
          </div>
        `;
      })}
    `;
  }

  private _renderLights() {
    return html`
      ${this.lights.map((light) => {
        const state = this.hass.states[light.entity_id];
        const isOn = state?.state === 'on';
        const label = entityLabel(light.entity_id, this.hass);
        return html`
          <div class="entity-chip light-chip ${isOn ? 'active' : ''}" @click=${() => this._toggleLight(light.entity_id)}>
            <ha-icon icon="${isOn ? 'mdi:lightbulb' : 'mdi:lightbulb-outline'}"></ha-icon>
            <span>${label}</span>
          </div>
        `;
      })}
    `;
  }

  private _renderSelects() {
    return html`
      ${this.selects.map((sel) => {
        const state = this.hass.states[sel.entity_id];
        if (!state) return html``;
        const options = (state.attributes?.options as string[]) ?? [];
        const current = state.state;
        const label = entityLabel(sel.entity_id, this.hass);
        const icon = selectIcon(sel.entity_id);
        return html`
          <div class="select-row">
            <ha-icon class="select-icon" .icon=${icon}></ha-icon>
            <span class="select-label">${label}</span>
            <ha-select
              class="select-dropdown"
              .value=${current}
              naturalMenuWidth
              @change=${(e: Event) => {
                e.stopPropagation();
                const val = (e.target as HTMLSelectElement).value;
                this._setSelect(sel.entity_id, val);
              }}
              @closed=${(e: Event) => e.stopPropagation()}
            >
              ${options.map(
                (opt) => html`<mwc-list-item .value=${opt} ?selected=${opt === current}>${opt}</mwc-list-item>`,
              )}
            </ha-select>
          </div>
        `;
      })}
    `;
  }

  private _renderSensors() {
    return html`
      <div class="sensor-chips">
        ${this.sensors.map((sensor) => {
          const icon = sensorIcon(sensor, this.hass);
          const label = entityLabel(sensor.entity_id, this.hass);
          const value = formatSensorValue(sensor.entity_id, this.hass);
          return html`
            <div class="sensor-chip">
              <ha-icon .icon=${icon}></ha-icon>
              <div class="sensor-text">
                <span class="sensor-label">${label}</span>
                <span class="sensor-value">${value}</span>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }

      .sensor-row {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* Toggle chips (switches, lights) */
      .entity-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px 6px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 24px;
        background: var(--secondary-background-color);
        color: var(--secondary-text-color);
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s;
        user-select: none;
        -webkit-user-select: none;
      }

      .entity-chip ha-icon {
        --mdc-icon-size: 18px;
        flex-shrink: 0;
      }

      .entity-chip:hover {
        border-color: var(--primary-color);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
      }

      .entity-chip.active {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
        border-color: var(--primary-color);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      }

      .light-chip.active {
        background: var(--warning-color, #ff9800);
        border-color: var(--warning-color, #ff9800);
      }

      /* Select rows */
      .select-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .select-icon {
        --mdc-icon-size: 18px;
        color: var(--primary-color);
        flex-shrink: 0;
      }

      .select-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
      }

      .select-dropdown {
        min-width: 110px;
      }

      /* Sensor chips */
      .sensor-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .sensor-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        background: var(--secondary-background-color);
        font-size: 12px;
      }

      .sensor-chip ha-icon {
        --mdc-icon-size: 16px;
        color: var(--primary-color);
        flex-shrink: 0;
      }

      .sensor-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .sensor-label {
        font-size: 10px;
        color: var(--secondary-text-color);
        font-weight: 500;
      }

      .sensor-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--primary-text-color);
      }

      .compact .entity-chip {
        padding: 4px 10px 4px 8px;
        font-size: 12px;
        border-radius: 20px;
      }

      .compact .sensor-chip {
        padding: 4px 8px;
        font-size: 11px;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'smartbed-sensor-row': SensorRow;
  }
}
