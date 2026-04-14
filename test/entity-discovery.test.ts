import { describe, it, expect } from 'vitest';
import {
  classifyEntities,
  detectSplit,
  extractSide,
  COVER_SLOTS,
} from '../src/entity-discovery';
import type { RegistryEntity } from '../src/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEntity(entity_id: string, domain?: string): RegistryEntity {
  return {
    entity_id,
    device_id: 'test-device-id',
    original_name: entity_id.split('.')[1].replace(/_/g, ' '),
  };
}

function entities(...ids: string[]): RegistryEntity[] {
  return ids.map((id) => makeEntity(id));
}

// ─── Split detection ──────────────────────────────────────────────────────────

describe('detectSplit', () => {
  it('returns false when no entity has __left or __right suffix', () => {
    const ents = entities(
      'cover.bedroom_bed_head',
      'button.bedroom_bed_preset__flat',
    );
    expect(detectSplit(ents)).toBe(false);
  });

  it('returns true when an entity has __left suffix', () => {
    const ents = entities(
      'cover.bedroom_bed_head',
      'button.bedroom_bed_preset__flat__left',
      'button.bedroom_bed_preset__flat__right',
    );
    expect(detectSplit(ents)).toBe(true);
  });

  it('returns true when an entity has __right suffix', () => {
    const ents = entities('sensor.bedroom_bed_head_angle__right');
    expect(detectSplit(ents)).toBe(true);
  });
});

// ─── Side extraction ─────────────────────────────────────────────────────────

describe('extractSide', () => {
  it('returns null for entities without side suffix', () => {
    expect(extractSide('cover.bedroom_bed_head')).toBeNull();
  });

  it('returns "left" for __left suffix', () => {
    expect(extractSide('button.bedroom_bed_preset__flat__left')).toBe('left');
  });

  it('returns "right" for __right suffix', () => {
    expect(extractSide('button.bedroom_bed_preset__flat__right')).toBe('right');
  });
});

// ─── Cover slot classification ────────────────────────────────────────────────

describe('classifyEntities - covers', () => {
  it('classifies head cover', () => {
    const ents = entities('cover.bedroom_bed_head');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.head).toBe('cover.bedroom_bed_head');
  });

  it('classifies feet cover', () => {
    const ents = entities('cover.bedroom_bed_feet');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.feet).toBe('cover.bedroom_bed_feet');
  });

  it('classifies tilt cover', () => {
    const ents = entities('cover.bedroom_bed_tilt');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.tilt).toBe('cover.bedroom_bed_tilt');
  });

  it('classifies lumbar cover', () => {
    const ents = entities('cover.bedroom_bed_lumbar');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.lumbar).toBe('cover.bedroom_bed_lumbar');
  });

  it('classifies pillow cover', () => {
    const ents = entities('cover.bedroom_bed_pillow');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.pillow).toBe('cover.bedroom_bed_pillow');
  });

  it('classifies legs cover (Logicdata)', () => {
    const ents = entities('cover.bedroom_bed_legs');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.legs).toBe('cover.bedroom_bed_legs');
  });

  it('classifies back cover (Linak, Solace)', () => {
    const ents = entities('cover.bedroom_bed_back');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.back).toBe('cover.bedroom_bed_back');
  });

  it('classifies multiple covers', () => {
    const ents = entities(
      'cover.bedroom_bed_head',
      'cover.bedroom_bed_feet',
      'cover.bedroom_bed_lumbar',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.head).toBe('cover.bedroom_bed_head');
    expect(result.covers.feet).toBe('cover.bedroom_bed_feet');
    expect(result.covers.lumbar).toBe('cover.bedroom_bed_lumbar');
  });
});

// ─── Preset classification ────────────────────────────────────────────────────

describe('classifyEntities - presets', () => {
  it('classifies flat preset button', () => {
    const ents = entities('button.bedroom_bed_preset__flat');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0].entity_id).toBe('button.bedroom_bed_preset__flat');
  });

  it('classifies multiple presets', () => {
    const ents = entities(
      'button.bedroom_bed_preset__flat',
      'button.bedroom_bed_preset__zero_g',
      'button.bedroom_bed_preset__anti_snore',
      'button.bedroom_bed_preset__tv',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.presets).toHaveLength(4);
  });

  it('classifies program presets separately', () => {
    const ents = entities(
      'button.bedroom_bed_preset__flat',
      'button.bedroom_bed_program__flat',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.presets).toHaveLength(1);
    expect(result.programPresets).toHaveLength(1);
    expect(result.programPresets[0].entity_id).toBe('button.bedroom_bed_program__flat');
  });

  it('classifies memory presets as presets', () => {
    const ents = entities(
      'button.bedroom_bed_memory_1',
      'button.bedroom_bed_memory_2',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.presets).toHaveLength(2);
  });
});

// ─── Massage classification ───────────────────────────────────────────────────

describe('classifyEntities - massage', () => {
  it('classifies number entities as massage sliders', () => {
    const ents = entities(
      'number.bedroom_bed_head_massage',
      'number.bedroom_bed_foot_massage',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.massage.sliders).toHaveLength(2);
  });

  it('classifies massage step buttons as steppers', () => {
    const ents = entities(
      'button.bedroom_bed_head_massage_step',
      'button.bedroom_bed_foot_massage_step',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.massage.steppers).toHaveLength(2);
  });

  it('classifies massage mode select', () => {
    const ents = entities('select.bedroom_bed_massage_mode');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.massage.mode).toBeDefined();
    expect(result.massage.mode?.entity_id).toBe('select.bedroom_bed_massage_mode');
  });
});

// ─── Sensor classification ────────────────────────────────────────────────────

describe('classifyEntities - sensors', () => {
  it('classifies temperature sensor', () => {
    const ents = entities('sensor.bedroom_bed_temperature');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.sensors).toHaveLength(1);
    expect(result.sensors[0].entity_id).toBe('sensor.bedroom_bed_temperature');
  });

  it('excludes device_info sensor (diagnostic)', () => {
    const ents = entities('sensor.bedroom_bed_device_info');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.sensors).toHaveLength(0);
  });

  it('classifies angle sensors', () => {
    const ents = entities(
      'sensor.bedroom_bed_head_angle',
      'sensor.bedroom_bed_foot_angle',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.sensors).toHaveLength(2);
  });
});

// ─── Switch / light / select classification ───────────────────────────────────

describe('classifyEntities - controls', () => {
  it('classifies switch entities', () => {
    const ents = entities(
      'switch.bedroom_bed_safety_lights',
      'switch.bedroom_bed_fan_heating',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.switches).toHaveLength(2);
  });

  it('classifies light entities', () => {
    const ents = entities('light.bedroom_bed_under_bed_lights');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.lights).toHaveLength(1);
  });

  it('classifies select entities (fan speed)', () => {
    const ents = entities('select.bedroom_bed_fan_speed');
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.selects).toHaveLength(1);
    // fan speed is a select, not massage mode
    expect(result.massage.mode).toBeUndefined();
  });
});

// ─── Full Sleeptracker single-side scenario ───────────────────────────────────

describe('classifyEntities - full single-side scenario', () => {
  it('classifies a typical Sleeptracker single-side entity set', () => {
    const ents = entities(
      'cover.bedroom_bed_head',
      'cover.bedroom_bed_feet',
      'cover.bedroom_bed_tilt',
      'button.bedroom_bed_preset__flat',
      'button.bedroom_bed_preset__zero_g',
      'button.bedroom_bed_preset__anti_snore',
      'button.bedroom_bed_preset__tv',
      'button.bedroom_bed_head_massage_step',
      'button.bedroom_bed_foot_massage_step',
      'switch.bedroom_bed_safety_lights',
      'select.bedroom_bed_fan_speed',
      'sensor.bedroom_bed_temperature',
      'sensor.bedroom_bed_humidity',
      'sensor.bedroom_bed_device_info',
    );
    const result = classifyEntities(ents, 'bedroom_bed');
    expect(result.covers.head).toBeDefined();
    expect(result.covers.feet).toBeDefined();
    expect(result.covers.tilt).toBeDefined();
    expect(result.presets).toHaveLength(4);
    expect(result.massage.steppers).toHaveLength(2);
    expect(result.switches).toHaveLength(1);
    expect(result.selects).toHaveLength(1);
    expect(result.sensors).toHaveLength(2); // device_info excluded
  });
});

// ─── COVER_SLOTS export ───────────────────────────────────────────────────────

describe('COVER_SLOTS', () => {
  it('exports an array of known cover slot names', () => {
    expect(COVER_SLOTS).toContain('head');
    expect(COVER_SLOTS).toContain('feet');
    expect(COVER_SLOTS).toContain('tilt');
    expect(COVER_SLOTS).toContain('lumbar');
  });
});
