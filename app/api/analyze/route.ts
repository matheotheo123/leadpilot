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
        businessContext = `
Website URL: ${value}
Page Title: ${crawled.title}
Description: ${crawled.description}
Main Headlines: ${crawled.h1s.join(' | ')}
Content: ${crawled.bodyText.slice(0, 2500)}
Technologies Detected: ${crawled.techMentions.join(', ') || 'none detected'}
        `.trim()
      }
    }

    const profile = await deepseekJSON<BusinessProfile>(
      `You are an expert B2B sales prospector. Your job is to figure out WHO NEEDS TO BUY a service, and generate Google search queries that will find those specific buyers — NOT providers of the same service.

CRITICAL RULES:
- Search queries must find COMPANIES THAT NEED THIS SERVICE, not companies that provide it
- Think about what signals on a company's website or job postings indicate they have the pain point being solved
- Queries should surface real company websites, not directories or aggregators`,

      `A vendor sells the following service. Your job is to find their ideal BUYERS.

SERVICE DESCRIPTION:
${businessContext}

Return a JSON object with EXACTLY these fields. The searchQueries and mapsQueries must be real, runnable Google search strings — not descriptions:

{
  "name": "vendor business name or null",
  "description": "one sentence: what this vendor sells",
  "sells": ["specific service 1", "specific service 2"],
  "idealCustomer": "describe the ideal buyer company in one sentence",
  "painPoints": ["pain point this vendor solves #1", "pain point #2", "pain point #3"],
  "industries": ["industry 1", "industry 2", "industry 3"],
  "searchQueries": [
    "startups hiring software engineers site:linkedin.com",
    "B2B SaaS companies scaling engineering team 2024",
    "companies adopting AI tools for business automation",
    "software company cloud infrastructure cost optimization",
    "tech startup AWS spending reduction case study",
    "growing SaaS company DevOps hiring",
    "enterprise digital transformation AI implementation vendor",
    "scaleup company workflow automation tools"
  ],
  "mapsQueries": [
    "software company",
    "technology startup",
    "SaaS company",
    "IT services company"
  ]
}

IMPORTANT: The searchQueries array above is just an EXAMPLE FORMAT showing the style. You must replace every item with real queries specific to finding buyers for THIS specific service. Do NOT copy the example strings. Generate 8 fresh queries targeted at the actual buyers of this service.`
    )

    // Guarantee arrays are real arrays
    profile.searchQueries = Array.isArray(profile.searchQueries) ? profile.searchQueries.slice(0, 8) : []
    profile.mapsQueries = Array.isArray(profile.mapsQueries) ? profile.mapsQueries.slice(0, 5) : []

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze business. Check your DeepSeek API key.' },
      { status: 500 }
    )
  }
}
