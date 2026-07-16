import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
let ffmpeg = null
let loaded = false

// @ffmpeg/ffmpeg always runs its worker as a module worker, so the core must be
// the ESM build (loaded via dynamic import, not importScripts). Using the UMD
// core here causes "failed to import ffmpeg-core.js".
const CORE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

export async function loadFFmpeg(onLog) {
  if (loaded) return ffmpeg
  ffmpeg = new FFmpeg()
  if (onLog) ffmpeg.on('log', ({ message }) => onLog(message))
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
  })
  loaded = true
  return ffmpeg
}

// Cut [start, start+dur) from file, return a Blob of the clip.
export async function cutSegment(file, start, dur) {
  const fm = await loadFFmpeg()
  const inName = 'in.mp4'
  const outName = 'out.mp4'
  await fm.writeFile(inName, await fetchFile(file))
  // Fast keyframe seek (-ss before -i) then re-encode for a frame-accurate cut.
  // Stream-copy (-c copy) snaps to keyframes and produces wrong clip lengths.
  await fm.exec([
    '-ss', String(start),
    '-i', inName,
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'ultrafast',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    outName,
  ])
  const data = await fm.readFile(outName)
  await fm.deleteFile(inName)
  await fm.deleteFile(outName)
  return new Blob([data.buffer], { type: 'video/mp4' })
}
