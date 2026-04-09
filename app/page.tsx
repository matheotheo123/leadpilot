'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RotateCcw, ExternalLink } from 'lucide-react'
import AnimatedBackground from '@/components/AnimatedBackground'
import SearchPanel from '@/components/SearchPanel'
import StepIndicator from '@/components/StepIndicator'
import LeadGrid from '@/components/LeadGrid'
import type { EnrichedLead, BusinessProfile } from '@/types'

type Step = 'idle' | 'analyzing' | 'searching' | 'enriching' | 'done' | 'error'

const STEP_INDEX: Record<Step, number> = {
  idle: -1, analyzing: 0, searching: 1, enriching: 2, done: 3, error: -1,
}

export default function Home() {
  const [step, setStep]               = useState<Step>('idle')
  const [leads, setLeads]             = useState<EnrichedLead[]>([])
  const [enrichedCount, setEnriched]  = useState(0)
  const [error, setError]             = useState<string | null>(null)

  const reset = () => { setStep('idle'); setLeads([]); setEnriched(0); setError(null) }

  const handleSearch = useCallback(async (
    params: { type: 'description' | 'url'; value: string; location: string }
  ) => {
    setStep('analyzing'); setLeads([]); setEnriched(0); setError(null)

    try {
      // 1 — Analyze
      const ar = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: params.type, value: params.value }),
      })
      const ad = await ar.json()
      if (!ar.ok) throw new Error(ad?.error || 'Analysis failed — check DEEPSEEK_API_KEY in Vercel.')
      const { profile }: { profile: BusinessProfile } = ad

      // 2 — Search
      setStep('searching')
      const sr = await fetch('/api/search-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: params.location, businessProfile: profile }),
      })
      const sd = await sr.json()
      if (!sr.ok) throw new Error(sd?.error || 'Search failed — check SERPER_API_KEY in Vercel.')

      const rawLeads: EnrichedLead[] = sd.leads ?? []
      if (!rawLeads.length) throw new Error(sd?.error || 'No companies found. Try a different description or location.')

      // Seed placeholder cards
      setLeads(rawLeads.map((l, i) => ({
        id: `p-${i}`, name: l.name, website: l.website, phone: l.phone,
        address: l.address, snippet: l.snippet, source: l.source ?? 'web',
        score: 0, painSignals: [], whyNow: '', outreachBlueprint: '', status: 'pending',
      })))

      // 3 — Enrich each lead
      setStep('enriching')
      for (let i = 0; i < rawLeads.length; i++) {
        setLeads((p) => p.map((l, idx) => idx === i ? { ...l, status: 'enriching' } : l))
        try {
          const er = await fetch('/api/enrich-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead: rawLeads[i], businessProfile: profile }),
          })
          if (er.ok) {
            const { enriched } = await er.json()
            setLeads((p) => p.map((l, idx) => idx === i ? { ...enriched, status: 'done' } : l))
          } else {
            setLeads((p) => p.map((l, idx) => idx === i ? { ...l, status: 'error' } : l))
          }
        } catch {
          setLeads((p) => p.map((l, idx) => idx === i ? { ...l, status: 'error' } : l))
        }
        setEnriched((n) => n + 1)
      }

      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setStep('error')
    }
  }, [])

  const loading     = step === 'analyzing' || step === 'searching' || step === 'enriching'
  const hasResults  = leads.length > 0
  const showResults = loading || hasResults || step === 'error' || step === 'done'

  return (
    <main className="min-h-screen relative">
      <AnimatedBackground />

      <div className="relative z-10 flex flex-col min-h-screen">

        {/* Nav */}
        <nav className="flex items-center justify-between px-5 py-4 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center">
              <Zap size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-[var(--text)]">LeadPilot</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-brand/30 bg-brand/10 text-brand font-medium">BETA</span>
          </div>
          <div className="flex items-center gap-4">
            {hasResults && (
              <button onClick={reset} className="flex items-center gap-1.5 text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                <RotateCcw size={12} /> New search
              </button>
            )}
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
              Hiring signal engine
            </div>
          </div>
        </nav>

        {/* Main */}
        <div className="flex-1 px-4 sm:px-5 max-w-6xl mx-auto w-full pb-20">

          {/* Hero */}
          <AnimatePresence mode="wait">
            {step === 'idle' && (
              <motion.div
                key="hero"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center text-center pt-24 pb-14"
              >
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="inline-flex items-center gap-2 text-[11px] font-medium px-3 py-1.5 rounded-full border border-brand/25 bg-brand/8 text-brand mb-7"
                >
                  <Zap size={10} /> Hiring Signal Intelligence
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.08] mb-5 max-w-2xl"
                  style={{ letterSpacing: '-0.03em' }}
                >
                  Find clients who<br />
                  <span style={{ color: 'var(--brand)' }}>need you right now.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm text-[var(--text-2)] max-w-md mb-10 leading-relaxed"
                >
                  Describe what you sell. We find mid-size companies actively hiring for roles
                  your service replaces — that hiring pattern is the strongest buying signal possible.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap justify-center gap-2 mb-10"
                >
                  {[
                    '📋 Hiring signal detection',
                    '🎯 5 deep leads per search',
                    '📍 Local + global',
                    '✉️ Personalized openers',
                  ].map((f) => (
                    <span key={f} className="text-[11px] text-[var(--text-3)] px-2.5 py-1 rounded-full border border-white/[0.07] bg-white/[0.03]">{f}</span>
                  ))}
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="w-full">
                  <SearchPanel onSearch={handleSearch} loading={loading} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results / loading */}
          {showResults && (
            <div className="pt-6">
              {loading && (
                <StepIndicator
                  currentStep={STEP_INDEX[step]}
                  totalLeads={leads.length}
                  enrichedCount={enrichedCount}
                />
              )}

              {hasResults && !loading && (
                <div className="mb-6">
                  <SearchPanel onSearch={handleSearch} loading={loading} />
                </div>
              )}

              {/* Error */}
              {(step === 'error' || (step === 'done' && !hasResults)) && error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-md mx-auto text-center py-16"
                >
                  <div className="surface rounded-xl p-7">
                    <p className="text-sm font-medium text-[var(--text)] mb-2">Search failed</p>
                    <p className="text-xs text-[var(--text-2)] leading-relaxed mb-5">{error}</p>
                    <a
                      href="/api/debug"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors mb-5"
                    >
                      Diagnose API keys at /api/debug <ExternalLink size={10} />
                    </a>
                    <div>
                      <button onClick={reset} className="flex items-center gap-1.5 mx-auto text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                        <RotateCcw size={12} /> Try again
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {hasResults && <LeadGrid leads={leads} />}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-white/[0.05] py-4 px-5">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-brand flex items-center justify-center">
                <Zap size={9} className="text-white" />
              </div>
              <span className="text-[11px] text-[var(--text-3)]">LeadPilot</span>
            </div>
            <p className="text-[11px] text-[var(--text-3)]">DeepSeek · Serper · Built to find buyers, not pages</p>
          </div>
        </footer>
      </div>
    </main>
  )
}
