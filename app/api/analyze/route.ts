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
      'You are a B2B sales expert who identifies ideal buyers for a business.',
      `Business description: "${input}"

Return JSON:
{
  "description": "one sentence: what they sell",
  "sells": ["service 1", "service 2"],
  "painPoints": ["pain 1", "pain 2", "pain 3"],
  "targets": ["company type 1", "company type 2", "company type 3"],
  "roles": ["job title 1", "job title 2", "job title 3", "job title 4"]
}

For "targets": 3 short company-type labels (e.g. "SaaS startup", "logistics company", "law firm") describing who would BUY this service.

For "roles": 4 specific job titles that — when a company is actively HIRING them — signal the company has the exact pain this service solves. Think: what manual or inefficient role does this service replace or augment? Examples for an AI automation company: "operations coordinator", "data entry specialist", "customer support representative", "manual reporting analyst". These should be roles a mid-size company (50-500 employees) would realistically post.`
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
