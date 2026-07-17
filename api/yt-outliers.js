// Vercel Function — live YouTube outlier lookup.
// GET /api/yt-outliers?channel=@handle | channelId | channel URL
// Fetches a channel's recent uploads, computes each video's outlier multiplier
// (views ÷ the channel's median views), returns them sorted by outlier.
// Requires a free YouTube Data API v3 key in env var YOUTUBE_API_KEY.

const API = 'https://www.googleapis.com/youtube/v3'

export default async function handler(req, res) {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) {
    return res.status(200).json({
      error: 'needs-key',
      message: 'Live lookup needs a free YouTube Data API key. Add YOUTUBE_API_KEY in Vercel env vars.',
    })
  }

  const raw = (req.query.channel || '').toString().trim()
  if (!raw) return res.status(400).json({ error: 'no-channel', message: 'Pass ?channel=@handle or a channel URL.' })

  try {
    const channelId = await resolveChannelId(raw, key)
    if (!channelId) return res.status(404).json({ error: 'not-found', message: `Couldn't find channel "${raw}".` })

    // Channel: uploads playlist + handle + subscriber count
    const ch = await j(`${API}/channels?part=contentDetails,snippet,statistics&id=${channelId}&key=${key}`)
    const chItem = ch.items?.[0]
    if (!chItem) return res.status(404).json({ error: 'not-found', message: 'Channel has no data.' })
    const uploads = chItem.contentDetails.relatedPlaylists.uploads
    const handle = chItem.snippet.customUrl?.replace(/^@?/, '') || chItem.snippet.title
    const subs = Number(chItem.statistics.subscriberCount || 0)

    // Recent uploads → video IDs
    const pl = await j(`${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}&key=${key}`)
    const ids = (pl.items || []).map((i) => i.contentDetails.videoId).slice(0, 50)
    if (!ids.length) return res.status(200).json({ handle, videos: [] })

    // Video stats
    const vs = await j(`${API}/videos?part=statistics,snippet,contentDetails&id=${ids.join(',')}&key=${key}`)
    const items = (vs.items || []).map((v) => ({
      id: v.id,
      views: Number(v.statistics.viewCount || 0),
      likes: Number(v.statistics.likeCount || 0),
      comments: Number(v.statistics.commentCount || 0),
      title: v.snippet.title,
      publishedAt: Math.floor(new Date(v.snippet.publishedAt).getTime() / 1000),
      thumb: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url,
    }))

    const med = median(items.map((i) => i.views).filter((n) => n > 0)) || 1
    const videos = items
      .map((i) => ({
        id: i.id,
        platform: 'youtube',
        handle,
        desc: i.title,
        niche: 'YouTube',
        format: 'Live',
        views: i.views,
        outlier: Math.round((i.views / med) * 10) / 10,
        engagement: i.views ? Math.round(((i.likes + i.comments) / i.views) * 1000) / 10 : 0,
        followers: subs,
        url: `https://youtube.com/watch?v=${i.id}`,
        thumb: i.thumb,
        ts: i.publishedAt,
      }))
      .sort((a, b) => b.outlier - a.outlier)

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600')
    return res.status(200).json({ handle, median: med, videos })
  } catch (e) {
    return res.status(500).json({ error: 'lookup-failed', message: String(e.message || e) })
  }
}

async function resolveChannelId(raw, key) {
  // Direct channel ID
  if (/^UC[\w-]{20,}$/.test(raw)) return raw
  // Extract from URL forms
  const url = raw.match(/youtube\.com\/(channel\/(UC[\w-]+)|@([\w.-]+))/i)
  if (url?.[2]) return url[2]
  const handle = (url?.[3] || raw).replace(/^@/, '')
  // Resolve by handle
  const byHandle = await j(`${API}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${key}`)
  if (byHandle.items?.[0]?.id) return byHandle.items[0].id
  // Fallback: search
  const search = await j(`${API}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(handle)}&key=${key}`)
  return search.items?.[0]?.snippet?.channelId || null
}

async function j(u) {
  const r = await fetch(u)
  const data = await r.json()
  if (!r.ok) throw new Error(data?.error?.message || `HTTP ${r.status}`)
  return data
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
