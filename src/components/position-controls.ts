import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HomeAssistant } from 'custom-card-helpers';
import type { BedCovers } from '../types';

/** Display label and icon for each motor slot */
const SLOT_META: Record<string, { label: string; icon: string }> = {
  head: { label: 'Head', icon: 'mdi:head' },
  lumbar: { label: 'Lumbar', icon: 'mdi:human' },
  tilt: { label: 'Tilt', icon: 'mdi:rotate-3d-variant' },
  feet: { label: 'Feet', icon: 'mdi:foot-print' },
  pillow: { label: 'Pillow', icon: 'mdi:pillow' },
  legs: { label: 'Legs', icon: 'mdi:human-handsdown' },
  back: { label: 'Back', icon: 'mdi:human' },
  lift: { label: 'Lift', icon: 'mdi:arrow-up-box' },
  all: { label: 'All', icon: 'mdi:bed' },
};

/** Ordered list for display */
const SLOT_ORDER = ['head', 'lumbar', 'tilt', 'pillow', 'feet', 'legs', 'back', 'lift', 'all'];

@customElement('smartbed-position-controls')
export class PositionControls extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public covers: BedCovers = {};
  @property({ type: Boolean }) public compact = false;

  private _debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private _getPosition(entityId: string): number {
    const state = this.hass?.states[entityId];
    const pos = state?.attributes?.current_position ?? state?.attributes?.position;
    return typeof pos === 'number' ? Math.round(pos) : 0;
  }

  private _getState(entityId: string): string {
    return this.hass?.states[entityId]?.state ?? 'unknown';
  }

  private _setPosition(entityId: string, position: number): void {
    // Clear existing debounce
    const existing = this._debounceTimers.get(entityId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.hass.callService('cover', 'set_cover_position', {
        entity_id: entityId,
        position,
      });
      this._debounceTimers.delete(entityId);
    }, 150);

    this._debounceTimers.set(entityId, timer);
  }

  private _openCover(entityId: string): void {
    this.hass.callService('cover', 'open_cover', { entity_id: entityId });
  }

  private _closeCover(entityId: string): void {
    this.hass.callService('cover', 'close_cover', { entity_id: entityId });
  }

  private _stopCover(entityId: string): void {
    this.hass.callService('cover', 'stop_cover', { entity_id: entityId });
  }

  protected render() {
    const activeSlots = SLOT_ORDER.filter(
      (slot) => this.covers[slot as keyof BedCovers] !== undefined,
    );

    if (activeSlots.length === 0) return html``;

    return html`
      <div class="position-controls ${this.compact ? 'compact' : ''}">
        ${activeSlots.map((slot) => this._renderSlot(slot, this.covers[slot as keyof BedCovers]!))}
      </div>
    `;
  }

  private _renderSlot(slot: string, entityId: string) {
    const meta = SLOT_META[slot] ?? { label: slot, icon: 'mdi:bed' };
    const pos = this._getPosition(entityId);
    const state = this._getState(entityId);
    const isMoving = state === 'opening' || state === 'closing';

    return html`
      <div class="slot-row">
        <div class="slot-header">
          <ha-icon class="slot-icon" .icon=${meta.icon}></ha-icon>
          <span class="slot-label">${meta.label}</span>
          <span class="slot-position ${isMoving ? 'moving' : ''}">${pos}%</span>
        </div>
        <div class="slot-controls">
          <input
            type="range"
            class="position-slider"
            min="0"
            max="100"
            step="1"
            .value=${String(pos)}
            @input=${(e: InputEvent) => {
              const val = parseInt((e.target as HTMLInputElement).value, 10);
              // Update position label immediately for responsiveness
              const label = (e.target as HTMLElement)
                .closest('.slot-row')
                ?.querySelector('.slot-position');
              if (label) label.textContent = `${val}%`;
              this._setPosition(entityId, val);
            }}
          />
          <div class="motor-buttons">
            <button
              class="motor-btn open-btn"
              title="Raise"
              @click=${() => this._openCover(entityId)}
            >
              <ha-icon icon="mdi:chevron-up"></ha-icon>
            </button>
            <button
              class="motor-btn stop-btn"
              title="Stop"
              @click=${() => this._stopCover(entityId)}
            >
              <ha-icon icon="mdi:stop"></ha-icon>
            </button>
            <button
              class="motor-btn close-btn"
              title="Lower"
              @click=${() => this._closeCover(entityId)}
            >
              <ha-icon icon="mdi:chevron-down"></ha-icon>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }

      .position-controls {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .compact .slot-row {
        gap: 4px;
      }

      .slot-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .slot-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .slot-icon {
        --mdc-icon-size: 18px;
        color: var(--state-cover-active-color, var(--primary-color));
        flex-shrink: 0;
      }

      .slot-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--primary-text-color);
        flex: 1;
      }

      .slot-position {
        font-size: 12px;
        font-weight: 600;
        color: var(--secondary-text-color);
        min-width: 36px;
        text-align: right;
        transition: color 0.2s;
      }

      .slot-position.moving {
        color: var(--primary-color);
      }

      .slot-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .position-slider {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 4px;
        border-radius: 2px;
        background: var(--slider-bg-color, var(--secondary-background-color));
        outline: none;
        cursor: pointer;
        --slider-progress: 0%;
        background: linear-gradient(
          to right,
          var(--primary-color) 0%,
          var(--primary-color) var(--slider-progress, 0%),
          var(--secondary-background-color) var(--slider-progress, 0%),
          var(--secondary-background-color) 100%
        );
      }

      .position-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--primary-color);
        cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
        transition: transform 0.1s ease;
      }

      .position-slider::-webkit-slider-thumb:hover {
        transform: scale(1.2);
      }

      .position-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--primary-color);
        cursor: pointer;
        border: none;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
      }

      .motor-buttons {
        display: flex;
        gap: 2px;
        flex-shrink: 0;
      }

      .motor-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 6px;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
        padding: 0;
      }

      .motor-btn:hover {
        background: var(--state-cover-active-color, var(--primary-color));
        color: white;
      }

      .motor-btn:active {
        transform: scale(0.92);
      }

      .stop-btn {
        --mdc-icon-size: 14px;
        background: var(--divider-color);
      }

      .stop-btn:hover {
        background: var(--error-color, #db4437);
        color: white;
      }

      ha-icon {
        --mdc-icon-size: 16px;
        pointer-events: none;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'smartbed-position-controls': PositionControls;
  }
}
