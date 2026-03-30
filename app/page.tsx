'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, RotateCcw, TrendingUp, MapPin, Globe } from 'lucide-react'
import AnimatedBackground from '@/components/AnimatedBackground'
import SearchPanel from '@/components/SearchPanel'
import StepIndicator from '@/components/StepIndicator'
import LeadGrid from '@/components/LeadGrid'
import type { EnrichedLead, BusinessProfile } from '@/types'

type AppStep = 'idle' | 'analyzing' | 'searching' | 'enriching' | 'done' | 'error'

const STEP_INDEX: Record<AppStep, number> = {
  idle: -1,
  analyzing: 0,
  searching: 1,
  enriching: 2,
  done: 3,
  error: -1,
}

export default function Home() {
  const [appStep, setAppStep] = useState<AppStep>('idle')
  const [leads, setLeads] = useState<EnrichedLead[]>([])
  const [enrichedCount, setEnrichedCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reset = () => {
    setAppStep('idle')
    setLeads([])
    setEnrichedCount(0)
    setErrorMsg(null)
  }

  const handleSearch = useCallback(
    async (params: { type: 'description' | 'url'; value: string; location: string }) => {
      setAppStep('analyzing')
      setLeads([])
      setEnrichedCount(0)
      setErrorMsg(null)

      try {
        // ── Step 1: Analyze ──────────────────────────────────────────────
        const analyzeRes = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: params.type, value: params.value }),
        })
        const analyzeData = await analyzeRes.json()
        if (!analyzeRes.ok) throw new Error(analyzeData?.error || 'Analyze step failed — check your DEEPSEEK_API_KEY in Vercel.')
        const { profile }: { profile: BusinessProfile } = analyzeData

        // ── Step 2: Search ───────────────────────────────────────────────
        setAppStep('searching')
        const searchRes = await fetch('/api/search-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: params.location,
            businessProfile: profile,
          }),
        })
        const searchData = await searchRes.json()
        if (!searchRes.ok) throw new Error(searchData?.error || 'Search step failed — check your SERPER_API_KEY in Vercel.')
        const { leads: rawLeads } = searchData

        if (!rawLeads || rawLeads.length === 0) {
          setAppStep('error')
          setErrorMsg('Serper returned 0 results. Your API key may be missing quota, or check it in Vercel → Settings → Environment Variables.')
          return
        }

        // Seed placeholder cards immediately so the user sees something
        const placeholders: EnrichedLead[] = rawLeads.map(
          (l: Partial<EnrichedLead>, i: number) => ({
            id: `placeholder-${i}`,
            name: l.name || 'Unknown',
            website: l.website,
            phone: l.phone,
            address: l.address,
            snippet: l.snippet,
            source: l.source || 'web',
            score: 0,
            painSignals: [],
            whyNow: '',
            outreachBlueprint: '',
            status: 'pending',
          })
        )
        setLeads(placeholders)

        // ── Step 3: Enrich each lead sequentially ────────────────────────
        setAppStep('enriching')
        let count = 0

        for (let i = 0; i < rawLeads.length; i++) {
          // Mark as enriching
          setLeads((prev) =>
            prev.map((l, idx) => (idx === i ? { ...l, status: 'enriching' } : l))
          )

          try {
            const enrichRes = await fetch('/api/enrich-lead', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead: rawLeads[i], businessProfile: profile }),
            })

            if (enrichRes.ok) {
              const { enriched }: { enriched: EnrichedLead } = await enrichRes.json()
              setLeads((prev) =>
                prev.map((l, idx) => (idx === i ? { ...enriched, status: 'done' } : l))
              )
            } else {
              setLeads((prev) =>
                prev.map((l, idx) => (idx === i ? { ...l, status: 'error' } : l))
              )
            }
          } catch {
            setLeads((prev) =>
              prev.map((l, idx) => (idx === i ? { ...l, status: 'error' } : l))
            )
          }

          count++
          setEnrichedCount(count)
        }

        setAppStep('done')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.')
        setAppStep('error')
      }
    },
    []
  )

  const isLoading = appStep === 'analyzing' || appStep === 'searching' || appStep === 'enriching'
  const showResults = leads.length > 0
  const stepIndex = STEP_INDEX[appStep]

  return (
    <main className="min-h-screen bg-black text-white relative">
      <AnimatedBackground />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── Navbar ─────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-white tracking-tight">LeadPilot</span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{
                background: 'rgba(37,99,235,0.15)',
                border: '1px solid rgba(37,99,235,0.3)',
                color: '#60a5fa',
              }}
            >
              BETA
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4"
          >
            {showResults && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <RotateCcw size={13} />
                <span>New Search</span>
              </button>
            )}
            <div
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
              Pain Signal Engine
            </div>
          </motion.div>
        </nav>

        {/* ── Main content ───────────────────────────────────────────── */}
        <div className="flex-1 px-4 sm:px-6 max-w-7xl mx-auto w-full pb-24">
          <AnimatePresence mode="wait">
            {/* Hero state — no search yet */}
            {appStep === 'idle' && (
              <motion.div
                key="hero"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center text-center pt-20 pb-12"
              >
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
                  style={{
                    background: 'rgba(37,99,235,0.1)',
                    border: '1px solid rgba(37,99,235,0.25)',
                    color: '#93c5fd',
                  }}
                >
                  <Zap size={11} />
                  Pain Signal Intelligence Engine
                </motion.div>

                {/* Headline */}
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 max-w-3xl"
                >
                  Find your next client
                  <br />
                  <span className="gradient-text-blue">before they find you.</span>
                </motion.h1>

                {/* Subheadline */}
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-zinc-500 text-lg max-w-xl mb-12 leading-relaxed"
                >
                  Describe what you sell. We crawl the web, detect pain signals, and deliver
                  leads ranked by how badly they need you — with a personalized opener for each.
                </motion.p>

                {/* Feature pills */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                  className="flex flex-wrap items-center justify-center gap-2 mb-12"
                >
                  {[
                    { icon: MapPin, label: 'Local + global leads' },
                    { icon: TrendingUp, label: 'Intent signal scoring' },
                    { icon: Globe, label: 'Website DNA analysis' },
                    { icon: Zap, label: 'Personalized outreach' },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-zinc-400"
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}
                    >
                      <Icon size={11} className="text-blue-500" />
                      {label}
                    </div>
                  ))}
                </motion.div>

                <SearchPanel onSearch={handleSearch} loading={isLoading} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Loading / Results ─────────────────────────────────── */}
          <AnimatePresence>
            {(isLoading || showResults || appStep === 'error' || appStep === 'done') && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pt-6"
              >
                {/* Step indicator */}
                {isLoading && (
                  <StepIndicator
                    currentStep={stepIndex}
                    totalLeads={leads.length}
                    enrichedCount={enrichedCount}
                  />
                )}

                {/* Compact search bar when we have results */}
                {showResults && !isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                  >
                    <SearchPanel onSearch={handleSearch} loading={isLoading} />
                  </motion.div>
                )}

                {/* Error */}
                {(appStep === 'error' || (appStep === 'done' && !showResults)) && errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-lg mx-auto text-center py-12"
                  >
                    <div
                      className="rounded-2xl p-8"
                      style={{
                        background: 'rgba(239,68,68,0.05)',
                        border: '1px solid rgba(239,68,68,0.15)',
                      }}
                    >
                      <p className="text-red-400 font-medium mb-2">Something went wrong</p>
                      <p className="text-zinc-400 text-sm mb-4 leading-relaxed">{errorMsg}</p>
                      <a
                        href="/api/debug"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-5"
                      >
                        → Open /api/debug to check API key status
                      </a>
                      <button
                        onClick={reset}
                        className="flex items-center gap-2 mx-auto text-sm text-zinc-300 hover:text-white transition-colors"
                      >
                        <RotateCcw size={14} />
                        Try again
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Lead grid */}
                {showResults && <LeadGrid leads={leads} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="border-t border-white/5 py-5 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center">
                <Zap size={9} className="text-white" />
              </div>
              <span className="text-xs text-zinc-600">LeadPilot</span>
            </div>
            <p className="text-xs text-zinc-700">
              Powered by DeepSeek · Serper · Built in-house
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}
