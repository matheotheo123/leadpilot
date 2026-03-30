import { NextRequest, NextResponse } from 'next/server'
import { deepseekJSON } from '@/lib/deepseek'
import { crawlWebsite } from '@/lib/crawler'
import type { BusinessProfile } from '@/types'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { type, value } = await request.json()

    let businessContext = value

    if (type === 'url') {
      const crawled = await crawlWebsite(value)
      if (crawled) {
        businessContext = [
          `URL: ${value}`,
          `Title: ${crawled.title}`,
          `Description: ${crawled.description}`,
          `Headlines: ${crawled.h1s.join(' | ')}`,
          `Content: ${crawled.bodyText.slice(0, 2000)}`,
        ].join('\n')
      }
    }

    const profile = await deepseekJSON<BusinessProfile>(
      `You are a B2B sales expert who understands how to find companies that need specific services.`,

      `Read this business description carefully and return a JSON object.

BUSINESS:
${businessContext}

Return this exact JSON structure:

{
  "name": null,
  "description": "one sentence summary of what this business sells",
  "sells": ["service or product 1", "service or product 2"],
  "idealCustomer": "one sentence describing the ideal buyer",
  "painPoints": ["pain point 1", "pain point 2", "pain point 3"],
  "industries": ["industry 1", "industry 2", "industry 3"],
  "searchQueries": [
    "technology companies",
    "software startups",
    "SaaS businesses",
    "IT consulting firms",
    "digital agency",
    "engineering company",
    "cloud services company",
    "enterprise software company"
  ],
  "mapsQueries": [
    "software company",
    "technology startup",
    "IT company",
    "digital agency"
  ]
}

IMPORTANT FOR searchQueries: Replace the 8 example strings above with 8 REAL search terms specific to finding BUYERS of this service. These must be short phrases like "software company", "healthcare startup", "logistics company", "B2B SaaS" — simple company-type terms that Google will use to find company websites. DO NOT use site: operators. DO NOT use long sentences. DO NOT add location (location is added separately). Keep each query under 6 words.

IMPORTANT FOR mapsQueries: Replace the 4 example strings with 4 short business category terms for Google Maps like "software company" or "tech startup". Under 4 words each.`
    )

    // Sanitize — strip any site: operators or long queries DeepSeek sneaks in
    const clean = (q: string) =>
      q.replace(/site:\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, 60)

    profile.searchQueries = Array.isArray(profile.searchQueries)
      ? profile.searchQueries.map(clean).filter((q) => q.length > 2).slice(0, 8)
      : ['software company', 'technology startup', 'SaaS company']

    profile.mapsQueries = Array.isArray(profile.mapsQueries)
      ? profile.mapsQueries.map(clean).filter((q) => q.length > 2).slice(0, 5)
      : ['software company', 'tech startup', 'IT company']

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze. Check your DeepSeek API key.' },
      { status: 500 }
    )
  }
}
