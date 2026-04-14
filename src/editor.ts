import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { fireEvent } from 'custom-card-helpers';
import type { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import type { SmartbedCardConfig } from './types';
import { CARD_EDITOR_NAME } from './const';

@customElement(CARD_EDITOR_NAME)
export class SmartbedCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: SmartbedCardConfig;
  @state() private _openSection = 'device';

  public setConfig(config: SmartbedCardConfig): void {
    this._config = { ...config };
  }

  protected render() {
    if (!this.hass || !this._config) return html`<div>Loading…</div>`;

    return html`
      <div class="editor">
        ${this._section(
          'device',
          'Device',
          'mdi:bed-queen',
          html`
            <ha-device-picker
              .hass=${this.hass}
              .value=${this._config.device_id ?? ''}
              label="Smart Bed Device"
              @value-changed=${(e: CustomEvent) => this._update('device_id', e.detail.value)}
            ></ha-device-picker>
            <ha-textfield
              label="Card Title (optional)"
              .value=${this._config.name ?? ''}
              @input=${(e: InputEvent) => this._update('name', (e.target as HTMLInputElement).value || undefined)}
              placeholder="Auto-detected from device"
            ></ha-textfield>
          `,
        )}
        ${this._section(
          'sections',
          'Sections',
          'mdi:view-list',
          html`
            ${this._toggle('show_visualization', 'Show bed visualization')}
            ${this._toggle('show_controls', 'Show position controls')}
            ${this._toggle('show_presets', 'Show preset buttons')}
            ${this._toggle('show_program_presets', 'Show program preset buttons')}
            ${this._toggle('show_massage', 'Show massage controls')}
            ${this._toggle('show_sensors', 'Show sensors & switches')}
          `,
        )}
        ${this._section(
          'appearance',
          'Appearance',
          'mdi:palette',
          html`
            ${this._toggle('compact', 'Compact layout')}
          `,
        )}
      </div>
    `;
  }

  private _section(id: string, title: string, icon: string, content: ReturnType<typeof html>) {
    const isOpen = this._openSection === id;
    return html`
      <div class="section ${isOpen ? 'open' : ''}">
        <button
          class="section-header"
          @click=${() => { this._openSection = isOpen ? '' : id; }}
          type="button"
        >
          <ha-icon .icon=${icon}></ha-icon>
          <span>${title}</span>
          <ha-icon .icon=${isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} class="chevron"></ha-icon>
        </button>
        <div class="section-body">
          <div class="section-content">${content}</div>
        </div>
      </div>
    `;
  }

  private _toggle(key: keyof SmartbedCardConfig, label: string) {
    const value = this._config[key] as boolean | undefined;
    return html`
      <ha-formfield .label=${label}>
        <ha-switch
          .checked=${value !== false}
          @change=${(e: Event) => this._update(key, (e.target as HTMLInputElement).checked)}
        ></ha-switch>
      </ha-formfield>
    `;
  }

  private _update<K extends keyof SmartbedCardConfig>(key: K, value: SmartbedCardConfig[K]): void {
    const config: SmartbedCardConfig = { ...this._config };
    if (value === undefined || value === '') {
      delete config[key];
    } else {
      config[key] = value;
    }
    this._config = config;
    fireEvent(this, 'config-changed', { config });
  }

  static get styles(): CSSResultGroup {
    return css`
      .editor {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .section {
        border: 1px solid var(--divider-color);
        border-radius: 10px;
        overflow: hidden;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 12px 14px;
        background: var(--secondary-background-color);
        border: none;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--primary-text-color);
        text-align: left;
        font-family: inherit;
        transition: background 0.15s;
      }

      .section-header:hover {
        background: var(--divider-color);
      }

      .section-header ha-icon {
        --mdc-icon-size: 18px;
        color: var(--primary-color);
        flex-shrink: 0;
      }

      .section-header span {
        flex: 1;
      }

      .chevron {
        --mdc-icon-size: 18px;
        color: var(--secondary-text-color) !important;
      }

      .open .section-header {
        border-bottom: 1px solid var(--divider-color);
      }

      .section-body {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.22s ease;
      }

      .open .section-body {
        grid-template-rows: 1fr;
      }

      .section-content {
        overflow: hidden;
        padding: 0 14px;
      }

      .open .section-content {
        padding: 14px;
      }

      ha-device-picker,
      ha-textfield,
      ha-formfield {
        display: block;
        margin-bottom: 12px;
      }

      ha-formfield:last-child {
        margin-bottom: 0;
      }

      ha-textfield {
        width: 100%;
      }
    `;
  }
}

// Safety registration
if (!customElements.get(CARD_EDITOR_NAME)) {
  customElements.define(CARD_EDITOR_NAME, SmartbedCardEditor);
}
