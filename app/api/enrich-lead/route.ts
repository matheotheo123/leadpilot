import { NextRequest, NextResponse } from 'next/server'
import { deepseekJSON } from '@/lib/deepseek'
import { crawlWebsite } from '@/lib/crawler'
import { serperSearch } from '@/lib/serper'
import type { EnrichedLead, BusinessProfile, PainSignal } from '@/types'

export const maxDuration = 45

interface EnrichResponse {
  score: number
  industry: string
  email: string | null
  companySize: 'startup' | 'smb' | 'mid-market' | 'enterprise'
  painSignals: PainSignal[]
  whyNow: string
  outreachBlueprint: string
}

export async function POST(request: NextRequest) {
  try {
    const { lead, businessProfile }: { lead: EnrichedLead; businessProfile: BusinessProfile } =
      await request.json()

    // Crawl their website + search for hiring signals in parallel
    const [siteData, hiringSearch] = await Promise.allSettled([
      lead.website ? crawlWebsite(lead.website) : Promise.resolve(null),
      serperSearch(
        `"${lead.name}" (hiring OR jobs OR careers OR "we're growing") site:linkedin.com OR site:builtin.com OR site:lever.co OR site:greenhouse.io`,
        5
      ),
    ])

    const site = siteData.status === 'fulfilled' ? siteData.value : null
    const hiring =
      hiringSearch.status === 'fulfilled'
        ? hiringSearch.value.organic
            ?.slice(0, 3)
            .map((r) => r.snippet)
            .join(' | ')
        : null

    // Also pull any emails found during crawl
    const crawledEmails = site?.emails?.[0] || null

    const contextBlock = `
COMPANY: ${lead.name}
WEBSITE: ${lead.website || 'unknown'}
ADDRESS: ${lead.address || 'not found'}
INITIAL DESCRIPTION: ${lead.snippet || 'none'}
${
  site
    ? `
WEBSITE TITLE: ${site.title}
META DESCRIPTION: ${site.description}
KEY HEADLINES: ${site.h1s.join(' | ')}
SUB-HEADLINES: ${site.h2s.join(' | ')}
TECH STACK DETECTED: ${site.techMentions.join(', ') || 'none detected'}
SITE CONTENT EXCERPT: ${site.bodyText.slice(0, 2000)}
EMAILS ON SITE: ${site.emails.join(', ') || 'none found'}
`
    : ''
}
${hiring ? `HIRING ACTIVITY SIGNALS: ${hiring}` : ''}
    `.trim()

    const analysis = await deepseekJSON<EnrichResponse>(
      `You are an elite B2B sales intelligence engine with deep knowledge of business pain points, hiring signals, and growth indicators. Your analysis must be specific, actionable, and based only on evidence from the data provided.`,
      `You are analyzing a potential sales prospect for a company that sells: ${businessProfile.sells.join(', ')}

Their ideal customer: ${businessProfile.idealCustomer}
Pain points they solve: ${businessProfile.painPoints.join(', ')}

Here is all available data on the prospect:
${contextBlock}

Analyze this company and return JSON with exactly these fields:
{
  "score": <integer 0-100 representing how strong a prospect this is, based on evidence>,
  "industry": "<detected industry, be specific>",
  "email": "<best contact email found, or null>",
  "companySize": "<startup|smb|mid-market|enterprise>",
  "painSignals": [
    {
      "signal": "<specific, evidence-based signal — e.g. 'Actively hiring 3 AI Engineers on LinkedIn'>",
      "urgency": "<high|medium|low>",
      "type": "<hiring|cost|growth|tech|news|funding>"
    }
  ],
  "whyNow": "<2-3 sentences explaining WHY RIGHT NOW is the optimal moment to reach out — must reference specific evidence>",
  "outreachBlueprint": "<A personalized 2-3 sentence cold outreach opener that references specific pain signals, sounds human, and opens a conversation — not a pitch>"
}

Score guidance:
- 80-100: Multiple strong signals, clear immediate need
- 60-79: Clear fit, 1-2 strong signals
- 40-59: Decent fit, signals are indirect
- Below 40: Weak or speculative fit

Be specific. Vague signals like 'company is growing' score lower than 'hiring 5 ML engineers on LinkedIn'.`
    )

    const enriched: EnrichedLead = {
      id: Math.random().toString(36).slice(2, 10),
      name: lead.name,
      website: lead.website,
      phone: lead.phone,
      email: analysis.email || crawledEmails || undefined,
      address: lead.address,
      industry: analysis.industry,
      companySize: analysis.companySize,
      score: Math.min(100, Math.max(0, analysis.score)),
      painSignals: analysis.painSignals || [],
      whyNow: analysis.whyNow,
      outreachBlueprint: analysis.outreachBlueprint,
      status: 'done',
      source: lead.source,
      snippet: lead.snippet,
    }

    return NextResponse.json({ enriched })
  } catch (error) {
    console.error('Enrich error:', error)
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 })
  }
}
