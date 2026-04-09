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

export async function POST(request: NextRequest) {
  try {
    const { lead, businessProfile }: { lead: EnrichedLead; businessProfile: BusinessProfile } =
      await request.json()

    // Run website crawl and job posting search in parallel
    const [siteResult, jobsResult] = await Promise.allSettled([
      lead.website ? crawlWebsite(lead.website) : Promise.resolve(null),
      serperSearch(
        `"${lead.name}" (hiring OR "open roles" OR "we're hiring" OR careers OR jobs)`,
        5
      ),
    ])

    const site = siteResult.status === 'fulfilled' ? siteResult.value : null
    const jobSnippets =
      jobsResult.status === 'fulfilled'
        ? jobsResult.value.organic
            ?.slice(0, 4)
            .map((r) => `${r.title}: ${r.snippet}`)
            .join('\n')
        : null

    const crawledEmail = site?.emails?.[0] ?? null

    const context = [
      `COMPANY: ${lead.name}`,
      lead.website ? `WEBSITE: ${lead.website}` : null,
      lead.address ? `ADDRESS: ${lead.address}` : null,
      lead.phone ? `PHONE: ${lead.phone}` : null,
      lead.snippet ? `SEARCH SNIPPET: ${lead.snippet}` : null,
      site ? `\nWEBSITE TITLE: ${site.title}` : null,
      site?.description ? `META DESCRIPTION: ${site.description}` : null,
      site?.h1s.length ? `HEADLINES: ${site.h1s.join(' | ')}` : null,
      site?.techMentions.length ? `TECH STACK: ${site.techMentions.join(', ')}` : null,
      site ? `SITE CONTENT: ${site.bodyText.slice(0, 1800)}` : null,
      site?.emails.length ? `EMAILS FOUND: ${site.emails.join(', ')}` : null,
      jobSnippets ? `\nACTIVE JOB POSTINGS FOUND:\n${jobSnippets}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const analysis = await deepseekJSON<EnrichResult>(
      `You are an elite B2B sales intelligence analyst. Your job is to analyze a prospect company and determine whether they genuinely need a specific service, using concrete evidence from their website and job postings.`,
      `VENDOR SELLS: ${businessProfile.sells?.join(', ')}
PAIN POINTS SOLVED: ${businessProfile.painPoints?.join(', ')}
TARGET ROLES (job titles that signal the need): ${businessProfile.roles?.join(', ')}

PROSPECT DATA:
${context}

Analyze this prospect and return JSON:
{
  "score": <0-100 integer. 80+ only if there is CONCRETE evidence like matching job postings, relevant tech stack, or clear operational scale. Be strict.>,
  "industry": "<specific industry>",
  "email": "<best contact email or null>",
  "companySize": "<startup|smb|mid-market|enterprise>",
  "painSignals": [
    {
      "signal": "<specific evidence — e.g. 'Hiring 3 Operations Coordinators (role vendor replaces)' or 'AWS mentioned across 4 job postings'>",
      "urgency": "<high|medium|low>",
      "type": "<hiring|cost|growth|tech|news|funding>"
    }
  ],
  "whyNow": "<2 sentences. Must cite specific evidence from their job postings or site. Why is RIGHT NOW the moment to reach out?>",
  "outreachBlueprint": "<2-3 sentence cold opener. Reference a specific job posting or observable fact about them. Sound human, not salesy. Open a conversation, don't pitch.>"
}

Score guidance: 80-100 = job postings directly match target roles OR clear evidence of pain. 60-79 = indirect signals. Below 60 = speculative. If no evidence found, score 30-45.`
    )

    const enriched: EnrichedLead = {
      id: Math.random().toString(36).slice(2, 10),
      name: lead.name,
      website: lead.website,
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
    }

    return NextResponse.json({ enriched })
  } catch (err) {
    console.error('enrich-lead error:', err)
    return NextResponse.json({ error: `Enrichment failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 })
  }
}
