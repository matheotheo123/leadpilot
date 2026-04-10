import { NextRequest, NextResponse } from 'next/server'
import { serperSearch } from '@/lib/serper'
import { deepseekJSON } from '@/lib/deepseek'
import type { BusinessProfile, LeadEvent, EventType } from '@/types'

export const maxDuration = 30

interface RawEventCandidate {
  title: string
  link: string
  snippet: string
  isLocal: boolean
}

function classifyEventType(title: string, snippet: string): EventType {
  const text = (title + ' ' + snippet).toLowerCase()
  if (/hackathon/.test(text)) return 'hackathon'
  if (/expo|trade.?show|fair/.test(text)) return 'expo'
  if (/networking|mixer|meetup|meet.?up/.test(text)) return 'networking'
  if (/conference|summit|congress|forum|symposium/.test(text)) return 'conference'
  if (/meetup|workshop|bootcamp/.test(text)) return 'meetup'
  return 'other'
}

function extractDate(snippet: string): string | undefined {
  // Match patterns like "Jan 15, 2025", "March 2025", "2025-06-12", "June 12-14, 2025"
  const patterns = [
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:[-–]\d{1,2})?,?\s+202[5-9]/i,
    /\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+202[5-9]/i,
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+202[5-9]/i,
    /202[5-9]-\d{2}-\d{2}/,
  ]
  for (const p of patterns) {
    const m = snippet.match(p)
    if (m) return m[0]
  }
  return undefined
}

function extractLocation(snippet: string, title: string): string {
  // Look for "in [City]", "[City], [State/Country]", "held at [Venue]"
  const cityMatch = snippet.match(/\bin\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:,\s*[A-Z]{2,})?)/i)
    || snippet.match(/([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*(?:Canada|USA|US|UK|Australia|Germany|France))/i)
  if (cityMatch) return cityMatch[1]

  // Virtual/online
  if (/virtual|online|remote|hybrid/i.test(snippet + title)) return 'Virtual / Online'

  return 'Location TBD'
}

export async function POST(request: NextRequest) {
  try {
    const { location, businessProfile }: { location: string; businessProfile: BusinessProfile } =
      await request.json()

    const target = businessProfile.targets?.[0] || 'business'
    const sells = businessProfile.sells?.slice(0, 2).join(' ') || 'business services'
    const industry = businessProfile.targets?.join(' OR ') || target

    // Build targeted search queries
    const queries: { q: string; isLocal: boolean }[] = [
      // Local event — highest priority
      ...(location ? [{
        q: `"${target}" event OR conference OR networking OR meetup "${location}" 2025 OR 2026`,
        isLocal: true,
      }] : []),
      // Industry conference (global)
      { q: `"${industry}" conference OR summit OR expo 2025 2026 site:eventbrite.com OR site:lu.ma OR site:meetup.com`, isLocal: false },
      // Broader industry events
      { q: `"${sells}" conference OR summit OR trade show 2025 2026`, isLocal: false },
      // Networking / pitch events
      { q: `"${target}" startup OR networking OR founders event 2025 2026`, isLocal: false },
      // Second local attempt with different keywords
      ...(location ? [{
        q: `"${location}" tech OR business OR startup conference OR event 2025 2026`,
        isLocal: true,
      }] : []),
    ]

    // Run searches in parallel (cap at 4 to stay within timeout)
    const results = await Promise.allSettled(
      queries.slice(0, 4).map(({ q }) => serperSearch(q, 6))
    )

    // Collect raw candidates
    const candidates: RawEventCandidate[] = []
    const seenUrls = new Set<string>()

    results.forEach((res, i) => {
      if (res.status !== 'fulfilled') return
      const isLocal = queries[i]?.isLocal ?? false
      for (const item of res.value.organic || []) {
        if (!item.link || !item.title) continue
        if (seenUrls.has(item.link)) continue
        // Skip generic news articles, not actual event pages
        if (/forbes|techcrunch|wired|businessinsider|medium\.com\/(?!events)/.test(item.link)) continue
        seenUrls.add(item.link)
        candidates.push({ title: item.title, link: item.link, snippet: item.snippet || '', isLocal })
      }
    })

    if (candidates.length === 0) {
      return NextResponse.json({ events: [] })
    }

    // Use DeepSeek to pick the 5 best — at least 1 local
    let finalCandidates = candidates.slice(0, 5)

    if (candidates.length > 5) {
      try {
        const listText = candidates
          .slice(0, 20)
          .map((c, i) => `[${i}] ${c.isLocal ? '[LOCAL]' : '[GLOBAL]'} ${c.title} | ${c.snippet.slice(0, 100)}`)
          .join('\n')

        const filter = await deepseekJSON<{ kept: number[] }>(
          'You are a B2B event researcher selecting the most valuable events for a vendor.',
          `Vendor sells: ${sells}
Target buyers: ${industry}
${location ? `Vendor is based in: ${location}` : ''}

Pick the 5 BEST events from this list. Rules:
- Must be actual events (conferences, expos, meetups, trade shows, networking events) — not articles about events
- At least 1 must be a [LOCAL] event if any are available
- Must be relevant to the vendor's target buyers or industry
- Prefer events in 2025 or 2026 (upcoming or recent)
- Mix of event types is preferred (conference + networking + expo)

Candidates:
${listText}

Return JSON: { "kept": [exactly 5 index numbers, or fewer if less than 5 valid events exist] }`
        )

        if (Array.isArray(filter?.kept) && filter.kept.length > 0) {
          const keep = new Set(filter.kept.filter((i) => i >= 0 && i < candidates.length))
          finalCandidates = candidates.filter((_, i) => keep.has(i)).slice(0, 5)
        }
      } catch {
        finalCandidates = candidates.slice(0, 5)
      }
    }

    // Convert to LeadEvent objects
    const events: LeadEvent[] = finalCandidates.map((c) => ({
      title: c.title
        .replace(/\s*[-|–·]\s*(Eventbrite|Meetup|Lu\.ma|Luma)$/i, '')
        .replace(/\s*\|\s*.+$/, '')
        .trim()
        .slice(0, 100),
      date: extractDate(c.snippet),
      location: extractLocation(c.snippet, c.title),
      description: c.snippet.slice(0, 180),
      url: c.link,
      isLocal: c.isLocal,
      type: classifyEventType(c.title, c.snippet),
    }))

    // Sort: local events first
    events.sort((a, b) => (b.isLocal ? 1 : 0) - (a.isLocal ? 1 : 0))

    return NextResponse.json({ events })
  } catch (err) {
    console.error('search-events error:', err)
    return NextResponse.json({ events: [] })
  }
}
