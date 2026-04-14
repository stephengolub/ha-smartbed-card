import { LitElement, html, svg, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { BedCovers, HomeAssistant } from '../types';

/**
 * Realistic side-profile SVG bed visualization.
 *
 * The bed is viewed from the right side, head at left, feet at right.
 * The mattress is divided into:
 *   - Head section  (left)  — rotates 0→-55° on Z axis at pivot point (left edge of head section)
 *   - Foot section  (right) — rotates 0→+40° on Z axis at pivot point (right edge of foot section)
 *
 * Position semantics (smartbed-mqtt cover):
 *   0 = fully flat (closed in HA cover terms)
 *   100 = fully raised (open in HA cover terms)
 */
@customElement('smartbed-bed-visualization')
export class BedVisualization extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @property({ attribute: false }) public covers: BedCovers = {};

  // ─── Position helpers ───────────────────────────────────────────────────────

  /** Returns cover position (0-100) or 0 if unknown */
  private _pos(entityId: string | undefined): number {
    if (!entityId || !this.hass) return 0;
    const state = this.hass.states[entityId];
    if (!state) return 0;
    const pos = state.attributes?.current_position ?? state.attributes?.position;
    return typeof pos === 'number' ? Math.max(0, Math.min(100, pos)) : 0;
  }

  // ─── Angle calculation ──────────────────────────────────────────────────────

  /** Head section rotation in degrees. 0 = flat, negative = raised (tilts up at left) */
  private get headAngle(): number {
    return -this._pos(this.covers.head) * 0.55; // 100% → -55°
  }

  /** Foot section rotation in degrees. 0 = flat, positive = raised (tilts up at right) */
  private get footAngle(): number {
    return this._pos(this.covers.feet) * 0.40; // 100% → +40°
  }

  /** Lumbar raise (0-1) for visual hint */
  private get lumbarRaise(): number {
    return this._pos(this.covers.lumbar) / 100;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  protected render() {
    const headDeg = this.headAngle;
    const footDeg = this.footAngle;
    const lumbar = this.lumbarRaise;

    return html`
      <div class="viz-container">
        ${this._renderSvg(headDeg, footDeg, lumbar)}
        <div class="viz-labels">
          ${this.covers.head ? html`<span class="pos-label head-label">${this._pos(this.covers.head)}%</span>` : ''}
          ${this.covers.feet ? html`<span class="pos-label foot-label">${this._pos(this.covers.feet)}%</span>` : ''}
        </div>
      </div>
    `;
  }

  private _renderSvg(headDeg: number, footDeg: number, _lumbar: number) {
    // SVG coordinate system: 400 wide × 180 tall, viewBox origin at top-left
    // Bed frame sits from x=10 to x=390, y=80 to y=160
    // Mattress top surface: y=60 to y=80 (20px thick mattress sections)

    // ── Key dimensions ──
    const FW = 400;   // frame width
    const FX = 10;    // frame left x
    const FY = 90;    // frame top y
    const FH = 65;    // frame height (underframe)
    const FRY = FY + FH; // frame bottom y = 155

    // Leg height
    const LH = 20;
    const LY = FRY;
    const LW = 12;

    // Mattress
    const MX = FX + 2;        // mattress left x (inside frame)
    const MRX = FX + FW - 2;  // mattress right x
    const MW = MRX - MX;      // total mattress width
    const MY = FY - 30;       // mattress top y (resting on frame)
    const MH = 32;             // mattress height (thickness)

    // Section split: head = 45% of width, foot = 40%, middle = 15%
    const HEAD_W = MW * 0.45;
    const FOOT_W = MW * 0.40;
    const MID_W  = MW - HEAD_W - FOOT_W;

    // Head section pivot: bottom-right corner of head section
    const HEAD_PIV_X = MX + HEAD_W;
    const HEAD_PIV_Y = MY + MH;

    // Foot section pivot: bottom-left corner of foot section
    const FOOT_PIV_X = MRX - FOOT_W;
    const FOOT_PIV_Y = MY + MH;

    // Headboard
    const HB_X  = FX;
    const HB_Y  = FY - 60;
    const HB_W  = 22;
    const HB_H  = FH + 60;

    return html`
      <svg
        viewBox="0 0 420 200"
        xmlns="http://www.w3.org/2000/svg"
        class="bed-svg"
        aria-label="Bed position visualization"
        role="img"
      >
        <defs>
          <!-- Fabric texture gradient for mattress -->
          <linearGradient id="mattressGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--smartbed-mattress-top, #e8e0d8)" />
            <stop offset="100%" stop-color="var(--smartbed-mattress-bot, #c8bdb0)" />
          </linearGradient>
          <!-- Darker accent for mattress sides -->
          <linearGradient id="mattressSideGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--smartbed-mattress-side-top, #c8bdb0)" />
            <stop offset="100%" stop-color="var(--smartbed-mattress-side-bot, #a89880)" />
          </linearGradient>
          <!-- Frame gradient -->
          <linearGradient id="frameGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--smartbed-frame-top, #7a6a5a)" />
            <stop offset="100%" stop-color="var(--smartbed-frame-bot, #4a3c30)" />
          </linearGradient>
          <!-- Headboard gradient -->
          <linearGradient id="headboardGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="var(--smartbed-headboard-dark, #3a2c20)" />
            <stop offset="60%" stop-color="var(--smartbed-headboard-mid, #6a5040)" />
            <stop offset="100%" stop-color="var(--smartbed-headboard-light, #8a7060)" />
          </linearGradient>
          <!-- Pillow gradient -->
          <linearGradient id="pillowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--smartbed-pillow-top, #f0ece8)" />
            <stop offset="100%" stop-color="var(--smartbed-pillow-bot, #d8d0c8)" />
          </linearGradient>
          <!-- Active position highlight -->
          <linearGradient id="activeHeadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--smartbed-active-top, #b0c8e8)" />
            <stop offset="100%" stop-color="var(--smartbed-active-bot, #8aaed0)" />
          </linearGradient>
          <linearGradient id="activeFootGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--smartbed-active-top, #b0c8e8)" />
            <stop offset="100%" stop-color="var(--smartbed-active-bot, #8aaed0)" />
          </linearGradient>

          <!-- Clip for foot section to avoid overlap with frame -->
          <clipPath id="frameClip">
            <rect x="${FX}" y="${FY - 80}" width="${FW}" height="${FH + 80}" />
          </clipPath>
        </defs>

        <!-- ── Bed legs ── -->
        ${svg`
          <rect x="${FX + 15}" y="${LY}" width="${LW}" height="${LH}" rx="3" fill="url(#frameGrad)" />
          <rect x="${FX + FW - 15 - LW}" y="${LY}" width="${LW}" height="${LH}" rx="3" fill="url(#frameGrad)" />
        `}

        <!-- ── Bed frame / base ── -->
        ${svg`
          <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" rx="6"
            fill="url(#frameGrad)" stroke="var(--smartbed-frame-stroke, #2e2018)" stroke-width="1.5" />
          <!-- Frame top edge highlight -->
          <rect x="${FX + 2}" y="${FY}" width="${FW - 4}" height="4" rx="2"
            fill="var(--smartbed-frame-highlight, #9a8a7a)" opacity="0.5" />
        `}

        <!-- ── Headboard ── -->
        ${svg`
          <!-- Headboard body -->
          <rect x="${HB_X}" y="${HB_Y}" width="${HB_W}" height="${HB_H}" rx="4"
            fill="url(#headboardGrad)" stroke="var(--smartbed-frame-stroke, #2e2018)" stroke-width="1.5" />
          <!-- Headboard decorative panel top -->
          <rect x="${HB_X + 3}" y="${HB_Y + 6}" width="${HB_W - 6}" height="${HB_H * 0.55}" rx="3"
            fill="none" stroke="var(--smartbed-headboard-panel, #8a7060)" stroke-width="1" opacity="0.6" />
          <!-- Headboard decorative panel bottom -->
          <rect x="${HB_X + 3}" y="${HB_Y + 6 + HB_H * 0.55 + 4}" width="${HB_W - 6}" height="${HB_H * 0.3}" rx="3"
            fill="none" stroke="var(--smartbed-headboard-panel, #8a7060)" stroke-width="1" opacity="0.6" />
        `}

        <!-- ── Middle mattress section (always flat) ── -->
        ${svg`
          <rect x="${MX + HEAD_W}" y="${MY}" width="${MID_W}" height="${MH}"
            fill="url(#mattressGrad)" stroke="var(--smartbed-mattress-stroke, #a09080)" stroke-width="1" />
          <!-- Mattress side face -->
          <rect x="${MX + HEAD_W}" y="${MY + MH - 6}" width="${MID_W}" height="6"
            fill="url(#mattressSideGrad)" stroke="var(--smartbed-mattress-stroke, #a09080)" stroke-width="0.5" />
          <!-- Mattress ticking lines (decorative) -->
          ${[0.25, 0.5, 0.75].map(
            (t) => svg`<line
              x1="${MX + HEAD_W + MID_W * t}" y1="${MY + 4}"
              x2="${MX + HEAD_W + MID_W * t}" y2="${MY + MH - 8}"
              stroke="var(--smartbed-mattress-ticking, #b8aa9a)" stroke-width="0.5" opacity="0.5"
            />`,
          )}
        `}

        <!-- ── Head mattress section (animated) ── -->
        <g transform="rotate(${headDeg}, ${HEAD_PIV_X}, ${HEAD_PIV_Y})">
          ${svg`
            <!-- Mattress padding top -->
            <rect x="${MX}" y="${MY}" width="${HEAD_W}" height="${MH}"
              fill="${Math.abs(headDeg) > 2 ? 'url(#activeHeadGrad)' : 'url(#mattressGrad)'}"
              stroke="var(--smartbed-mattress-stroke, #a09080)" stroke-width="1"
            />
            <!-- Mattress side face (bottom edge, shows depth) -->
            <rect x="${MX}" y="${MY + MH - 6}" width="${HEAD_W}" height="6"
              fill="url(#mattressSideGrad)" stroke="var(--smartbed-mattress-stroke, #a09080)" stroke-width="0.5" />
            <!-- Ticking lines -->
            ${[0.2, 0.4, 0.6, 0.8].map(
              (t) => svg`<line
                x1="${MX + HEAD_W * t}" y1="${MY + 4}"
                x2="${MX + HEAD_W * t}" y2="${MY + MH - 8}"
                stroke="var(--smartbed-mattress-ticking, #b8aa9a)" stroke-width="0.5" opacity="0.5"
              />`,
            )}
            <!-- Pillow -->
            <rect x="${MX + 8}" y="${MY - 14}" width="${HEAD_W * 0.7}" height="14" rx="5"
              fill="url(#pillowGrad)" stroke="var(--smartbed-pillow-stroke, #c8c0b8)" stroke-width="1"
            />
            <!-- Pillow shadow -->
            <rect x="${MX + 10}" y="${MY - 2}" width="${HEAD_W * 0.7 - 4}" height="4" rx="2"
              fill="var(--smartbed-pillow-shadow, #c0b8b0)" opacity="0.4"
            />
          `}
        </g>

        <!-- ── Foot mattress section (animated) ── -->
        <g transform="rotate(${-footDeg}, ${FOOT_PIV_X}, ${FOOT_PIV_Y})">
          ${svg`
            <rect x="${FOOT_PIV_X}" y="${MY}" width="${FOOT_W}" height="${MH}"
              fill="${Math.abs(footDeg) > 2 ? 'url(#activeFootGrad)' : 'url(#mattressGrad)'}"
              stroke="var(--smartbed-mattress-stroke, #a09080)" stroke-width="1"
            />
            <!-- Mattress side face -->
            <rect x="${FOOT_PIV_X}" y="${MY + MH - 6}" width="${FOOT_W}" height="6"
              fill="url(#mattressSideGrad)" stroke="var(--smartbed-mattress-stroke, #a09080)" stroke-width="0.5" />
            <!-- Ticking -->
            ${[0.25, 0.5, 0.75].map(
              (t) => svg`<line
                x1="${FOOT_PIV_X + FOOT_W * t}" y1="${MY + 4}"
                x2="${FOOT_PIV_X + FOOT_W * t}" y2="${MY + MH - 8}"
                stroke="var(--smartbed-mattress-ticking, #b8aa9a)" stroke-width="0.5" opacity="0.5"
              />`,
            )}
          `}
        </g>

        <!-- ── Footboard (subtle) ── -->
        ${svg`
          <rect x="${FX + FW - 10}" y="${FY - 20}" width="10" height="${FH + 20}" rx="3"
            fill="url(#headboardGrad)" stroke="var(--smartbed-frame-stroke, #2e2018)" stroke-width="1" />
        `}

        <!-- ── Ground shadow ── -->
        ${svg`
          <ellipse cx="${FX + FW / 2}" cy="${LY + LH + 4}" rx="${FW * 0.45}" ry="5"
            fill="var(--smartbed-shadow, rgba(0,0,0,0.15))" />
        `}
      </svg>
    `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        /* Override these CSS custom properties to theme the bed */
        --smartbed-mattress-top: #e8e0d8;
        --smartbed-mattress-bot: #c8bdb0;
        --smartbed-mattress-side-top: #c8bdb0;
        --smartbed-mattress-side-bot: #a89880;
        --smartbed-mattress-stroke: #a09080;
        --smartbed-mattress-ticking: #b8aa9a;
        --smartbed-frame-top: #7a6a5a;
        --smartbed-frame-bot: #4a3c30;
        --smartbed-frame-stroke: #2e2018;
        --smartbed-frame-highlight: #9a8a7a;
        --smartbed-headboard-dark: #3a2c20;
        --smartbed-headboard-mid: #6a5040;
        --smartbed-headboard-light: #8a7060;
        --smartbed-headboard-panel: #8a7060;
        --smartbed-pillow-top: #f0ece8;
        --smartbed-pillow-bot: #d8d0c8;
        --smartbed-pillow-stroke: #c8c0b8;
        --smartbed-pillow-shadow: #c0b8b0;
        --smartbed-active-top: #b0c8e8;
        --smartbed-active-bot: #8aaed0;
        --smartbed-shadow: rgba(0, 0, 0, 0.15);
      }

      .viz-container {
        position: relative;
        width: 100%;
        padding: 8px 0 4px;
      }

      .bed-svg {
        width: 100%;
        height: auto;
        /* CSS transitions on SVG transform for smooth animation */
        --transition-duration: 0.6s;
        --transition-easing: cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }

      /* Animate all g[transform] transitions inside the SVG */
      .bed-svg g[transform] {
        transition: transform var(--transition-duration) var(--transition-easing);
      }

      .viz-labels {
        display: flex;
        justify-content: space-between;
        padding: 0 20px;
        margin-top: -4px;
      }

      .pos-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--secondary-text-color);
        letter-spacing: 0.5px;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'smartbed-bed-visualization': BedVisualization;
  }
}
