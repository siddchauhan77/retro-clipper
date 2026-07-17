import { VIDEOS } from './data.js'

const $ = (id) => document.getElementById(id)
const PLAT = { youtube: 'YT', instagram: 'IG', tiktok: 'TIKTOK' }

const state = { platform: 'all', sort: 'outlier', q: '' }

export function initDatabase() {
  $('db-platform').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return
    setActive('db-platform', c); state.platform = c.dataset.plat; render()
  })
  $('db-sort').addEventListener('click', (e) => {
    const c = e.target.closest('.chip'); if (!c) return
    setActive('db-sort', c); state.sort = c.dataset.sort; render()
  })
  $('db-search').addEventListener('input', (e) => { state.q = e.target.value.toLowerCase().trim(); render() })
  render()
}

function setActive(groupId, chip) {
  $(groupId).querySelectorAll('.chip').forEach((c) => c.classList.remove('active'))
  chip.classList.add('active')
}

function render() {
  let list = VIDEOS.filter((v) => state.platform === 'all' || v.platform === state.platform)
  if (state.q) {
    list = list.filter((v) =>
      (v.handle + ' ' + v.desc + ' ' + v.niche + ' ' + v.platform).toLowerCase().includes(state.q))
  }
  list = list.slice().sort((a, b) =>
    state.sort === 'views' ? b.views - a.views
    : state.sort === 'recent' ? (b.ts || 0) - (a.ts || 0)
    : b.outlier - a.outlier)

  $('db-count').textContent = `${list.length} video${list.length === 1 ? '' : 's'}`
  $('db-grid').innerHTML = list.map(card).join('')
}

function card(v) {
  const secondary = v.platform === 'youtube'
    ? `🔥 ${v.engagement}%`
    : `👥 ${abbr(v.followers)}`
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
        <div class="db-handle">@${v.handle}</div>
        <div class="db-desc">${esc(v.desc)}</div>
        <div class="db-meta">
          <span class="db-niche">${v.niche}</span>
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
function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
