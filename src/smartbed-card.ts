import { LitElement, html, TemplateResult, css, CSSResultGroup } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';

import { SmartbedCardConfig, DEFAULT_CONFIG } from './types';
import { CARD_VERSION, CARD_NAME, CARD_EDITOR_NAME } from './const';

console.info(
  `%c  SMARTBED-CARD \n%c  v${CARD_VERSION}    `,
  'color: #2196f3; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

interface WindowWithCustomCards extends Window {
  customCards: Array<{ type: string; name: string; description: string; preview?: boolean }>;
}

(window as unknown as WindowWithCustomCards).customCards =
  (window as unknown as WindowWithCustomCards).customCards || [];
(window as unknown as WindowWithCustomCards).customCards.push({
  type: CARD_NAME,
  name: 'Smart Bed Card',
  description: 'Interactive control card for smart beds via smartbed-mqtt',
  preview: false,
});

@customElement('smartbed-card')
export class SmartbedCard extends LitElement {
  public static async getConfigElement(): Promise<HTMLElement> {
    await import('./editor');
    return document.createElement(CARD_EDITOR_NAME);
  }

  public static getStubConfig(): Record<string, unknown> {
    return {};
  }

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: SmartbedCardConfig;

  public setConfig(config: SmartbedCardConfig): void {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public getCardSize(): number {
    return 4;
  }

  public getGridOptions() {
    return { columns: 6, rows: 3, min_columns: 3, min_rows: 2 };
  }

  protected render(): TemplateResult | void {
    if (!this.config) return;

    if (!this.config.device_id) {
      return html`
        <ha-card header="Smart Bed">
          <div class="card-content empty-state">
            <ha-icon icon="mdi:bed"></ha-icon>
            <p>Select a bed device in the card editor to get started.</p>
          </div>
        </ha-card>
      `;
    }

    const name = this.config.name ?? 'Smart Bed';

    return html`
      <ha-card header=${name}>
        <div class="card-content">
          <p>Device: ${this.config.device_id}</p>
          <p style="color: var(--secondary-text-color); font-size: 12px;">
            smartbed-card v${CARD_VERSION} — controls coming soon
          </p>
        </div>
      </ha-card>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      ha-card {
        overflow: hidden;
      }

      .card-content {
        padding: 16px;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        color: var(--secondary-text-color);
        text-align: center;
      }

      .empty-state ha-icon {
        --mdc-icon-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      .empty-state p {
        margin: 0;
        font-size: 14px;
      }
    `;
  }
}
