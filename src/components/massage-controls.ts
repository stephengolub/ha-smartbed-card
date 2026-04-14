import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant } from 'custom-card-helpers';
import type { MassageEntities, SliderEntity, NamedEntity } from '../types';

/** Derive human-readable label for a massage entity */
function massageLabel(entityId: string, hass: HomeAssistant): string {
  const state = hass.states[entityId];
  if (state?.attributes?.friendly_name) {
    const fn = state.attributes.friendly_name as string;
    const colonIdx = fn.lastIndexOf(': ');
    return colonIdx >= 0 ? fn.slice(colonIdx + 2) : fn;
  }
  const slug = entityId.split('.')[1] ?? entityId;
  // Remove device prefix — find massage keyword
  const parts = slug.split('_');
  const massIdx = parts.findIndex((p) => p === 'massage' || p === 'vibration');
  const relevant = massIdx >= 0 ? parts.slice(massIdx) : parts.slice(-3);
  return relevant
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/** Icon for massage steppers */
function stepperIcon(entityId: string): string {
  const slug = entityId.split('.')[1] ?? '';
  if (/head/.test(slug)) return 'mdi:head-cog';
  if (/foot|feet/.test(slug)) return 'mdi:foot-print';
  if (/lumbar/.test(slug)) return 'mdi:human';
  if (/stop/.test(slug)) return 'mdi:stop-circle';
  if (/toggle/.test(slug)) return 'mdi:toggle-switch';
  if (/mode/.test(slug)) return 'mdi:tune';
  if (/timer/.test(slug)) return 'mdi:timer';
  if (/wave/.test(slug)) return 'mdi:sine-wave';
  return 'mdi:vibrate';
}

@customElement('smartbed-massage-controls')
export class MassageControls extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public massage: MassageEntities = {
    steppers: [],
    sliders: [],
  };
  @property({ type: Boolean }) public compact = false;

  // Track local slider values to avoid feedback loops while dragging
  @state() private _localSliderValues: Record<string, number> = {};
  private _debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private _pressButton(entityId: string): void {
    this.hass.callService('button', 'press', { entity_id: entityId });
  }

  private _setNumber(entityId: string, value: number): void {
    const existing = this._debounceTimers.get(entityId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.hass.callService('number', 'set_value', {
        entity_id: entityId,
        value,
      });
      this._debounceTimers.delete(entityId);
    }, 200);
    this._debounceTimers.set(entityId, timer);
  }

  private _setSelect(entityId: string, option: string): void {
    this.hass.callService('select', 'select_option', {
      entity_id: entityId,
      option,
    });
  }

  private _getSliderValue(slider: SliderEntity): number {
    if (this._localSliderValues[slider.entity_id] !== undefined) {
      return this._localSliderValues[slider.entity_id];
    }
    const state = this.hass?.states[slider.entity_id];
    return parseFloat(state?.state ?? String(slider.min ?? 0));
  }

  protected render() {
    const { steppers, sliders, mode } = this.massage;

    if (steppers.length === 0 && sliders.length === 0 && !mode) return html``;

    return html`
      <div class="massage-controls ${this.compact ? 'compact' : ''}">
        ${sliders.length > 0 ? this._renderSliders(sliders) : ''}
        ${mode ? this._renderModeSelect(mode) : ''}
        ${steppers.length > 0 ? this._renderSteppers(steppers) : ''}
      </div>
    `;
  }

  private _renderSliders(sliders: SliderEntity[]) {
    return html`
      <div class="slider-group">
        ${sliders.map((slider) => {
          const value = this._getSliderValue(slider);
          const min = slider.min ?? 0;
          const max = slider.max ?? 10;
          const label = massageLabel(slider.entity_id, this.hass);

          return html`
            <div class="slider-row">
              <div class="slider-header">
                <ha-icon class="slider-icon" icon="mdi:vibrate"></ha-icon>
                <span class="slider-label">${label}</span>
                <span class="slider-value">${value}</span>
              </div>
              <input
                type="range"
                class="massage-slider"
                min="${min}"
                max="${max}"
                step="1"
                .value=${String(value)}
                @input=${(e: InputEvent) => {
                  const val = parseFloat((e.target as HTMLInputElement).value);
                  this._localSliderValues = { ...this._localSliderValues, [slider.entity_id]: val };
                  this._setNumber(slider.entity_id, val);
                }}
              />
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderModeSelect(mode: NamedEntity) {
    const state = this.hass?.states[mode.entity_id];
    if (!state) return html``;

    const options = (state.attributes?.options as string[]) ?? [];
    const current = state.state;
    const label = massageLabel(mode.entity_id, this.hass);

    return html`
      <div class="mode-row">
        <ha-icon class="mode-icon" icon="mdi:tune"></ha-icon>
        <span class="mode-label">${label}</span>
        <ha-select
          class="mode-select"
          .value=${current}
          @change=${(e: Event) => {
            const val = (e.target as HTMLSelectElement).value;
            this._setSelect(mode.entity_id, val);
          }}
          @closed=${(e: Event) => e.stopPropagation()}
          naturalMenuWidth
        >
          ${options.map(
            (opt) => html`<mwc-list-item .value=${opt} ?selected=${opt === current}>${opt}</mwc-list-item>`,
          )}
        </ha-select>
      </div>
    `;
  }

  private _renderSteppers(steppers: NamedEntity[]) {
    return html`
      <div class="stepper-grid">
        ${steppers.map((stepper) => {
          const icon = stepperIcon(stepper.entity_id);
          const label = massageLabel(stepper.entity_id, this.hass);
          return html`
            <button
              class="stepper-btn"
              title="${label}"
              @click=${() => this._pressButton(stepper.entity_id)}
            >
              <ha-icon .icon=${icon}></ha-icon>
              <span>${label}</span>
            </button>
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

      .massage-controls {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* Sliders */
      .slider-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .slider-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .slider-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .slider-icon {
        --mdc-icon-size: 16px;
        color: var(--primary-color);
        flex-shrink: 0;
      }

      .slider-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
      }

      .slider-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--secondary-text-color);
        min-width: 24px;
        text-align: right;
      }

      .massage-slider {
        width: 100%;
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        border-radius: 2px;
        background: var(--secondary-background-color);
        outline: none;
        cursor: pointer;
      }

      .massage-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary-color);
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      .massage-slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--primary-color);
        cursor: pointer;
        border: none;
      }

      /* Mode select */
      .mode-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mode-icon {
        --mdc-icon-size: 18px;
        color: var(--primary-color);
        flex-shrink: 0;
      }

      .mode-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
      }

      .mode-select {
        min-width: 120px;
      }

      /* Steppers */
      .stepper-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .stepper-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 10px;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        font-family: inherit;
        font-size: 10px;
        font-weight: 500;
        transition: background 0.15s, transform 0.1s;
        min-width: 56px;
      }

      .stepper-btn:hover {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
        border-color: var(--primary-color);
      }

      .stepper-btn:active {
        transform: scale(0.93);
      }

      .stepper-btn ha-icon {
        --mdc-icon-size: 20px;
        pointer-events: none;
      }

      .stepper-btn span {
        pointer-events: none;
        text-align: center;
        max-width: 60px;
        word-break: break-word;
      }

      .compact .stepper-btn {
        padding: 6px 8px;
        font-size: 9px;
        min-width: 46px;
      }

      .compact .stepper-btn ha-icon {
        --mdc-icon-size: 16px;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'smartbed-massage-controls': MassageControls;
  }
}
