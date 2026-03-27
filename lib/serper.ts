const SERPER_BASE = 'https://google.serper.dev'

async function serperRequest(endpoint: string, body: object) {
  const response = await fetch(`${SERPER_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.SERPER_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Serper error ${response.status}`)
  }

  return response.json()
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
  cid?: string
}

export interface SerperPlacesResponse {
  places: SerperPlace[]
}

export async function serperSearch(
  query: string,
  num = 10
): Promise<SerperSearchResponse> {
  return serperRequest('/search', { q: query, num })
}

export async function serperPlaces(
  query: string,
  location?: string,
  num = 20
): Promise<SerperPlacesResponse> {
  const q = location ? `${query} near ${location}` : query
  return serperRequest('/places', { q, num })
}

export async function serperNews(query: string, num = 5): Promise<{
  news: Array<{ title: string; snippet: string; date?: string }>
}> {
  return serperRequest('/news', { q: query, num })
}
