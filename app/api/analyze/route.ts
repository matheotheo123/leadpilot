import { NextRequest, NextResponse } from 'next/server'
import { deepseekJSON } from '@/lib/deepseek'
import { crawlWebsite } from '@/lib/crawler'
import type { BusinessProfile } from '@/types'

export const maxDuration = 30

interface AnalysisResult {
  description: string
  sells: string[]
  painPoints: string[]
  targets: string[]
  roles: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { type, value } = await request.json()

    let input = value as string

    if (type === 'url') {
      const crawled = await crawlWebsite(value)
      if (crawled) {
        input = `${crawled.title}. ${crawled.description}. ${crawled.h1s.join('. ')}. ${crawled.bodyText.slice(0, 1500)}`
      }
    }

    const result = await deepseekJSON<AnalysisResult>(
      'You are a precise B2B sales targeting expert. Your job is to identify the SPECIFIC type of company that would write a cheque for this service — not a vague category, a real buyer.',
      `Business description: "${input}"

Think step by step before answering:
1. What does this business literally sell or do?
2. Who is the MOST SPECIFIC type of company that would pay for this? (e.g. not "technology company" but "Series A SaaS startup with a DevOps team")
3. What operational pain does the buyer currently feel that makes them need this?
4. What industry/size is the sweet spot buyer?

Return JSON:
{
  "description": "one sentence: what they sell and to whom specifically",
  "sells": ["specific service/product 1", "specific service/product 2"],
  "painPoints": ["specific buyer pain 1", "specific buyer pain 2", "specific buyer pain 3"],
  "targets": ["specific company type 1", "specific company type 2", "specific company type 3"],
  "roles": ["job title 1", "job title 2", "job title 3", "job title 4"]
}

CRITICAL RULES for "targets":
- Must describe the BUYER — the company that PAYS for this service
- Must be specific enough to search for: "AI startup", "B2B SaaS company", "e-commerce brand", "landscaping company", "digital marketing agency"
- If the vendor serves a specific INDUSTRY (landscaping, legal, medical), targets must be companies IN that industry
- If the vendor serves companies that USE a technology (cloud, AI, Salesforce), targets must be tech companies or companies known to use that technology
- NEVER put broad generic labels like "small business", "startup", "company" — always specify the industry or technology vertical
- 3 labels maximum, each under 5 words

For "roles": 4 specific job titles that signal the buyer company has budget and pain. For a local service business (web design, accounting), think: "marketing manager", "office manager", "operations director". For tech services, think about the role the service replaces or augments.`
    )

    const profile: BusinessProfile = {
      description: result.description || input.slice(0, 120),
      sells: Array.isArray(result.sells) ? result.sells : [],
      painPoints: Array.isArray(result.painPoints) ? result.painPoints : [],
      targets: Array.isArray(result.targets) ? result.targets.slice(0, 3) : ['technology company', 'software startup', 'SaaS company'],
      roles: Array.isArray(result.roles) ? result.roles.slice(0, 4) : [],
      idealCustomer: result.targets?.[0] || 'growing businesses',
      industries: [],
      searchQueries: [],
      mapsQueries: [],
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: `Analyze failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
