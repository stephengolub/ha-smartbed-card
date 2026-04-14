# smartbed-card

A Home Assistant custom Lovelace card for smart adjustable beds integrated via [smartbed-mqtt](https://github.com/richardhopton/smartbed-mqtt).

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/release/sgolub/smartbed-card.svg)](https://github.com/sgolub/smartbed-card/releases)

## Features

- **Auto-discovery** — pick your bed device; the card finds all its entities automatically
- **SVG visualization** — animated side-profile view showing head and foot angles
- **Position controls** — per-motor sliders with open/stop/close buttons
- **Preset buttons** — flat, zero-G, anti-snore, TV, lounge, memory positions, and more
- **Massage controls** — intensity sliders, mode select, and step buttons
- **Sensors & switches** — temperature, humidity, CO2, under-bed lights, safety lights, fan
- **Split bed support** — Left / Right / Both side tabs for dual-zone beds
- **Universal** — works with all 13 smartbed-mqtt bed types without bed-specific configuration
- **Visual editor** — configure everything through the HA dashboard UI

## Supported Beds

Works with all bed types supported by **smartbed-mqtt**:

| Type | Connection |
|------|-----------|
| Sleeptracker AI (Tempur Ergo, BeautyRest SmartMotion, Serta) | Cloud |
| ErgoWifi | Cloud |
| ErgoMotion | Local TCP |
| Logicdata | Local HTTP/UDP |
| Richmat (Sven & Son) | BLE |
| Linak | BLE |
| Solace | BLE |
| MotoSleep | BLE |
| Reverie | BLE |
| Leggett & Platt | BLE |
| Okimat | BLE |
| Keeson (Member's Mark, Purple, ErgoMotion) | BLE |
| Octo | BLE |

## Installation

### HACS (recommended)

1. Open HACS in Home Assistant
2. Click **Frontend** → **+ Explore & Download Repositories**
3. Search for **Smart Bed Card**
4. Click **Download**
5. Reload your browser

### Manual

1. Download `smartbed-card.js` from the [latest release](https://github.com/sgolub/smartbed-card/releases/latest)
2. Copy it to `config/www/smartbed-card.js`
3. Add a Lovelace resource:
   ```yaml
   resources:
     - url: /local/smartbed-card.js
       type: module
   ```

## Prerequisites

Install and configure [smartbed-mqtt](https://github.com/richardhopton/smartbed-mqtt) as a Home Assistant add-on. Your bed must appear as a device in **Settings → Devices & Services**.

## Configuration

### Visual Editor

1. Add a card and search for **Smart Bed Card**
2. Select your bed from the **Device** picker
3. Toggle sections on/off as needed

### YAML

```yaml
type: custom:smartbed-card
device_id: abc123def456          # required — HA device ID
name: Bedroom Bed                # optional — overrides device name
show_visualization: true         # SVG bed diagram (default: true)
show_controls: true              # position sliders (default: true)
show_presets: true               # preset buttons (default: true)
show_program_presets: false      # program/save buttons (default: false)
show_massage: true               # massage controls (default: true)
show_sensors: true               # sensors, switches, lights (default: true)
compact: false                   # compact layout (default: false)
```

### Finding the Device ID

1. Go to **Settings → Devices & Services → Devices**
2. Find your bed device and click it
3. The device ID is in the URL: `.../config/devices/device/YOUR_DEVICE_ID`

## Development

```bash
git clone https://github.com/sgolub/smartbed-card
cd smartbed-card
npm install

npm run build          # production build → dist/smartbed-card.js
npm run start          # watch mode for development
npm test               # run vitest unit tests
```

### Serving during development

Copy `dist/smartbed-card.js` to your HA `config/www/` folder, or use the HA devcontainer workflow. Add as a resource pointing to `/local/smartbed-card.js`.

## Architecture

```
src/
├── smartbed-card.ts         # Main card element
├── editor.ts                # Visual config editor
├── entity-discovery.ts      # Device registry queries + entity classification
├── types.ts                 # TypeScript interfaces
├── const.ts                 # Constants
└── components/
    ├── bed-visualization.ts # Animated SVG bed diagram
    ├── position-controls.ts # Cover sliders + motor buttons
    ├── preset-buttons.ts    # Preset + program preset buttons
    ├── massage-controls.ts  # Massage intensity/mode/step controls
    └── sensor-row.ts        # Sensors, switches, lights, selects
```

## Contributing

Pull requests welcome. Please run `npm test` and `npm run build` before submitting.

## License

MIT
