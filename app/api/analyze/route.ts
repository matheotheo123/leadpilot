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

    // Simple, focused ask: understand the business + identify what types of companies to target
    const result = await deepseekJSON<AnalysisResult>(
      'You are a B2B sales expert.',
      `Someone describes their business as: "${input}"

Understand what they sell and who their buyers are. Return this JSON:
{
  "description": "one sentence: what they sell",
  "sells": ["service 1", "service 2"],
  "painPoints": ["problem they solve 1", "problem they solve 2", "problem they solve 3"],
  "targets": ["type of company 1", "type of company 2", "type of company 3", "type of company 4", "type of company 5", "type of company 6"]
}

For targets: list 6 short company type labels (2-4 words each) that describe businesses who would HIRE this service. Examples of good target labels: "tech startup", "SaaS company", "healthcare clinic", "law firm", "e-commerce brand", "logistics company". Pick types relevant to what was described.`
    )

    const profile: BusinessProfile = {
      description: result.description || input.slice(0, 100),
      sells: Array.isArray(result.sells) ? result.sells : [input.slice(0, 60)],
      painPoints: Array.isArray(result.painPoints) ? result.painPoints : [],
      targets: Array.isArray(result.targets) && result.targets.length > 0
        ? result.targets.slice(0, 6)
        : ['technology company', 'software startup', 'SaaS company', 'IT firm', 'digital agency', 'enterprise company'],
      idealCustomer: result.targets?.[0] || 'growing businesses',
      industries: [],
      searchQueries: [],
      mapsQueries: [],
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze. Check your DeepSeek API key.' },
      { status: 500 }
    )
  }
}
