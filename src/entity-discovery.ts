import type { HomeAssistant } from 'custom-card-helpers';
import type {
  RegistryEntity,
  BedEntities,
  BedCovers,
  NamedEntity,
  SliderEntity,
  SensorEntity,
  DiscoveredBed,
} from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** All motor slot names that map to cover entities */
export const COVER_SLOTS = ['head', 'feet', 'tilt', 'lumbar', 'pillow', 'legs', 'back', 'all', 'lift'] as const;
export type CoverSlot = (typeof COVER_SLOTS)[number];

/** Sensor entity_id suffixes that are diagnostic/internal — exclude from display */
const EXCLUDED_SENSOR_SUFFIXES = ['device_info', 'hello_data', 'sleep_sensor'];

/** Suffixes that indicate a side-qualified entity */
const SIDE_SUFFIXES = ['__left', '__right'] as const;

// ─── Side detection ───────────────────────────────────────────────────────────

/**
 * Returns the side ('left' | 'right') from an entity_id suffix, or null.
 * smartbed-mqtt appends ": Left"/": Right" which safeId converts to __left/__right.
 */
export function extractSide(entity_id: string): 'left' | 'right' | null {
  if (entity_id.endsWith('__left')) return 'left';
  if (entity_id.endsWith('__right')) return 'right';
  return null;
}

/**
 * Returns true if any entity in the list has a side suffix (__left or __right),
 * indicating this is a split-zone bed.
 */
export function detectSplit(entities: RegistryEntity[]): boolean {
  return entities.some((e) => SIDE_SUFFIXES.some((s) => e.entity_id.endsWith(s)));
}

// ─── Slug helpers ─────────────────────────────────────────────────────────────

/** Strip domain prefix from entity_id → slug (e.g. "cover.bedroom_bed_head" → "bedroom_bed_head") */
function slug(entity_id: string): string {
  return entity_id.split('.').slice(1).join('.');
}

/** Strip device prefix from slug → tag (e.g. "bedroom_bed_head" → "head") */
function tag(entity_id: string, devicePrefix: string): string {
  const s = slug(entity_id);
  return s.startsWith(devicePrefix + '_') ? s.slice(devicePrefix.length + 1) : s;
}

/** Strip side suffix from a tag */
function stripSide(t: string): string {
  for (const s of SIDE_SUFFIXES) {
    if (t.endsWith(s)) return t.slice(0, t.length - s.length);
  }
  return t;
}

/** Human-readable label from an entity_id tag */
function labelFromTag(t: string): string {
  return t
    .replace(/__+/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function nameFor(entity: RegistryEntity, devicePrefix: string): string {
  const t = stripSide(tag(entity.entity_id, devicePrefix));
  return labelFromTag(t);
}

// ─── Domain extractor ─────────────────────────────────────────────────────────

function domain(entity_id: string): string {
  return entity_id.split('.')[0];
}

// ─── Preset detection ─────────────────────────────────────────────────────────

/**
 * A button entity is a "preset" if its tag (after stripping device prefix and side)
 * starts with "preset__" or is a known memory/position preset keyword.
 */
const PRESET_PATTERNS = ['preset__', 'memory_', 'zero_g', 'anti_snore', 'flat', 'tv', 'lounge', 'unwind', 'relax', 'sleep', 'wake_up', 'rise', 'decline'];
const PROGRAM_PATTERNS = ['program__', 'program_memory', 'program_zero', 'program_anti', 'program_tv'];
const MASSAGE_STEP_PATTERNS = ['massage_step', 'massage_up', 'massage_down', 'massage_off', 'massage_toggle', 'massage_stop', 'massage_mode_step', 'massage_pattern_step', 'massage_timer_step', 'massage_all'];

function isPresetButton(t: string): boolean {
  const stripped = stripSide(t);
  // Exclude massage-related buttons
  if (MASSAGE_STEP_PATTERNS.some((p) => stripped.includes(p))) return false;
  // Exclude program presets
  if (PROGRAM_PATTERNS.some((p) => stripped.startsWith(p))) return false;
  return PRESET_PATTERNS.some((p) => stripped.startsWith(p) || stripped === p);
}

function isProgramPreset(t: string): boolean {
  const stripped = stripSide(t);
  return PROGRAM_PATTERNS.some((p) => stripped.startsWith(p));
}

function isMassageStepper(t: string): boolean {
  const stripped = stripSide(t);
  return MASSAGE_STEP_PATTERNS.some((p) => stripped.includes(p));
}

// ─── Cover slot detection ─────────────────────────────────────────────────────

function coverSlot(t: string): CoverSlot | null {
  const base = stripSide(t);
  // Direct match first
  for (const slot of COVER_SLOTS) {
    if (base === slot) return slot as CoverSlot;
  }
  // Prefix match (e.g. "head_1" would not match but "head" exactly does)
  // Logicdata uses "back" for head motor and "legs" for foot motor
  return null;
}

// ─── Sensor filtering ─────────────────────────────────────────────────────────

function isDisplayableSensor(entity_id: string, devicePrefix: string): boolean {
  const t = tag(entity_id, devicePrefix);
  const base = stripSide(t);
  return !EXCLUDED_SENSOR_SUFFIXES.some((suffix) => base === suffix || base.endsWith('_' + suffix));
}

// ─── Main classifier ──────────────────────────────────────────────────────────

/**
 * Classify a flat list of RegistryEntity objects (pre-filtered to a single device)
 * into typed entity slots. All entities regardless of side are included here;
 * for split beds call this separately per side after filtering.
 *
 * @param entities - flat list of device entities
 * @param devicePrefix - safeId(device.name) prefix, e.g. "bedroom_bed"
 */
export function classifyEntities(entities: RegistryEntity[], devicePrefix: string): BedEntities {
  const covers: BedCovers = {};
  const presets: NamedEntity[] = [];
  const programPresets: NamedEntity[] = [];
  const massageSliders: SliderEntity[] = [];
  const massageSteppers: NamedEntity[] = [];
  let massageMode: string | undefined;
  const sensors: SensorEntity[] = [];
  const switches: NamedEntity[] = [];
  const lights: NamedEntity[] = [];
  const selects: NamedEntity[] = [];

  for (const entity of entities) {
    const { entity_id } = entity;
    const d = domain(entity_id);
    const t = tag(entity_id, devicePrefix);
    const name = nameFor(entity, devicePrefix);

    switch (d) {
      case 'cover': {
        const slot = coverSlot(t);
        if (slot) {
          covers[slot] = entity_id;
        }
        break;
      }

      case 'button': {
        if (isProgramPreset(t)) {
          programPresets.push({ entity_id, name });
        } else if (isMassageStepper(t)) {
          massageSteppers.push({ entity_id, name });
        } else if (isPresetButton(t)) {
          presets.push({ entity_id, name });
        }
        break;
      }

      case 'number': {
        // All number entities are massage sliders
        massageSliders.push({ entity_id, name, min: 0, max: 10 });
        break;
      }

      case 'select': {
        const base = stripSide(t);
        if (base.includes('massage_mode') || base.includes('massage_wave')) {
          massageMode = entity_id;
        } else {
          selects.push({ entity_id, name });
        }
        break;
      }

      case 'sensor': {
        if (isDisplayableSensor(entity_id, devicePrefix)) {
          sensors.push({ entity_id, name });
        }
        break;
      }

      case 'switch': {
        switches.push({ entity_id, name });
        break;
      }

      case 'light': {
        lights.push({ entity_id, name });
        break;
      }

      // binary_sensor: skip (typically not user-interactive)
    }
  }

  return {
    covers,
    presets,
    programPresets,
    massage: {
      sliders: massageSliders,
      steppers: massageSteppers,
      mode: massageMode,
    },
    sensors,
    switches,
    lights,
    selects,
  };
}

// ─── Split-aware classification ───────────────────────────────────────────────

/**
 * Filter entities to one side (left/right) OR to shared entities (no side suffix).
 * Covers are never side-qualified even on split beds — they go into both sides.
 */
function filterForSide(entities: RegistryEntity[], side: 'left' | 'right'): RegistryEntity[] {
  return entities.filter((e) => {
    const s = extractSide(e.entity_id);
    // If it has a side suffix, only include the matching side
    if (s !== null) return s === side;
    // If no side suffix: include covers always, exclude side-specific non-covers
    return true;
  });
}

/**
 * Full discovery: detects split, classifies entities per side if needed.
 */
export function discoverBed(entities: RegistryEntity[], devicePrefix: string): DiscoveredBed {
  const isSplit = detectSplit(entities);

  if (!isSplit) {
    return {
      entities: classifyEntities(entities, devicePrefix),
      isSplit: false,
    };
  }

  // For split beds: classify left and right separately
  const leftEntities = filterForSide(entities, 'left');
  const rightEntities = filterForSide(entities, 'right');

  return {
    entities: classifyEntities(entities, devicePrefix), // shared / all
    isSplit: true,
    left: classifyEntities(leftEntities, devicePrefix),
    right: classifyEntities(rightEntities, devicePrefix),
  };
}

// ─── HA WebSocket device registry query ──────────────────────────────────────

/** Minimal shape returned by HA's entity registry WS command */
interface HassRegistryEntityDisplay {
  ei: string;  // entity_id
  di: string;  // device_id
  pl: string;  // platform
  en?: string; // user-set name
  ai?: string; // area_id
  hn?: boolean; // hidden
  lb?: string[]; // labels
}

/**
 * Query HA's device registry and return all non-hidden entities for a device.
 */
export async function fetchDeviceEntities(
  hass: HomeAssistant,
  deviceId: string,
): Promise<RegistryEntity[]> {
  try {
    const result = await hass.callWS<HassRegistryEntityDisplay[]>({
      type: 'config/entity_registry/list_for_display',
    });

    return result
      .filter((e) => e.di === deviceId && !e.hn)
      .map((e) => ({
        entity_id: e.ei,
        device_id: e.di,
        original_name: e.en,
        platform: e.pl,
      }));
  } catch {
    // Fallback: scan hass.states for entities matching device
    return Object.keys(hass.states)
      .filter((eid) => {
        const s = hass.states[eid];
        return s?.attributes?.device_id === deviceId;
      })
      .map((eid) => ({
        entity_id: eid,
        device_id: deviceId,
      }));
  }
}

/**
 * Extract the device prefix (safeId(device.name)) from a set of known entity_ids.
 * Strategy: look at the slug of the first cover entity and strip known slot names.
 * Falls back to stripping common suffix patterns.
 */
export function inferDevicePrefix(entities: RegistryEntity[]): string {
  // Find a cover entity and strip the slot name
  const cover = entities.find((e) => domain(e.entity_id) === 'cover');
  if (cover) {
    const s = slug(cover.entity_id);
    for (const slot of COVER_SLOTS) {
      if (s.endsWith('_' + slot)) {
        return s.slice(0, s.length - slot.length - 1);
      }
    }
  }

  // Find a preset button and strip known preset patterns
  const preset = entities.find(
    (e) => domain(e.entity_id) === 'button' && slug(e.entity_id).includes('preset__'),
  );
  if (preset) {
    const s = slug(preset.entity_id);
    const idx = s.indexOf('_preset__');
    if (idx > 0) return s.slice(0, idx);
  }

  // Last resort: use the slug of the first entity stripped of its last word
  if (entities.length > 0) {
    const s = slug(entities[0].entity_id);
    const parts = s.split('_');
    return parts.slice(0, -1).join('_');
  }

  return '';
}
