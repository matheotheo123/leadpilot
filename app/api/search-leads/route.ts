import { NextRequest, NextResponse } from 'next/server'
import { serperSearch, serperPlaces } from '@/lib/serper'
import { deepseekJSON } from '@/lib/deepseek'
import type { RawLead, BusinessProfile } from '@/types'

export const maxDuration = 30

// Domains we want to ALLOW even though they look like aggregators — job postings on
// company-owned subdomains are fine. We only skip pure job/review aggregators.
const SKIP = [
  'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com',
  'facebook.com', 'twitter.com', 'x.com', 'wikipedia.org', 'youtube.com',
  'reddit.com', 'quora.com', 'medium.com', 'substack.com',
  'forbes.com', 'techcrunch.com', 'venturebeat.com', 'wired.com',
  'crunchbase.com', 'angel.co', 'clutch.co', 'g2.com',
  'capterra.com', 'bbb.org', 'yellowpages', 'yelp.com',
  'mapquest.com', 'tripadvisor.com',
]
const shouldSkip = (url: string) => SKIP.some((d) => url.includes(d))

export async function POST(request: NextRequest) {
  try {
    const { location, businessProfile } = await request.json()
    const profile: BusinessProfile = businessProfile

    const targets: string[] = profile?.targets?.length
      ? profile.targets
      : ['technology company', 'software startup', 'SaaS company']

    const roles: string[] = profile?.roles?.length
      ? profile.roles
      : []

    const seen = new Set<string>()
    const pool: RawLead[] = []

    const add = (r: Partial<RawLead> & { name: string; source: 'web' | 'maps' }) => {
      const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
      if (!key || key.length < 2 || seen.has(key)) return
      seen.add(key)
      pool.push(r as RawLead)
    }

    // ── Strategy 1: Hiring signal search ───────────────────────────────
    // Find companies actively posting jobs that signal they have the pain.
    // Search company career pages directly — NOT aggregators.
    // "operations coordinator" job opening Ottawa -site:indeed.com -site:linkedin.com
    const hiringQueries = roles.slice(0, 3).map((role) => {
      const base = `"${role}" job opening`
      const loc = location ? ` ${location}` : ''
      return `${base}${loc} -site:indeed.com -site:glassdoor.com -site:linkedin.com -site:ziprecruiter.com`
    })

    // ── Strategy 2: Direct company search ──────────────────────────────
    // Find company homepages by type — a reliable fallback that always returns results
    const directQueries = targets.slice(0, 2).map((t) =>
      location ? `${t} ${location}` : t
    )

    // ── Strategy 3: Google Maps for local businesses ────────────────────
    const mapsPromises = location
      ? targets.slice(0, 2).map((t) => serperPlaces(t, location, 10))
      : []

    // Run all in parallel
    const [hiringResults, directResults, mapsResults] = await Promise.all([
      Promise.allSettled(hiringQueries.map((q) => serperSearch(q, 8))),
      Promise.allSettled(directQueries.map((q) => serperSearch(q, 8))),
      Promise.allSettled(mapsPromises),
    ])

    const errors: string[] = []

    // Maps first — local businesses with phone numbers are highest value
    for (const res of mapsResults) {
      if (res.status === 'rejected') { errors.push(String(res.reason)); continue }
      for (const place of res.value.places || []) {
        if (!place.title) continue
        add({ name: place.title, website: place.website, phone: place.phone, address: place.address, snippet: place.category, source: 'maps' })
      }
    }

    // Hiring signal results — company career pages
    for (const res of hiringResults) {
      if (res.status === 'rejected') { errors.push(String(res.reason)); continue }
      for (const item of res.value.organic || []) {
        if (!item.link || shouldSkip(item.link)) continue
        const name = item.title.replace(/\s*[-|–·|:]\s*(job|career|hiring|join|work).*/i, '').replace(/\s*[-|–·]\s*.+$/, '').trim()
        if (!name || name.length < 2) continue
        add({ name, website: item.link, snippet: item.snippet, source: 'web' })
      }
    }

    // Direct company results — homepage fallback
    for (const res of directResults) {
      if (res.status === 'rejected') { errors.push(String(res.reason)); continue }
      for (const item of res.value.organic || []) {
        if (!item.link || shouldSkip(item.link)) continue
        const name = item.title.replace(/\s*[-|–·]\s*.+$/, '').trim()
        if (!name || name.length < 2) continue
        add({ name, website: item.link, snippet: item.snippet, source: 'web' })
      }
    }

    if (pool.length === 0) {
      const reason = errors[0] || 'No results returned from Serper'
      return NextResponse.json({ error: reason }, { status: 422 })
    }

    // ── DeepSeek picks the 5 best prospects ────────────────────────────
    // Quality over quantity — 5 deeply enriched leads beats 25 shallow ones
    let finalLeads: RawLead[] = pool.slice(0, 5)

    if (pool.length > 5 && profile) {
      try {
        const listText = pool
          .slice(0, 20)
          .map((r, i) => `[${i}] ${r.name} | ${r.snippet || ''} | ${r.address || r.website || ''}`)
          .join('\n')

        const filter = await deepseekJSON<{ kept: number[] }>(
          'You are a B2B sales qualifier. Be strict — only keep genuine mid-size companies (50-500 employees) that are clearly businesses, not blogs or directories.',
          `Vendor sells: ${profile.sells?.join(', ')}
Pain solved: ${profile.painPoints?.slice(0, 2).join(', ')}

These are candidates. Pick the 5 BEST — actual companies that could realistically hire this vendor:

${listText}

Return JSON: { "kept": [5 index numbers, best prospects only] }`
        )

        if (Array.isArray(filter?.kept) && filter.kept.length > 0) {
          const keep = new Set(filter.kept.filter((i) => i >= 0 && i < pool.length))
          finalLeads = pool.filter((_, i) => keep.has(i)).slice(0, 5)
        }
      } catch {
        finalLeads = pool.slice(0, 5)
      }
    }

    return NextResponse.json({ leads: finalLeads })
  } catch (err) {
    console.error('search-leads error:', err)
    return NextResponse.json(
      { error: `Search failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
