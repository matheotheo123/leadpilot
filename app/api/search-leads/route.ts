import { NextRequest, NextResponse } from 'next/server'
import { serperSearch, serperPlaces } from '@/lib/serper'
import { deepseekJSON } from '@/lib/deepseek'
import type { RawLead, BusinessProfile } from '@/types'

export const maxDuration = 30

// Only skip personal social pages and pure job aggregators.
// We WANT: linkedin.com/company, clutch.co, crunchbase.com — these are company directories.
function shouldSkip(url: string): boolean {
  const skip = [
    'linkedin.com/in/',       // personal profiles
    'linkedin.com/jobs/',     // job listings
    'linkedin.com/feed',
    'linkedin.com/pulse',
    'indeed.com', 'glassdoor.com', 'ziprecruiter.com', 'monster.com',
    'facebook.com', 'twitter.com', 'x.com', 'wikipedia.org',
    'youtube.com', 'reddit.com', 'quora.com', 'medium.com', 'substack.com',
    'forbes.com', 'techcrunch.com', 'venturebeat.com', 'wired.com',
    'inc.com', 'businessinsider.com', 'entrepreneur.com',
    'yelp.com', 'yellowpages', 'bbb.org', 'mapquest.com', 'tripadvisor.com',
  ]
  return skip.some((d) => url.includes(d))
}

function extractName(title: string): string {
  return title
    .replace(/\s*[|–·]\s*LinkedIn$/i, '')
    .replace(/\s*[|–·]\s*Clutch\.co$/i, '')
    .replace(/\s*[|–·]\s*Crunchbase$/i, '')
    .replace(/\s*[-|–·]\s*.+$/, '')
    .replace(/^(Top|Best|Leading)\s+/i, '')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const { location, businessProfile } = await request.json()
    const profile: BusinessProfile = businessProfile

    const targets: string[] = profile?.targets?.length
      ? profile.targets
      : ['technology company', 'software startup', 'SaaS company']

    const seen = new Set<string>()
    const pool: RawLead[] = []

    const add = (r: Partial<RawLead> & { name: string; source: 'web' | 'maps' }) => {
      const key = r.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)
      if (!key || key.length < 3 || seen.has(key)) return
      // Reject obviously huge companies from snippet
      const snip = (r.snippet || '').toLowerCase()
      if (/\b(10,000|50,000|100,000|\d{2},\d{3})\s*(employees|staff|\+)/i.test(snip)) return
      seen.add(key)
      pool.push(r as RawLead)
    }

    // ── 1. LinkedIn company pages ─────────────────────────────────────────
    // These are real company profiles — snippet includes employee count & industry.
    // "51-200 employees" in the snippet = perfect mid-size target.
    const linkedInQueries = targets.slice(0, 2).map((t) =>
      location
        ? `site:linkedin.com/company "${t}" "${location}"`
        : `site:linkedin.com/company "${t}"`
    )

    // ── 2. Clutch.co — curated verified B2B company directory ─────────────
    // Clutch only lists real mid-size service companies — no noise, no blogs.
    const clutchQueries = targets.slice(0, 2).map((t) =>
      location
        ? `site:clutch.co "${t}" "${location}"`
        : `site:clutch.co "${t}"`
    )

    // ── 3. Crunchbase — funded/growing companies ──────────────────────────
    // Series A/B companies have budget, are scaling, and aren't giant yet.
    const cbQuery = location
      ? `site:crunchbase.com/organization ${targets[0]} ${location}`
      : `site:crunchbase.com/organization ${targets[0]}`

    // ── 4. Direct company websites — About pages ──────────────────────────
    // inurl:about / intitle:about returns actual company sites, not aggregators.
    // Excluding noise sources focuses results on real operating businesses.
    const directQuery = location
      ? `"${targets[0]}" "${location}" inurl:about -site:linkedin.com -site:indeed.com -site:glassdoor.com -site:yelp.com -site:facebook.com -site:clutch.co`
      : `"${targets[0]}" inurl:about -site:linkedin.com -site:indeed.com -site:glassdoor.com -site:yelp.com -site:facebook.com`

    // ── 5. Google Maps — local businesses ────────────────────────────────
    const mapsPromises = location
      ? targets.slice(0, 3).map((t) => serperPlaces(t, location, 15))
      : []

    // Fire all in parallel
    const [liResults, clutchResults, cbResults, directResults, mapsResults] = await Promise.all([
      Promise.allSettled(linkedInQueries.map((q) => serperSearch(q, 10))),
      Promise.allSettled(clutchQueries.map((q) => serperSearch(q, 10))),
      serperSearch(cbQuery, 8).catch(() => null),
      serperSearch(directQuery, 8).catch(() => null),
      Promise.allSettled(mapsPromises),
    ])

    const errors: string[] = []

    // Maps — local businesses with phone/address (highest local intent)
    for (const res of mapsResults) {
      if (res.status === 'rejected') { errors.push(String(res.reason)); continue }
      for (const p of res.value.places || []) {
        if (!p.title) continue
        add({ name: p.title, website: p.website, phone: p.phone, address: p.address, snippet: p.category, source: 'maps' })
      }
    }

    // LinkedIn company pages
    for (const res of liResults) {
      if (res.status === 'rejected') { errors.push(String(res.reason)); continue }
      for (const item of res.value.organic || []) {
        if (!item.link?.includes('linkedin.com/company')) continue
        const name = extractName(item.title)
        if (!name) continue
        // Store LinkedIn URL — enrich-lead will find their real website
        add({ name, website: item.link, snippet: item.snippet, source: 'web' })
      }
    }

    // Clutch.co company listings
    for (const res of clutchResults) {
      if (res.status === 'rejected') { errors.push(String(res.reason)); continue }
      for (const item of res.value.organic || []) {
        if (!item.link?.includes('clutch.co')) continue
        const name = extractName(item.title)
        if (!name) continue
        add({ name, website: item.link, snippet: item.snippet, source: 'web' })
      }
    }

    // Crunchbase — funded companies
    if (cbResults) {
      for (const item of cbResults.organic || []) {
        if (!item.link?.includes('crunchbase.com/organization')) continue
        const name = extractName(item.title)
        if (!name) continue
        add({ name, website: item.link, snippet: item.snippet, source: 'web' })
      }
    }

    // Direct company About pages — real company websites, no aggregators
    if (directResults) {
      for (const item of directResults.organic || []) {
        if (!item.link || shouldSkip(item.link)) continue
        // Derive homepage from the about page URL
        try {
          const u = new URL(item.link)
          const homepage = `${u.protocol}//${u.host}`
          const name = extractName(item.title)
          if (!name || name.length < 3) continue
          add({ name, website: homepage, snippet: item.snippet, source: 'web' })
        } catch { /* skip malformed */ }
      }
    }

    if (pool.length === 0) {
      return NextResponse.json(
        { error: errors[0] || 'No companies found. Check your SERPER_API_KEY has remaining quota.' },
        { status: 422 }
      )
    }

    // ── DeepSeek picks the 5 best — strict mid-size filter ───────────────
    let finalLeads: RawLead[] = pool.slice(0, 5)

    if (pool.length > 5 && profile) {
      try {
        const listText = pool
          .slice(0, 25)
          .map((r, i) => `[${i}] ${r.name} | ${r.snippet || ''} | ${r.address || r.website || ''}`)
          .join('\n')

        const filter = await deepseekJSON<{ kept: number[] }>(
          'You are a strict B2B sales qualifier.',
          `Vendor sells: ${profile.sells?.join(', ')}
Ideal buyer: ${profile.idealCustomer}
Pain solved: ${profile.painPoints?.slice(0, 2).join(', ')}

Pick the 5 BEST prospects from this list. Rules:
- Must be a real operating company (not a blog, news article, directory listing, or government org)
- Must be mid-size: 10-500 employees (reject anything that looks like a Fortune 500 or 1-person shop)
- Must plausibly need what the vendor sells based on their industry/description
- Prefer companies with specific descriptions over generic ones

Candidates:
${listText}

Return JSON: { "kept": [exactly 5 index numbers] }`
        )

        if (Array.isArray(filter?.kept) && filter.kept.length > 0) {
          const keep = new Set(filter.kept.filter((i) => i >= 0 && i < pool.length))
          finalLeads = pool.filter((_, i) => keep.has(i)).slice(0, 5)
        }
      } catch {
        finalLeads = pool.slice(0, 5)
      }
    }

    // Maps leads first, then web
    const sorted = [
      ...finalLeads.filter((l) => l.source === 'maps'),
      ...finalLeads.filter((l) => l.source === 'web'),
    ]

    return NextResponse.json({ leads: sorted })
  } catch (err) {
    console.error('search-leads error:', err)
    return NextResponse.json(
      { error: `Search failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
