# Textbito no Uta (文字の詩)

A high-performance particle physics typography engine designed to render complex text streams over video timelines. The engine acts as a dynamic particle sandbox, using WebGL-inspired canvas routines (Float32Arrays + Morton Z-Order sorting) to cleanly manipulate over 5,000 real-time text nodes without Garbage Collection (GC) stutters.

Currently built to render entire chapters of the *Mushoku Tensei* web novel (in Japanese, English, and Arabic), algorithmically synchronizing reading speeds and particle densities seamlessly around dynamic video footage.

## Features

- **Multi-lingual Sandbox**: Dynamically hop between dense Japanese Kanji, English glyphs, and Arabic text streams on the fly without refreshing the page. The backend swaps internal typography matrices and memory arrays perfectly behind the scenes.
- **Fluid Displacement Algorithm**: Real-time soft-body physics. Characters naturally attract back to their grid constraints, but get violently repulsed by bright or noisy video pixels, simulating displacement.
- **Swarm Tracker Algorithm**: A secondary tracking sandbox. Boids (independent characters) detect zones of high density/brightness and physically rip themselves away from the grid to clump dynamically together, absorbing the target colors underneath them.
- **Fully Responsive / Mobile Friendly**: Calculates viewport width-height algorithms to perfectly letterbox 16:9 1080p rendering logic accurately on any device.

## Physics Controls (Settings Panel)

During playback, click or tap the bottom half of the screen to open the **Advanced Physics HUD**.

### Typography Pipeline
- **Theme/Language System**: Pick between `(JA)`, `(EN)`, `(AR)`. Immediately re-fetches the dataset and hot-swaps the underlying memory buffers cleanly. 
- **Font Family**: Bind custom desktop or Google Fonts to the matrices for immediate testing.
- **Typography Scale**: Manipulate the physical render size of every particle node.
- **Text Matrix Speed**: Adjust the scroll speed of the reading head when detached from the standard Video-duration Sync logic.

### Fluid Controls
- **Repulsion Force**: Determines the sheer kinetic energy particles absorb when hit by bright/loud video data pixels.
- **Displacement Radius**: Expands or tightens the area of effect around any target pixel pushing particles out of the way. 
- **Grid Elasticity & Fluid Friction**: Balances how violently particles whip back into their constrained 16:9 reading grid versus sliding out of control.
- **Shadow Drift**: Injects ambient "ocean-like" noise into areas of complete darkness so the particles aren't completely frozen even without video data.

### Swarm Controls
- **Snapping Spring**: The velocity at which the boids lock onto an active data node from the source material.
- **Color Bleed Rate**: Modulates how fast the text transitions from its default color into the underlying sampled video pixel color (from 0 instantly).
- **Minimum Density**: Ensures the screen never goes completely empty by mathematically preserving a core clump of particles tracking low-light scenes. 

## Installation

Textbito no Uta is a standard vanilla TypeScript project using Vite.

```bash
# 1. Install dependencies
npm install

# 2. Start the local dev server
npm run dev

# 3. Build for production deployment 
npm run build
```

## Adding Custom Data Streams

Files like `novel.txt`, `novel-en.txt`, and `novel-ar.txt` live in your `/public` folder. 
Simply copy/paste raw text into these `txt` files. The engine takes whatever characters you dump into those files, slices them letter-by-letter, and seamlessly pushes them through the particle engine.

*All ASCII characters, UTF-8 formats, Japanese Kanji, or complex Arabic ligatures are supported.*
