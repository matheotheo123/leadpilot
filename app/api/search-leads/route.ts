import { NextRequest, NextResponse } from 'next/server'
import { serperSearch, serperPlaces } from '@/lib/serper'
import { deepseekJSON } from '@/lib/deepseek'
import type { RawLead, BusinessProfile } from '@/types'

export const maxDuration = 45

interface RawResult {
  name: string
  website?: string
  phone?: string
  address?: string
  snippet?: string
  source: 'web' | 'maps'
}

export async function POST(request: NextRequest) {
  const { searchQueries, mapsQueries, location, businessProfile } = await request.json()

  const queries: string[] = Array.isArray(searchQueries) ? searchQueries : []
  const mapQs: string[] = Array.isArray(mapsQueries) ? mapsQueries : []
  const profile: BusinessProfile | undefined = businessProfile

  const rawPool: RawResult[] = []
  const seen = new Set<string>()

  const addResult = (r: RawResult) => {
    const key = r.name?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
    if (!key || key.length < 2 || seen.has(key)) return
    seen.add(key)
    rawPool.push(r)
  }

  // ── 1. Google Maps — local businesses (most direct for local intent) ──
  if (location && mapQs.length > 0) {
    const mapsResults = await Promise.allSettled(
      mapQs.slice(0, 4).map((q) => serperPlaces(q, location, 20))
    )
    for (const res of mapsResults) {
      if (res.status !== 'fulfilled') continue
      for (const place of res.value.places || []) {
        if (!place.title) continue
        addResult({
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

  // ── 2. Google Web search ──────────────────────────────────────────────
  // Mix: half queries with location, half global — so we get both
  const localQueries = location
    ? queries.slice(0, 4).map((q) => `${q} ${location}`)
    : queries.slice(0, 4)
  const globalQueries = queries.slice(4, 8) // no location

  const webResults = await Promise.allSettled(
    [...localQueries, ...globalQueries].map((q) => serperSearch(q, 10))
  )

  // Domains to skip — we want company homepages, not aggregators
  const skipDomains = [
    'indeed.com', 'glassdoor.com', 'yelp.com', 'facebook.com',
    'twitter.com', 'x.com', 'wikipedia.org', 'youtube.com',
    'reddit.com', 'quora.com', 'medium.com', 'forbes.com',
    'techcrunch.com', 'crunchbase.com', 'angel.co', 'clutch.co',
    'g2.com', 'capterra.com', 'trustpilot.com', 'bbb.org',
  ]
  const shouldSkip = (url: string) => skipDomains.some((d) => url.includes(d))

  for (const res of webResults) {
    if (res.status !== 'fulfilled') continue
    for (const item of res.value.organic || []) {
      if (!item.link || shouldSkip(item.link)) continue
      addResult({
        name: item.title.replace(/\s*[-|–·|]\s*.+$/, '').trim(),
        website: item.link,
        snippet: item.snippet,
        source: 'web',
      })
    }
  }

  // ── 3. Fallback: broaden if we got very few results ──────────────────
  if (rawPool.length < 6) {
    const fallbacks = location
      ? [`tech companies ${location}`, `businesses ${location}`, `startups ${location}`]
      : ['technology companies', 'software startups', 'B2B companies']

    const fallbackResults = await Promise.allSettled(
      fallbacks.map((q) => serperSearch(q, 10))
    )
    for (const res of fallbackResults) {
      if (res.status !== 'fulfilled') continue
      for (const item of res.value.organic || []) {
        if (!item.link || shouldSkip(item.link)) continue
        addResult({
          name: item.title.replace(/\s*[-|–·|]\s*.+$/, '').trim(),
          website: item.link,
          snippet: item.snippet,
          source: 'web',
        })
      }
    }
  }

  // ── 4. DeepSeek as brain — reads Serper results & picks best prospects ─
  // This is the intelligence layer: DeepSeek reads every company snippet
  // and decides who actually needs the service before we spend time crawling
  let finalLeads: RawLead[] = rawPool.slice(0, 30).map((r) => ({ ...r }))

  if (profile && rawPool.length > 0) {
    try {
      const listText = rawPool
        .slice(0, 30)
        .map((r, i) => `[${i}] ${r.name} | ${r.snippet || 'no description'} | ${r.website || ''}`)
        .join('\n')

      interface FilterResult { kept: number[]; reasoning: string }

      const filter = await deepseekJSON<FilterResult>(
        `You are a B2B sales intelligence engine. Your job is to read search results and identify which companies are genuine prospects.`,
        `A vendor sells: ${profile.sells?.join(', ')}
Their ideal customer: ${profile.idealCustomer}

Here are ${rawPool.slice(0, 30).length} companies found via Google. Read each snippet and decide which ones are actual COMPANIES (not news, blogs, or directories) that could realistically benefit from this vendor's service.

${listText}

Return JSON:
{
  "kept": [array of index numbers to keep — aim for 15-20 best ones],
  "reasoning": "one sentence on your selection logic"
}`
      )

      if (Array.isArray(filter.kept) && filter.kept.length > 0) {
        const validIndices = new Set(filter.kept.filter((i) => i >= 0 && i < rawPool.length))
        finalLeads = rawPool
          .filter((_, i) => validIndices.has(i))
          .slice(0, 20)
      }
    } catch {
      // If DeepSeek filtering fails, just use the raw pool — don't block the search
      finalLeads = rawPool.slice(0, 20)
    }
  }

  // Maps leads first (local, highest intent), then web
  const sorted = [
    ...finalLeads.filter((l) => l.source === 'maps'),
    ...finalLeads.filter((l) => l.source === 'web'),
  ]

  return NextResponse.json({ leads: sorted })
}
