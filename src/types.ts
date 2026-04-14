import { LovelaceCardConfig, ActionConfig } from 'custom-card-helpers';
import { HomeAssistant } from 'custom-card-helpers';

export { HomeAssistant };

declare global {
  interface HTMLElementTagNameMap {
    'smartbed-card-editor': HTMLElement;
  }
}

// ─── Card Configuration ───────────────────────────────────────────────────────

export interface SmartbedCardConfig extends LovelaceCardConfig {
  type: string;
  device_id?: string;
  name?: string;
  show_visualization?: boolean;
  show_presets?: boolean;
  show_program_presets?: boolean;
  show_massage?: boolean;
  show_sensors?: boolean;
  show_controls?: boolean;
  compact?: boolean;
  tap_action?: ActionConfig;
}

export const DEFAULT_CONFIG: Partial<SmartbedCardConfig> = {
  show_visualization: true,
  show_presets: true,
  show_program_presets: false,
  show_massage: true,
  show_sensors: true,
  show_controls: true,
  compact: false,
};

// ─── Entity Discovery Types ───────────────────────────────────────────────────

/** Slots for positional cover (motor) entities */
export interface BedCovers {
  head?: string;
  feet?: string;
  tilt?: string;
  lumbar?: string;
  pillow?: string;
  legs?: string;
  back?: string;
  all?: string;
  lift?: string;
}

/** A named entity reference */
export interface NamedEntity {
  entity_id: string;
  name: string;
}

/** A named slider entity with min/max */
export interface SliderEntity extends NamedEntity {
  min: number;
  max: number;
}

/** Massage-related entities */
export interface MassageEntities {
  sliders: SliderEntity[];
  steppers: NamedEntity[];
  mode?: NamedEntity; // select entity
}

/** Sensor entity reference */
export interface SensorEntity extends NamedEntity {
  unit?: string;
  device_class?: string;
}

/** All classified entities for one side (or for single-side beds) */
export interface BedEntities {
  covers: BedCovers;
  presets: NamedEntity[];
  programPresets: NamedEntity[];
  massage: MassageEntities;
  sensors: SensorEntity[];
  switches: NamedEntity[];
  lights: NamedEntity[];
  selects: NamedEntity[];
}

/** The full discovery result */
export interface DiscoveredBed {
  entities: BedEntities;
  isSplit: boolean;
  left?: BedEntities;
  right?: BedEntities;
}

/** Raw entity from HA device registry */
export interface RegistryEntity {
  entity_id: string;
  device_id: string | null;
  name?: string | null;
  original_name?: string | null;
  platform?: string;
  disabled_by?: string | null;
  hidden_by?: string | null;
}
