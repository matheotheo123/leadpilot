import { NextRequest, NextResponse } from 'next/server'
import { deepseekJSON } from '@/lib/deepseek'
import { crawlWebsite } from '@/lib/crawler'
import { serperSearch } from '@/lib/serper'
import type { EnrichedLead, BusinessProfile, PainSignal } from '@/types'

export const maxDuration = 45

interface EnrichResult {
  score: number
  industry: string
  email: string | null
  companySize: 'startup' | 'smb' | 'mid-market' | 'enterprise'
  painSignals: PainSignal[]
  whyNow: string
  outreachBlueprint: string
}

const DIRECTORIES = ['linkedin.com', 'clutch.co', 'crunchbase.com', 'g2.com', 'capterra.com']
const isDirectoryUrl = (url: string) => DIRECTORIES.some((d) => url.includes(d))

export async function POST(request: NextRequest) {
  try {
    const { lead, businessProfile }: { lead: EnrichedLead; businessProfile: BusinessProfile } =
      await request.json()

    // If the lead URL is a directory (LinkedIn, Clutch, Crunchbase),
    // find their actual company website first — we can't crawl directories.
    let actualWebsite = lead.website
    if (lead.website && isDirectoryUrl(lead.website)) {
      try {
        const siteSearch = await serperSearch(
          `"${lead.name}" official website -site:linkedin.com -site:clutch.co -site:crunchbase.com`,
          5
        )
        const hit = siteSearch.organic?.find(
          (r) => !isDirectoryUrl(r.link) && !r.link.includes('wikipedia') && !r.link.includes('facebook')
        )
        if (hit) actualWebsite = hit.link
      } catch { /* keep original */ }
    }

    // Run website crawl + news search in parallel
    const [siteResult, newsResult] = await Promise.allSettled([
      actualWebsite ? crawlWebsite(actualWebsite) : Promise.resolve(null),
      serperSearch(`"${lead.name}" company news announcement 2024 2025`, 4),
    ])

    const site = siteResult.status === 'fulfilled' ? siteResult.value : null
    const news =
      newsResult.status === 'fulfilled'
        ? newsResult.value.organic
            ?.slice(0, 3)
            .map((r) => `${r.title}: ${r.snippet}`)
            .join('\n')
        : null

    const crawledEmail = site?.emails?.[0] ?? null

    // Build context from everything we know
    const decisionMakerText = site?.decisionMakers?.length
      ? site.decisionMakers
          .map(m => `${m.name} (${m.role})${m.email ? ` — ${m.email}` : ''}`)
          .join(', ')
      : null

    const context = [
      `COMPANY: ${lead.name}`,
      actualWebsite ? `WEBSITE: ${actualWebsite}` : null,
      lead.address   ? `ADDRESS: ${lead.address}`   : null,
      lead.phone     ? `PHONE: ${lead.phone}`       : null,
      lead.snippet   ? `DIRECTORY DESCRIPTION: ${lead.snippet}` : null,
      site?.title         ? `\nWEBSITE TITLE: ${site.title}`                                 : null,
      site?.description   ? `META DESCRIPTION: ${site.description}`                          : null,
      site?.h1s?.length   ? `HEADLINES: ${site.h1s.join(' | ')}`                             : null,
      site?.employeeCount ? `TEAM SIZE SIGNAL: ${site.employeeCount}`                        : null,
      site?.techMentions?.length ? `TECH STACK: ${site.techMentions.join(', ')}`             : null,
      site?.bodyText      ? `SITE CONTENT: ${site.bodyText.slice(0, 1800)}`                  : null,
      site?.emails?.length ? `EMAILS FOUND: ${site.emails.join(', ')}`                       : null,
      decisionMakerText   ? `DECISION MAKERS: ${decisionMakerText}`                          : null,
      news ? `\nRECENT NEWS / ANNOUNCEMENTS:\n${news}` : null,
    ].filter(Boolean).join('\n')

    const analysis = await deepseekJSON<EnrichResult>(
      `You are a B2B sales intelligence analyst. Assess whether this company genuinely needs the vendor's service. Be evidence-based and specific.`,
      `VENDOR SELLS: ${businessProfile.sells?.join(', ')}
PAIN POINTS SOLVED: ${businessProfile.painPoints?.join(', ')}
IDEAL CUSTOMER: ${businessProfile.idealCustomer}

PROSPECT DATA:
${context}

Return JSON:
{
  "score": <0-100. Be strict: 75+ requires real evidence like matching tech stack, relevant scale signals, or specific news. Don't give high scores speculatively.>,
  "industry": "<specific industry, e.g. 'B2B SaaS — HR Tech' not just 'Technology'>",
  "email": "<best contact email — prefer a decision maker's direct email if listed under DECISION MAKERS, else use any email from EMAILS FOUND, else null>",
  "companySize": "<startup|smb|mid-market|enterprise>",
  "painSignals": [
    {
      "signal": "<specific observable evidence — cite actual content from their site or news, not guesses>",
      "urgency": "<high|medium|low>",
      "type": "<hiring|cost|growth|tech|news|funding>"
    }
  ],
  "whyNow": "<2 sentences grounded in specific evidence. What makes this the right moment to reach out?>",
  "outreachBlueprint": "<2-3 sentence cold opener. Mention something specific about their business. Sound like a human who did research, not a template.>"
}`
    )

    const enriched: EnrichedLead = {
      id: Math.random().toString(36).slice(2, 10),
      name: lead.name,
      // Show the real website if we found one, fall back to directory URL
      website: (actualWebsite !== lead.website ? actualWebsite : lead.website),
      phone: lead.phone,
      email: analysis.email || crawledEmail || undefined,
      address: lead.address,
      industry: analysis.industry,
      companySize: analysis.companySize,
      score: Math.min(100, Math.max(0, Math.round(analysis.score))),
      painSignals: Array.isArray(analysis.painSignals) ? analysis.painSignals : [],
      whyNow: analysis.whyNow || '',
      outreachBlueprint: analysis.outreachBlueprint || '',
      status: 'done',
      source: lead.source,
      snippet: lead.snippet,
      decisionMakers: site?.decisionMakers?.length ? site.decisionMakers : undefined,
    }

    return NextResponse.json({ enriched })
  } catch (err) {
    console.error('enrich-lead error:', err)
    return NextResponse.json(
      { error: `Enrichment failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    )
  }
}
