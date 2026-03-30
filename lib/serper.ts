const SERPER_BASE = 'https://google.serper.dev'

async function serperRequest(endpoint: string, body: object) {
  const key = process.env.SERPER_API_KEY
  if (!key) throw new Error('SERPER_API_KEY environment variable is not set')

  const response = await fetch(`${SERPER_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    // Surface the actual Serper error message (e.g. "Invalid API key", "Quota exceeded")
    const msg = data?.message || data?.error || `HTTP ${response.status}`
    throw new Error(`Serper: ${msg}`)
  }

  return data
}

export interface SerperOrganicResult {
  title: string
  link: string
  snippet: string
  position?: number
}

export interface SerperSearchResponse {
  organic: SerperOrganicResult[]
  answerBox?: { answer?: string; snippet?: string }
}

export interface SerperPlace {
  title: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviewsCount?: number
  category?: string
}

export interface SerperPlacesResponse {
  places: SerperPlace[]
}

export async function serperSearch(query: string, num = 10): Promise<SerperSearchResponse> {
  return serperRequest('/search', { q: query, num })
}

export async function serperPlaces(
  query: string,
  location?: string,
  num = 20
): Promise<SerperPlacesResponse> {
  // Pass location as a separate field, not embedded in the query string
  const body: Record<string, unknown> = { q: query, num }
  if (location) body.location = location
  return serperRequest('/places', body)
}

export async function serperNews(
  query: string,
  num = 5
): Promise<{ news: Array<{ title: string; snippet: string; date?: string }> }> {
  return serperRequest('/news', { q: query, num })
}
