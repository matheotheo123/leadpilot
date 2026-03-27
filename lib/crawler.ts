import { load } from 'cheerio'

export interface CrawlResult {
  title: string
  description: string
  h1s: string[]
  h2s: string[]
  bodyText: string
  emails: string[]
  jobPageLinks: string[]
  techMentions: string[]
}

const TECH_KEYWORDS = [
  'aws', 'azure', 'gcp', 'google cloud', 'kubernetes', 'docker', 'terraform',
  'openai', 'gpt', 'llm', 'machine learning', 'ai', 'artificial intelligence',
  'salesforce', 'hubspot', 'stripe', 'twilio', 'datadog', 'splunk',
  'react', 'node', 'python', 'golang', 'rust', 'java', 'typescript',
]

const JOB_PATH_PATTERNS = [
  '/careers', '/jobs', '/work-with-us', '/join-us', '/hiring',
  '/about/careers', '/company/careers', '/team',
]

export async function crawlWebsite(url: string): Promise<CrawlResult | null> {
  try {
    // Normalize URL
    const normalized = url.startsWith('http') ? url : `https://${url}`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)

    const response = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    })

    clearTimeout(timer)

    if (!response.ok) return null

    const html = await response.text()
    const $ = load(html)

    // Remove noise
    $('script, style, nav, footer, noscript, svg, img, .cookie-banner, #cookie').remove()

    const title = $('title').text().trim().slice(0, 200)
    const description =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      ''

    const h1s = $('h1')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 5)

    const h2s = $('h2')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 10)

    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 4000)

    // Extract emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
    const rawEmails = html.match(emailRegex) || []
    const emails = [
      ...new Set(
        rawEmails.filter(
          (e) => !e.includes('example') && !e.includes('test') && !e.includes('png')
        )
      ),
    ].slice(0, 3)

    // Find job page links
    const allLinks: string[] = $('a[href]')
      .map((_, el) => $(el).attr('href') || '')
      .get()

    const jobPageLinks = allLinks
      .filter((href) =>
        JOB_PATH_PATTERNS.some((p) => href.toLowerCase().includes(p))
      )
      .slice(0, 3)

    // Detect tech mentions
    const lowerText = bodyText.toLowerCase()
    const techMentions = TECH_KEYWORDS.filter((kw) => lowerText.includes(kw))

    return { title, description, h1s, h2s, bodyText, emails, jobPageLinks, techMentions }
  } catch {
    return null
  }
}
