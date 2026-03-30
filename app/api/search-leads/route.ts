import { NextRequest, NextResponse } from 'next/server'
import { serperSearch, serperPlaces } from '@/lib/serper'
import type { RawLead } from '@/types'

export const maxDuration = 30

const SKIP_DOMAINS = [
  'linkedin.com/in/', 'indeed.com', 'glassdoor.com', 'yelp.com',
  'facebook.com', 'twitter.com', 'x.com', 'wikipedia.org',
  'youtube.com', 'reddit.com', 'quora.com', 'medium.com',
  'forbes.com', 'techcrunch.com', 'crunchbase.com', 'angellist.com',
]

function isSkippable(url: string) {
  return SKIP_DOMAINS.some((d) => url.includes(d))
}

export async function POST(request: NextRequest) {
  const { searchQueries, mapsQueries, location } = await request.json()

  const rawLeads: RawLead[] = []
  const seen = new Set<string>()

  const addLead = (lead: RawLead) => {
    const key = lead.name?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 35)
    if (!key || key.length < 2 || seen.has(key)) return
    seen.add(key)
    rawLeads.push(lead)
  }

  const queries: string[] = Array.isArray(searchQueries) ? searchQueries : []
  const mapQs: string[] = Array.isArray(mapsQueries) ? mapsQueries : []

  // ── Web searches ──────────────────────────────────────────────────────
  // Strategy: first 3 queries run WITH location (local intent),
  // next 3 run WITHOUT location (global reach).
  // This way Ottawa users get both local AND global leads.
  const localWebQueries = queries.slice(0, 3).map((q) =>
    location ? `${q} ${location}` : q
  )
  const globalWebQueries = queries.slice(3, 6) // no location appended

  const allWebQueries = [...localWebQueries, ...globalWebQueries]

  const webResults = await Promise.allSettled(
    allWebQueries.map((q) => serperSearch(q, 10))
  )

  for (const result of webResults) {
    if (result.status !== 'fulfilled') continue
    for (const item of result.value.organic || []) {
      if (!item.link || isSkippable(item.link)) continue
      addLead({
        name: item.title.replace(/ [-|–|·].*$/, '').trim(),
        website: item.link,
        snippet: item.snippet,
        source: 'web',
      })
    }
  }

  // ── Google Maps (local businesses) ───────────────────────────────────
  // Only run if we have a location — Maps without location is useless.
  if (location && mapQs.length > 0) {
    const mapsResults = await Promise.allSettled(
      mapQs.slice(0, 4).map((q) => serperPlaces(q, location, 20))
    )

    for (const result of mapsResults) {
      if (result.status !== 'fulfilled') continue
      for (const place of result.value.places || []) {
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

  // ── Fallback: if still very few results, broaden search ──────────────
  if (rawLeads.length < 5 && location) {
    const fallbackQueries = [
      `tech companies ${location}`,
      `software startups ${location}`,
      `technology businesses ${location}`,
    ]
    const fallbackResults = await Promise.allSettled(
      fallbackQueries.map((q) => serperSearch(q, 10))
    )
    for (const result of fallbackResults) {
      if (result.status !== 'fulfilled') continue
      for (const item of result.value.organic || []) {
        if (!item.link || isSkippable(item.link)) continue
        addLead({
          name: item.title.replace(/ [-|–|·].*$/, '').trim(),
          website: item.link,
          snippet: item.snippet,
          source: 'web',
        })
      }
    }
  }

  // Return up to 25 leads. Put maps results first (local leads are highest intent).
  const mapsLeads = rawLeads.filter((l) => l.source === 'maps')
  const webLeads = rawLeads.filter((l) => l.source === 'web')
  const combined = [...mapsLeads, ...webLeads].slice(0, 25)

  return NextResponse.json({ leads: combined })
}
