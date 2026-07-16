# Retro Clipper 📼

A retro-analog video clipper that runs **entirely in your browser**. Drop a video, auto-slice it into shorter moment-clips, and download real `.mp4` files. No upload, no backend, no API keys — powered by [ffmpeg.wasm](https://ffmpegwasm.netlify.app/).

Inspired by Opus and videodatabase.org, wrapped in a CRT/VHS aesthetic.

## Features
- Drag-drop or pick any video file (stays local)
- Auto-segment into 15s / 30s / 60s moments
- Canvas thumbnails per clip (no compute cost)
- Cut a single clip or "cut all", download as MP4
- Fully client-side, static deploy

## Run locally
```bash
npm install
npm run dev
```

## Deploy
Deploys to Vercel as a static site. `vercel.json` sets the COOP/COEP headers that ffmpeg.wasm requires (SharedArrayBuffer / cross-origin isolation) — without them, cutting silently fails.

## Roadmap
- **AI moment detection** — transcribe audio + pick highlight moments automatically (needs a backend). Currently time-based segmentation only.

Built with WOZCODE.
