import { NextRequest, NextResponse } from 'next/server'
import { serperSearch, serperPlaces } from '@/lib/serper'
import type { RawLead, BusinessProfile } from '@/types'

// Kept intentionally simple — no DeepSeek here, just fast Serper calls
// Intelligence happens per-lead in /api/enrich-lead
export const maxDuration = 30

const SKIP = [
  'indeed.com', 'glassdoor.com', 'facebook.com', 'twitter.com', 'x.com',
  'wikipedia.org', 'youtube.com', 'reddit.com', 'quora.com', 'medium.com',
  'forbes.com', 'techcrunch.com', 'crunchbase.com', 'angel.co',
  'clutch.co', 'g2.com', 'capterra.com', 'bbb.org', 'yellowpages',
  'mapquest.com', 'tripadvisor.com', 'houzz.com',
]
const shouldSkip = (url: string) => SKIP.some((d) => url.includes(d))

export async function POST(request: NextRequest) {
  try {
    const { location, businessProfile } = await request.json()
    const profile: BusinessProfile = businessProfile

    const targets: string[] = profile?.targets?.length
      ? profile.targets
      : ['technology company', 'software startup', 'SaaS company', 'IT company']

    const seen = new Set<string>()
    const pool: RawLead[] = []

    const add = (r: Partial<RawLead> & { name: string; source: 'web' | 'maps' }) => {
      const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
      if (!key || key.length < 2 || seen.has(key)) return
      seen.add(key)
      pool.push(r as RawLead)
    }

    // ── Google Maps (local) ─────────────────────────────────────────────
    // Run 3 Maps queries in parallel — fast
    const mapsPromises = location
      ? targets.slice(0, 3).map((t) => serperPlaces(t, location, 15))
      : []

    // ── Google Web search ───────────────────────────────────────────────
    // 3 local queries + 2 global — run in parallel with Maps
    const localWeb = location
      ? targets.slice(0, 3).map((t) => serperSearch(`${t} ${location}`, 8))
      : targets.slice(0, 3).map((t) => serperSearch(t, 8))
    const globalWeb = targets.slice(0, 2).map((t) => serperSearch(t, 8))

    // Fire everything in parallel — total wall time = slowest single request (~2-3s)
    const [mapsResults, localResults, globalResults] = await Promise.all([
      Promise.allSettled(mapsPromises),
      Promise.allSettled(localWeb),
      Promise.allSettled(globalWeb),
    ])

    // Process Maps
    for (const res of mapsResults) {
      if (res.status !== 'fulfilled') continue
      for (const place of res.value.places || []) {
        if (!place.title) continue
        add({ name: place.title, website: place.website, phone: place.phone, address: place.address, snippet: place.category, source: 'maps' })
      }
    }

    // Process web results
    for (const res of [...localResults, ...globalResults]) {
      if (res.status !== 'fulfilled') continue
      for (const item of res.value.organic || []) {
        if (!item.link || shouldSkip(item.link)) continue
        const name = item.title.replace(/\s*[-|–·]\s*.+$/, '').trim()
        if (!name) continue
        add({ name, website: item.link, snippet: item.snippet, source: 'web' })
      }
    }

    if (pool.length === 0) {
      return NextResponse.json(
        { error: 'Serper returned no results. Check your SERPER_API_KEY in Vercel env vars and make sure it has remaining quota.' },
        { status: 422 }
      )
    }

    // Maps leads first (local, highest intent), then web
    const sorted = [
      ...pool.filter((l) => l.source === 'maps'),
      ...pool.filter((l) => l.source === 'web'),
    ].slice(0, 25)

    return NextResponse.json({ leads: sorted })
  } catch (err) {
    console.error('search-leads error:', err)
    return NextResponse.json(
      { error: `Search failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
