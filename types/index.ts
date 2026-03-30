export interface BusinessProfile {
  name?: string
  description: string
  sells: string[]
  idealCustomer: string
  painPoints: string[]
  targets: string[]        // company types DeepSeek identifies — code turns these into queries
  searchQueries: string[]  // kept for backwards compat, unused in new flow
  mapsQueries: string[]
  industries: string[]
}

export interface RawLead {
  name: string
  website?: string
  phone?: string
  email?: string
  address?: string
  snippet?: string
  source: 'web' | 'maps'
}

export type SignalUrgency = 'high' | 'medium' | 'low'
export type SignalType = 'hiring' | 'cost' | 'growth' | 'tech' | 'news' | 'funding'

export interface PainSignal {
  signal: string
  urgency: SignalUrgency
  type: SignalType
}

export type LeadStatus = 'pending' | 'enriching' | 'done' | 'error'

export interface EnrichedLead {
  id: string
  name: string
  website?: string
  phone?: string
  email?: string
  address?: string
  industry?: string
  companySize?: 'startup' | 'smb' | 'mid-market' | 'enterprise'
  score: number
  painSignals: PainSignal[]
  whyNow: string
  outreachBlueprint: string
  status: LeadStatus
  source: 'web' | 'maps'
  snippet?: string
}

export type SearchStep = 'idle' | 'analyzing' | 'searching' | 'enriching' | 'done' | 'error'

export interface SearchState {
  step: SearchStep
  stepLabel: string
  progress: number
}
