import { NextRequest, NextResponse } from 'next/server'
import { serperSearch, serperPlaces } from '@/lib/serper'
import { deepseekJSON } from '@/lib/deepseek'
import type { RawLead, BusinessProfile } from '@/types'

export const maxDuration = 45

const SKIP = [
  'indeed.com', 'glassdoor.com', 'yelp.com', 'facebook.com', 'twitter.com',
  'x.com', 'wikipedia.org', 'youtube.com', 'reddit.com', 'quora.com',
  'medium.com', 'forbes.com', 'techcrunch.com', 'crunchbase.com',
  'angel.co', 'clutch.co', 'g2.com', 'capterra.com', 'bbb.org', 'yellowpages',
]
const shouldSkip = (url: string) => SKIP.some((d) => url.includes(d))

export async function POST(request: NextRequest) {
  const { location, businessProfile } = await request.json()
  const profile: BusinessProfile = businessProfile

  // DeepSeek already identified company types — code builds the queries (no AI needed here)
  const targets: string[] = profile?.targets?.length
    ? profile.targets
    : ['technology company', 'software startup', 'SaaS company', 'IT firm', 'digital agency']

  // Build Google queries from company types — simple and reliable
  const localQueries = location
    ? targets.slice(0, 5).map((t) => `${t} ${location}`)
    : targets.slice(0, 5)

  const globalQueries = targets.slice(0, 4) // no location — global reach

  const seen = new Set<string>()
  const pool: RawLead[] = []

  const addLead = (r: Partial<RawLead> & { name: string }) => {
    const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
    if (!key || key.length < 2 || seen.has(key)) return
    seen.add(key)
    pool.push({ source: 'web', ...r } as RawLead)
  }

  // ── 1. Google Maps — local businesses ─────────────────────────────────
  if (location) {
    const mapsResults = await Promise.allSettled(
      targets.slice(0, 5).map((t) => serperPlaces(t, location, 20))
    )
    for (const res of mapsResults) {
      if (res.status !== 'fulfilled') continue
      for (const place of res.value.places || []) {
        if (!place.title) continue
        addLead({
          name: place.title,
          website: place.website,
          phone: place.phone,
          address: place.address,
          snippet: place.category,
          source: 'maps',
        })
      }
    }
  }

  // ── 2. Google Web search — local + global ─────────────────────────────
  const webResults = await Promise.allSettled(
    [...localQueries, ...globalQueries].map((q) => serperSearch(q, 10))
  )
  for (const res of webResults) {
    if (res.status !== 'fulfilled') continue
    for (const item of res.value.organic || []) {
      if (!item.link || shouldSkip(item.link)) continue
      addLead({
        name: item.title.replace(/\s*[-|–·|]\s*.+$/, '').trim(),
        website: item.link,
        snippet: item.snippet,
        source: 'web',
      })
    }
  }

  // ── 3. DeepSeek reads ALL snippets and picks the best prospects ────────
  // This is the intelligence layer: Serper finds, DeepSeek qualifies
  let finalLeads: RawLead[] = pool.slice(0, 25)

  if (pool.length > 0 && profile) {
    try {
      const listText = pool
        .slice(0, 35)
        .map((r, i) => `[${i}] ${r.name} — ${r.snippet || 'no description'} — ${r.website || r.address || ''}`)
        .join('\n')

      const filter = await deepseekJSON<{ kept: number[] }>(
        'You are a B2B sales qualifier.',
        `A vendor sells: ${profile.sells?.join(', ')}. They solve: ${profile.painPoints?.join(', ')}.

Below are companies found on Google. Read each one and decide: is this an actual company (not a news article or directory) that could genuinely benefit from what the vendor sells?

${listText}

Return JSON: { "kept": [list of index numbers to keep, aim for 15-20 best matches] }`
      )

      if (Array.isArray(filter?.kept) && filter.kept.length > 0) {
        const keep = new Set(filter.kept.filter((i) => i >= 0 && i < pool.length))
        finalLeads = pool.filter((_, i) => keep.has(i)).slice(0, 20)
      }
    } catch {
      // DeepSeek filter failed — just use raw pool, don't block
      finalLeads = pool.slice(0, 20)
    }
  }

  // Maps leads first (local, highest intent), then web
  const sorted = [
    ...finalLeads.filter((l) => l.source === 'maps'),
    ...finalLeads.filter((l) => l.source === 'web'),
  ]

  return NextResponse.json({ leads: sorted })
}
