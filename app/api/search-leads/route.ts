import { NextRequest, NextResponse } from 'next/server'
import { serperSearch, serperPlaces } from '@/lib/serper'
import type { RawLead } from '@/types'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { searchQueries, mapsQueries, location } = await request.json()

    const rawLeads: RawLead[] = []
    const seen = new Set<string>()

    const addLead = (lead: RawLead) => {
      const key = lead.name?.toLowerCase().trim().slice(0, 40)
      if (!key || seen.has(key)) return
      seen.add(key)
      rawLeads.push(lead)
    }

    // Run 3 web search queries in parallel
    const webQueries: string[] = (searchQueries || []).slice(0, 3)
    const webResults = await Promise.allSettled(
      webQueries.map((q: string) =>
        serperSearch(location ? `${q} ${location}` : q, 10)
      )
    )

    for (const result of webResults) {
      if (result.status === 'fulfilled') {
        for (const item of result.value.organic || []) {
          // Skip directories, social media, job boards — we want company sites
          if (
            item.link.includes('linkedin.com/company') ||
            item.link.includes('indeed.com') ||
            item.link.includes('glassdoor.com') ||
            item.link.includes('yelp.com') ||
            item.link.includes('facebook.com') ||
            item.link.includes('twitter.com') ||
            item.link.includes('wikipedia.org')
          )
            continue

          addLead({
            name: item.title.replace(/ [-|].*$/, '').trim(),
            website: item.link,
            snippet: item.snippet,
            source: 'web',
          })
        }
      }
    }

    // Run 3 Google Maps queries in parallel (local business gold)
    const mapQueries: string[] = (mapsQueries || []).slice(0, 3)
    const mapsResults = await Promise.allSettled(
      mapQueries.map((q: string) => serperPlaces(q, location, 20))
    )

    for (const result of mapsResults) {
      if (result.status === 'fulfilled') {
        for (const place of result.value.places || []) {
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

    // Shuffle and cap at 25 leads to keep enrichment fast
    const shuffled = rawLeads
      .map((l) => ({ l, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ l }) => l)

    return NextResponse.json({ leads: shuffled.slice(0, 25) })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to search for leads. Check your Serper API key.' },
      { status: 500 }
    )
  }
}
