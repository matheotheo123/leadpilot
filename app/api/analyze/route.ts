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
Sub-headlines: ${crawled.h2s.join(' | ')}
Content: ${crawled.bodyText.slice(0, 2500)}
Technologies Detected: ${crawled.techMentions.join(', ') || 'none detected'}
        `.trim()
      }
    }

    const profile = await deepseekJSON<BusinessProfile>(
      `You are an elite B2B sales intelligence engine. Your job is to deeply understand a business and generate precise lead-finding intelligence.`,
      `Analyze this business thoroughly and return a JSON object with exactly these fields:
{
  "name": "the business name or null if unclear",
  "description": "what this business does in one clear sentence",
  "sells": ["list of specific products or services they offer"],
  "idealCustomer": "precise description of their ideal customer/client",
  "painPoints": ["3-5 specific pain points they solve for customers"],
  "searchQueries": [
    "8 very specific Google search queries to find companies that need this business's services",
    "Include queries targeting: companies hiring for roles that signal this need, companies with specific tech stacks, companies at specific growth stages, companies in specific industries",
    "Make queries specific and actionable, not generic"
  ],
  "mapsQueries": [
    "4 Google Maps search terms to find LOCAL businesses that would need this service",
    "Use business category terms like: 'software company', 'tech startup', 'marketing agency'"
  ],
  "industries": ["3-5 target industries"]
}

Business to analyze:
${businessContext}`
    )

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze business. Check your DeepSeek API key.' },
      { status: 500 }
    )
  }
}
