import { LitElement, html, TemplateResult, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, fireEvent } from 'custom-card-helpers';

import { SmartbedCardConfig } from './types';
import { CARD_EDITOR_NAME } from './const';

@customElement(CARD_EDITOR_NAME)
export class SmartbedCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config?: SmartbedCardConfig;

  public setConfig(config: SmartbedCardConfig): void {
    this._config = { ...config };
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._config) return;

    return html`
      <div class="editor">
        <ha-device-picker
          .hass=${this.hass}
          .value=${this._config.device_id ?? ''}
          label="Bed Device"
          @value-changed=${this._deviceChanged}
        ></ha-device-picker>

        <ha-textfield
          label="Name (optional)"
          .value=${this._config.name ?? ''}
          .configValue=${'name'}
          @input=${this._valueChanged}
        ></ha-textfield>

        <div class="section-title">Sections</div>

        ${this._renderToggle('show_visualization', 'Show Bed Visualization')}
        ${this._renderToggle('show_presets', 'Show Preset Buttons')}
        ${this._renderToggle('show_massage', 'Show Massage Controls')}
        ${this._renderToggle('show_sensors', 'Show Sensors')}
        ${this._renderToggle('show_controls', 'Show Switches & Lights')}

        <div class="section-title">Appearance</div>

        ${this._renderToggle('compact', 'Compact Mode')}
      </div>
    `;
  }

  private _renderToggle(key: keyof SmartbedCardConfig, label: string): TemplateResult {
    return html`
      <ha-formfield label=${label}>
        <ha-switch
          .checked=${Boolean(this._config?.[key] ?? true)}
          .configValue=${key}
          @change=${this._valueChanged}
        ></ha-switch>
      </ha-formfield>
    `;
  }

  private _deviceChanged(ev: CustomEvent): void {
    if (!this._config) return;
    const newDeviceId = ev.detail.value;
    if (this._config.device_id === newDeviceId) return;
    this._config = { ...this._config, device_id: newDeviceId };
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _valueChanged(ev: Event): void {
    if (!this._config) return;
    const target = ev.target as HTMLElement & { configValue?: keyof SmartbedCardConfig; value?: string; checked?: boolean };
    if (!target.configValue) return;

    const newValue = target.checked !== undefined ? target.checked : target.value;
    if (this._config[target.configValue] === newValue) return;

    if (target.value === '') {
      const cfg = { ...this._config };
      delete cfg[target.configValue];
      this._config = cfg;
    } else {
      this._config = { ...this._config, [target.configValue]: newValue };
    }
    fireEvent(this, 'config-changed', { config: this._config });
  }

  static get styles() {
    return css`
      .editor {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      ha-device-picker,
      ha-textfield {
        display: block;
        margin-bottom: 12px;
      }

      .section-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 12px 0 4px;
      }

      ha-formfield {
        display: block;
        padding: 4px 0;
      }
    `;
  }
}
