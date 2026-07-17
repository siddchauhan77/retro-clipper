import { VIDEOS, FORMATS } from './data.js'

const $ = (id) => document.getElementById(id)
const PLAT = { youtube: 'YT', instagram: 'IG', tiktok: 'TIKTOK' }

const state = { platform: 'all', size: 'all', format: 'all', sort: 'outlier', q: '', live: null }

export function initDatabase() {
  // Populate format dropdown
  const sel = $('db-format')
  FORMATS.forEach((f) => { const o = document.createElement('option'); o.value = f; o.textContent = f.toUpperCase(); sel.appendChild(o) })

  $('db-platform').addEventListener('click', chipHandler('db-platform', 'platform', 'plat'))
  $('db-size').addEventListener('click', chipHandler('db-size', 'size', 'size'))
  $('db-sort').addEventListener('click', chipHandler('db-sort', 'sort', 'sort'))
  sel.addEventListener('change', (e) => { state.format = e.target.value; render() })
  $('db-search').addEventListener('input', (e) => { state.q = e.target.value.toLowerCase().trim(); render() })

  // Live lookup
  $('lookup-btn').addEventListener('click', runLookup)
  $('db-lookup').addEventListener('keydown', (e) => { if (e.key === 'Enter') runLookup() })

  render()
}

function chipHandler(groupId, key, attr) {
  return (e) => {
    const c = e.target.closest('.chip'); if (!c) return
    $(groupId).querySelectorAll('.chip').forEach((x) => x.classList.remove('active'))
    c.classList.add('active'); state[key] = c.dataset[attr]; render()
  }
}

async function runLookup() {
  const channel = $('db-lookup').value.trim()
  if (!channel) return
  const btn = $('lookup-btn')
  btn.disabled = true; btn.textContent = 'SCANNING…'
  setLookupStatus('Scanning channel…')
  try {
    const r = await fetch(`/api/yt-outliers?channel=${encodeURIComponent(channel)}`)
    const data = await r.json()
    if (data.error === 'needs-key') {
      setLookupStatus('⚙ Live lookup is wired but needs a free YouTube API key in Vercel env (YOUTUBE_API_KEY).')
    } else if (data.error) {
      setLookupStatus(`✕ ${data.message || data.error}`)
    } else if (!data.videos?.length) {
      setLookupStatus(`No videos found for @${data.handle || channel}.`)
    } else {
      state.live = { handle: data.handle, videos: data.videos, median: data.median }
      setLookupStatus(`✓ @${data.handle} · ${data.videos.length} videos · baseline ${abbr(data.median)} views. Showing live results below.`)
      render()
    }
  } catch (e) {
    setLookupStatus(`✕ ${e.message}`)
  } finally {
    btn.disabled = false; btn.textContent = 'SCAN'
  }
}

function render() {
  // Live results take over the grid when present
  let list = state.live ? state.live.videos : VIDEOS
  list = list.filter((v) => state.platform === 'all' || v.platform === state.platform)
  list = list.filter((v) => sizeMatch(v.followers, state.size))
  list = list.filter((v) => state.format === 'all' || v.format === state.format)
  if (state.q) {
    list = list.filter((v) =>
      (v.handle + ' ' + v.desc + ' ' + v.niche + ' ' + v.format + ' ' + v.platform).toLowerCase().includes(state.q))
  }
  list = list.slice().sort((a, b) =>
    state.sort === 'views' ? b.views - a.views
    : state.sort === 'recent' ? (b.ts || 0) - (a.ts || 0)
    : b.outlier - a.outlier)

  const label = state.live ? `LIVE · @${state.live.handle}` : 'SEED DATABASE'
  $('db-count').textContent = `${label} · ${list.length} video${list.length === 1 ? '' : 's'}`
  $('db-grid').innerHTML = list.map(card).join('')
}

function sizeMatch(followers, size) {
  if (size === 'all') return true
  const f = followers || 0
  if (size === 'small') return f < 10000
  if (size === 'mid') return f >= 10000 && f < 1000000
  return f >= 1000000
}

function card(v) {
  const secondary = v.platform === 'youtube' ? `🔥 ${v.engagement}%` : `👥 ${abbr(v.followers)}`
  const thumb = v.thumb
    ? `<img src="${v.thumb}" alt="" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="ph" style="display:none">▶</span>`
    : `<span class="ph">${platIcon(v.platform)}</span>`
  return `
    <a class="db-card" href="${v.url}" target="_blank" rel="noopener noreferrer">
      <div class="db-thumb">
        <span class="db-plat ${v.platform}">${PLAT[v.platform]}</span>
        <span class="db-outlier">${fmtX(v.outlier)}</span>
        ${thumb}
      </div>
      <div class="db-body">
        <div class="db-handle">@${esc(v.handle)}</div>
        <div class="db-desc">${esc(v.desc)}</div>
        <div class="db-meta">
          <span class="db-niche">${esc(v.format)}</span>
          <span class="db-metrics">▶ ${abbr(v.views)} &middot; ${secondary}</span>
        </div>
      </div>
    </a>`
}

function fmtX(n) { return n >= 100 ? `${Math.round(n)}×` : `${n}×` }
function platIcon(p) { return p === 'youtube' ? '▶' : p === 'instagram' ? '◎' : '♪' }
function abbr(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K'
  return String(n)
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
function setLookupStatus(t) { $('lookup-status').textContent = t }
