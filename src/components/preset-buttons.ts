import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { HomeAssistant } from 'custom-card-helpers';
import type { NamedEntity } from '../types';

/** Icon mapping for common preset names (matched against entity_id slug) */
const PRESET_ICONS: Array<[RegExp, string]> = [
  [/flat/, 'mdi:bed-outline'],
  [/zero_g|zero_gravity/, 'mdi:astronaut'],
  [/anti_snore|snore/, 'mdi:sleep-off'],
  [/tv|television/, 'mdi:television'],
  [/lounge/, 'mdi:sofa'],
  [/memory_?[12345]/, 'mdi:heart'],
  [/user_fav|favourite|favorite/, 'mdi:star'],
  [/wake_up|rise/, 'mdi:weather-sunset-up'],
  [/sleep/, 'mdi:sleep'],
  [/relax/, 'mdi:leaf'],
  [/unwind/, 'mdi:waves'],
  [/program|prog/, 'mdi:pencil'],
];

function presetIcon(entityId: string): string {
  const slug = entityId.split('.')[1] ?? entityId;
  for (const [pattern, icon] of PRESET_ICONS) {
    if (pattern.test(slug)) return icon;
  }
  return 'mdi:gesture-tap-button';
}

/** Derive human-readable label from entity friendly_name or entity_id */
function presetLabel(entity: NamedEntity, hass: HomeAssistant): string {
  const state = hass.states[entity.entity_id];
  if (state?.attributes?.friendly_name) {
    const fn = state.attributes.friendly_name as string;
    // Strip device prefix — everything after the last ': ' or full name
    const colonIdx = fn.lastIndexOf(': ');
    return colonIdx >= 0 ? fn.slice(colonIdx + 2) : fn;
  }
  // Fall back to the slug portion after the device prefix
  const slug = entity.entity_id.split('.')[1] ?? entity.entity_id;
  const parts = slug.split('_');
  // Drop device name prefix (first N words matching known patterns)
  // Heuristic: find 'preset' or 'memory' keyword and take everything after
  const presetIdx = parts.findIndex((p) => p === 'preset' || p === 'memory' || p === 'zero' || p === 'anti');
  const relevant = presetIdx >= 0 ? parts.slice(presetIdx) : parts.slice(-3);
  return relevant
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

@customElement('smartbed-preset-buttons')
export class PresetButtons extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public presets: NamedEntity[] = [];
  @property({ attribute: false }) public programPresets: NamedEntity[] = [];
  @property({ type: Boolean }) public compact = false;
  @property({ type: Boolean }) public showProgram = false;

  private _pressButton(entityId: string): void {
    this.hass.callService('button', 'press', { entity_id: entityId });
  }

  protected render() {
    const presets = this.presets;
    const programs = this.showProgram ? this.programPresets : [];

    if (presets.length === 0 && programs.length === 0) return html``;

    return html`
      <div class="preset-section ${this.compact ? 'compact' : ''}">
        ${presets.length > 0
          ? html`
              <div class="preset-grid">
                ${presets.map((p) => this._renderButton(p, false))}
              </div>
            `
          : ''}
        ${programs.length > 0
          ? html`
              <div class="program-header">
                <ha-icon icon="mdi:pencil-outline"></ha-icon>
                <span>Program Presets</span>
              </div>
              <div class="preset-grid program-grid">
                ${programs.map((p) => this._renderButton(p, true))}
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _renderButton(entity: NamedEntity, isProgram: boolean) {
    const icon = presetIcon(entity.entity_id);
    const label = presetLabel(entity, this.hass);

    return html`
      <button
        class="preset-btn ${isProgram ? 'program-btn' : ''}"
        title="${label}"
        @click=${() => this._pressButton(entity.entity_id)}
      >
        <ha-icon class="preset-icon" .icon=${icon}></ha-icon>
        <span class="preset-label">${label}</span>
      </button>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }

      .preset-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .preset-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .program-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        margin-top: 4px;
      }

      .program-header ha-icon {
        --mdc-icon-size: 14px;
      }

      .preset-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        border: 1px solid var(--divider-color);
        border-radius: 12px;
        background: var(--card-background-color, var(--ha-card-background));
        color: var(--primary-text-color);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s, transform 0.1s, box-shadow 0.15s;
        min-width: 64px;
        font-family: inherit;
      }

      .preset-btn:hover {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
        border-color: var(--primary-color);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      .preset-btn:active {
        transform: scale(0.94);
        box-shadow: none;
      }

      .program-btn {
        border-style: dashed;
        opacity: 0.8;
      }

      .program-btn:hover {
        opacity: 1;
      }

      .preset-icon {
        --mdc-icon-size: 22px;
        pointer-events: none;
      }

      .preset-label {
        font-size: 11px;
        font-weight: 500;
        text-align: center;
        line-height: 1.2;
        pointer-events: none;
        max-width: 70px;
        word-break: break-word;
      }

      .compact .preset-btn {
        padding: 6px 10px;
        min-width: 52px;
        border-radius: 8px;
      }

      .compact .preset-icon {
        --mdc-icon-size: 18px;
      }

      .compact .preset-label {
        font-size: 10px;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'smartbed-preset-buttons': PresetButtons;
  }
}
