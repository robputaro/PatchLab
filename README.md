# PATCHLAB v0.4 — Routing + Prompt Intelligence

## Run locally

```bash
cd ~/Downloads/PATCHLAB_v0.4_ROUTING
python3 -m http.server 8081
```

Open `http://localhost:8081`.

## Deploy to Vercel

Upload the unzipped folder as a static project. There is no build command and no environment variable.

## Major changes

- Clickable output and input jacks
- Real routing changes to the audio engine
- Visible patch cables
- Click a cable or route pill to remove it
- Stackable module modifier buttons
- Multiple modifiers can remain active simultaneously
- Prompt interpretation for mood, genre, tempo, key, scale, density, rhythm, space, aggression, and movement
- Prompt analysis tags show what PATCHLAB actually understood
- Prompt terms change sequence density, BPM, scale, effects, modulation, routing, voices, and envelopes
- Existing sequencer, keyboard, mixer, randomize, mutate, save, export, and recording features remain

## Prompt examples

- `Dark industrial techno in F# minor at 132 BPM, heavy sub bass, metallic and glitchy`
- `Sparse ambient generative patch in D, slow, warm, drifting, no drums`
- `Bright shimmering major arpeggio, fast and wide with lots of chorus`
- `Minimal four on the floor techno, 126 BPM, short gate and deep bass`
