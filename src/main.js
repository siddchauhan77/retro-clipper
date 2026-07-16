import './style.css'
import { cutSegment } from './ffmpeg.js'

const $ = (id) => document.getElementById(id)

const state = {
  file: null,
  url: null,
  duration: 0,
  segLen: 15,
  segments: [], // { start, dur }
}

// ---- Upload ----
const dz = $('dropzone')
const fileInput = $('file-input')

$('pick-btn').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', (e) => e.target.files[0] && loadFile(e.target.files[0]))

;['dragenter', 'dragover'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag') }))
;['dragleave', 'drop'].forEach((ev) =>
  dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag') }))
dz.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0]
  if (f && f.type.startsWith('video/')) loadFile(f)
})

function loadFile(file) {
  state.file = file
  if (state.url) URL.revokeObjectURL(state.url)
  state.url = URL.createObjectURL(file)

  const preview = $('preview')
  preview.src = state.url
  preview.onloadedmetadata = () => {
    state.duration = preview.duration
    $('meta').textContent =
      `${file.name} · ${fmt(state.duration)} · ${(file.size / 1e6).toFixed(1)} MB`
  }

  $('workbench').hidden = false
  $('grid-wrap').hidden = true
  $('cutall-btn').hidden = true
  $('clip-grid').innerHTML = ''
  setStatus('')
}

// ---- Segment length ----
$('seg-buttons').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip')
  if (!chip) return
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
  chip.classList.add('active')
  state.segLen = Number(chip.dataset.len)
})

// ---- Generate segments ----
$('generate-btn').addEventListener('click', () => {
  if (!state.file || !state.duration) return
  state.segments = []
  for (let t = 0; t < state.duration; t += state.segLen) {
    state.segments.push({ start: t, dur: Math.min(state.segLen, state.duration - t) })
  }
  renderGrid()
  $('grid-wrap').hidden = false
  $('cutall-btn').hidden = false
  $('clip-count').textContent = `${state.segments.length} moments`
  setStatus(`Sliced into ${state.segments.length} clips. Cut individually or all at once.`)
})

function renderGrid() {
  const grid = $('clip-grid')
  grid.innerHTML = ''
  state.segments.forEach((seg, i) => {
    const card = document.createElement('div')
    card.className = 'clip-card'
    card.innerHTML = `
      <div class="clip-thumb">
        <span class="clip-idx">${String(i + 1).padStart(2, '0')}</span>
        <span class="clip-badge">${seg.dur.toFixed(0)}s</span>
        <canvas width="320" height="180"></canvas>
      </div>
      <div class="clip-body">
        <div class="clip-time">${fmt(seg.start)} → ${fmt(seg.start + seg.dur)}</div>
        <div class="clip-actions">
          <button class="btn sm cut-one" data-i="${i}">CUT</button>
        </div>
      </div>`
    grid.appendChild(card)
    grabThumb(card.querySelector('canvas'), seg.start)
  })

  grid.querySelectorAll('.cut-one').forEach((b) =>
    b.addEventListener('click', () => cutOne(Number(b.dataset.i), b)))
}

// ---- Canvas thumbnail (cheap, no ffmpeg) ----
function grabThumb(canvas, time) {
  const v = document.createElement('video')
  v.src = state.url
  v.muted = true
  v.currentTime = Math.min(time + 0.1, state.duration - 0.05)
  v.onseeked = () => {
    try { canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height) } catch {}
    v.remove()
  }
}

// ---- Cut a single clip ----
async function cutOne(i, btn) {
  const seg = state.segments[i]
  const label = btn.textContent
  btn.disabled = true
  btn.textContent = 'CUTTING…'
  setStatus(`Cutting clip ${i + 1}…`)
  try {
    const blob = await cutSegment(state.file, seg.start, seg.dur)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.className = 'btn sm'
    a.textContent = 'DOWNLOAD'
    a.download = `clip-${String(i + 1).padStart(2, '0')}.mp4`
    btn.replaceWith(a)
    setStatus(`Clip ${i + 1} ready.`)
  } catch (err) {
    console.error(err)
    btn.disabled = false
    btn.textContent = label
    setStatus(`Error on clip ${i + 1}: ${err.message}`)
  }
}

// ---- Cut all ----
$('cutall-btn').addEventListener('click', async () => {
  const btns = [...document.querySelectorAll('.cut-one')]
  $('cutall-btn').disabled = true
  for (const b of btns) await cutOne(Number(b.dataset.i), b)
  $('cutall-btn').disabled = false
  setStatus('All clips cut.')
})

// ---- helpers ----
function fmt(s) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}
function setStatus(t) { $('status').textContent = t }
