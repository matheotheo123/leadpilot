import { load } from 'cheerio'

export interface DecisionMaker {
  name: string
  role: string
  email?: string
}

export interface CrawlResult {
  title: string
  description: string
  h1s: string[]
  h2s: string[]
  bodyText: string
  emails: string[]
  jobPageLinks: string[]
  techMentions: string[]
  decisionMakers: DecisionMaker[]
  employeeCount?: string
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

// Seniority keywords used to detect decision makers
const SENIORITY_TITLES = [
  'ceo', 'cto', 'coo', 'cfo', 'cmo', 'cso',
  'chief executive', 'chief technology', 'chief operating', 'chief financial',
  'founder', 'co-founder', 'cofounder',
  'president', 'managing director', 'managing partner',
  'vp ', 'vice president', 'head of', 'director of', 'director,',
  'partner,', 'principal',
]

// Common secondary pages that often have contact info / team info
const SECONDARY_PATHS = [
  '/contact', '/contact-us', '/contact.html',
  '/about', '/about-us', '/about.html', '/our-story',
  '/team', '/our-team', '/people', '/leadership', '/management',
]

function getBaseUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return `${u.protocol}//${u.host}`
  } catch {
    return url.startsWith('http') ? url : `https://${url}`
  }
}

async function fetchPage(url: string, timeoutMs = 5000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    })
    clearTimeout(timer)
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

function extractEmails(html: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const raw = html.match(emailRegex) || []
  return [...new Set(raw.filter(
    e => !e.includes('example') && !e.includes('test') && !e.includes('.png')
      && !e.includes('sentry') && !e.includes('wixpress') && !e.includes('squarespace')
      && e.length < 60
  ))]
}

function extractDecisionMakers(html: string): DecisionMaker[] {
  const $ = load(html)
  const makers: DecisionMaker[] = []
  const seen = new Set<string>()

  // Strategy 1: Look for elements near seniority title keywords
  $('*').each((_, el) => {
    const text = $(el).text().trim()
    if (!text || text.length > 200 || text.length < 5) return

    const lower = text.toLowerCase()
    const hasTitle = SENIORITY_TITLES.some(t => lower.includes(t))
    if (!hasTitle) return

    // Extract a name candidate: look for capitalized words before or after the title
    // Pattern: "John Smith, CEO" or "CEO: John Smith" or just a card with both
    const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)[,\s\n\r|–-]+(.{3,80})$/)
      || text.match(/^(.{3,80})[,\s\n\r|–-]+([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)$/)

    if (nameMatch) {
      // Determine which group is name vs role
      const g1Lower = nameMatch[1].toLowerCase()
      const hasTitle1 = SENIORITY_TITLES.some(t => g1Lower.includes(t))
      const name = hasTitle1 ? nameMatch[2].trim() : nameMatch[1].trim()
      const role = hasTitle1 ? nameMatch[1].trim() : nameMatch[2].trim()

      // Validate: name should have 2 capitalized words, role should have a title keyword
      const nameWords = name.split(/\s+/)
      if (nameWords.length < 2 || nameWords.length > 4) return
      const roleHasTitle = SENIORITY_TITLES.some(t => role.toLowerCase().includes(t))
      if (!roleHasTitle) return

      const key = name.toLowerCase().replace(/\s/g, '')
      if (!seen.has(key)) {
        seen.add(key)
        makers.push({ name, role: role.slice(0, 80) })
      }
    }
  })

  // Strategy 2: Schema.org Person markup
  $('[itemtype*="Person"], [itemtype*="person"]').each((_, el) => {
    const name = $(el).find('[itemprop="name"]').first().text().trim()
    const role = $(el).find('[itemprop="jobTitle"]').first().text().trim()
    if (name && role) {
      const key = name.toLowerCase().replace(/\s/g, '')
      if (!seen.has(key)) {
        seen.add(key)
        makers.push({ name, role })
      }
    }
  })

  return makers.slice(0, 6)
}

function guessEmailsForDecisionMakers(
  makers: DecisionMaker[],
  domain: string,
  knownEmails: string[]
): DecisionMaker[] {
  if (!makers.length) return makers

  // Detect email format from existing emails: first.last@, flast@, firstlast@, first@
  let format: 'first.last' | 'firstlast' | 'flast' | 'first' | null = null
  for (const email of knownEmails) {
    const local = email.split('@')[0].toLowerCase()
    if (/^[a-z]+\.[a-z]+$/.test(local)) { format = 'first.last'; break }
    if (/^[a-z]{1}[a-z]+$/.test(local) && local.length < 12) { format = 'flast'; break }
    if (/^[a-z]+$/.test(local) && local.length < 8) { format = 'first'; break }
  }

  return makers.map(m => {
    const parts = m.name.toLowerCase().split(/\s+/)
    const first = parts[0]
    const last = parts[parts.length - 1]
    let email: string | undefined
    if (format === 'first.last') email = `${first}.${last}@${domain}`
    else if (format === 'flast') email = `${first[0]}${last}@${domain}`
    else if (format === 'first') email = `${first}@${domain}`
    return email ? { ...m, email } : m
  })
}

function extractEmployeeCount(text: string): string | undefined {
  const patterns = [
    /(\d[\d,]+)\s*\+?\s*(employees|staff|people|team members)/i,
    /team\s+of\s+(\d[\d,]+)/i,
    /(\d[\d,]+)\s*\+?\s*person\s+team/i,
    /(small|growing|passionate)\s+team\s+of\s+(\d[\d,]+)/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[0].slice(0, 60)
  }
  return undefined
}

export async function crawlWebsite(url: string): Promise<CrawlResult | null> {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`
    const base = getBaseUrl(normalized)

    // 1. Fetch homepage first
    const homeHtml = await fetchPage(normalized, 7000)
    if (!homeHtml) return null

    const $ = load(homeHtml)

    // 2. Find internal links to secondary pages from homepage
    const internalLinks = new Set<string>()
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      // Internal relative or same-host links
      if (href.startsWith('/')) {
        const full = base + href.split('?')[0].split('#')[0]
        if (SECONDARY_PATHS.some(p => full.toLowerCase().includes(p))) {
          internalLinks.add(full)
        }
      } else if (href.startsWith(base)) {
        const path = href.replace(base, '').split('?')[0]
        if (SECONDARY_PATHS.some(p => path.toLowerCase().includes(p))) {
          internalLinks.add(base + path)
        }
      }
    })

    // Also try common paths regardless of whether they're linked
    const predictedPaths = SECONDARY_PATHS.map(p => base + p)
    const toFetch = [
      ...new Set([...internalLinks, ...predictedPaths])
    ].slice(0, 6) // max 6 secondary pages

    // 3. Crawl secondary pages in parallel (5s timeout each)
    const secondaryResults = await Promise.allSettled(
      toFetch.map(u => fetchPage(u, 5000))
    )

    const allHtmlPages = [
      homeHtml,
      ...secondaryResults
        .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((h): h is string => h !== null),
    ]

    // 4. Aggregate data across all pages
    const allEmails: string[] = []
    const allDecisionMakers: DecisionMaker[] = []
    const allBodyText: string[] = []

    for (const html of allHtmlPages) {
      allEmails.push(...extractEmails(html))
      allDecisionMakers.push(...extractDecisionMakers(html))
    }

    // 5. Parse homepage for structured data
    $('script, style, nav, footer, noscript, svg, img, .cookie-banner, #cookie').remove()

    const title = $('title').text().trim().slice(0, 200)
    const description =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      ''

    const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 5)
    const h2s = $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 10)

    const homeBodyText = $('body').text().replace(/\s+/g, ' ').trim()
    allBodyText.push(homeBodyText)

    // Add about/team page text too
    for (const html of allHtmlPages.slice(1)) {
      const $2 = load(html)
      $2('script, style, nav, footer').remove()
      allBodyText.push($2('body').text().replace(/\s+/g, ' ').trim().slice(0, 1500))
    }

    const mergedBodyText = allBodyText.join(' ').slice(0, 5000)

    // Find job page links
    const allLinks: string[] = $('a[href]').map((_, el) => $(el).attr('href') || '').get()
    const jobPageLinks = allLinks
      .filter(href => JOB_PATH_PATTERNS.some(p => href.toLowerCase().includes(p)))
      .slice(0, 3)

    // Detect tech mentions
    const lowerText = mergedBodyText.toLowerCase()
    const techMentions = TECH_KEYWORDS.filter(kw => lowerText.includes(kw))

    // Deduplicate emails
    const domain = new URL(normalized).hostname.replace(/^www\./, '')
    const uniqueEmails = [...new Set(allEmails)].slice(0, 6)

    // Deduplicate decision makers and guess emails from format
    const seenMakers = new Set<string>()
    const uniqueMakers = allDecisionMakers.filter(m => {
      const k = m.name.toLowerCase().replace(/\s/g, '')
      if (seenMakers.has(k)) return false
      seenMakers.add(k)
      return true
    }).slice(0, 5)

    const makersWithEmails = guessEmailsForDecisionMakers(uniqueMakers, domain, uniqueEmails)

    const employeeCount = extractEmployeeCount(mergedBodyText)

    return {
      title,
      description,
      h1s,
      h2s,
      bodyText: mergedBodyText,
      emails: uniqueEmails,
      jobPageLinks,
      techMentions,
      decisionMakers: makersWithEmails,
      employeeCount,
    }
  } catch {
    return null
  }
}
