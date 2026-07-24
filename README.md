# PATCHLAB v1.0.1 — Multitrack Instrument

This build replaces the single master sequence with independent instrument tracks.

## Included tracks

- Lead
- Bass
- Kick
- Snare
- Hats
- Percussion

Each track has its own:

- 16-step pattern
- mute and solo state
- volume
- sound controls
- randomize and mutate behavior
- editable lane in the full arrangement

Lead and Bass use melodic editors. Drum tracks use dedicated rhythm grids.

## Mobile audio

Tap **ENABLE SOUND** before pressing play. Mobile Safari and Chrome require a user gesture before Web Audio can start.

## Deploy to Vercel

Upload the files directly at the project root:

- index.html
- styles.css
- app.js
- vercel.json

Use Framework Preset **Other**. Leave Build Command and Output Directory blank.

## v1.0.1 fix

Separated the audio scheduler step from the visual playhead step. This prevents the UI callback from resetting playback to beat one.
