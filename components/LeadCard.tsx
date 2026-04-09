'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Mail, Globe, MapPin, Copy, Check, ChevronDown,
  Briefcase, DollarSign, TrendingUp, Code2, Newspaper, Loader2, ExternalLink
} from 'lucide-react'
import clsx from 'clsx'
import type { EnrichedLead, PainSignal, SignalType } from '@/types'

const SIGNAL_STYLE: Record<SignalType, { icon: typeof Briefcase; pill: string; dot: string }> = {
  hiring:  { icon: Briefcase,    pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',  dot: 'bg-emerald-400' },
  cost:    { icon: DollarSign,   pill: 'bg-amber-500/10 text-amber-400 border-amber-500/20',        dot: 'bg-amber-400' },
  growth:  { icon: TrendingUp,   pill: 'bg-blue-500/10 text-blue-400 border-blue-500/20',           dot: 'bg-blue-400' },
  tech:    { icon: Code2,        pill: 'bg-purple-500/10 text-purple-400 border-purple-500/20',     dot: 'bg-purple-400' },
  news:    { icon: Newspaper,    pill: 'bg-orange-500/10 text-orange-400 border-orange-500/20',     dot: 'bg-orange-400' },
  funding: { icon: TrendingUp,   pill: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
}

function ScoreRing({ score, visible }: { score: number; visible: boolean }) {
  const [display, setDisplay] = useState(0)
  const r = 20, circ = 2 * Math.PI * r

  useEffect(() => {
    if (!visible) return
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / 900, 1)
      setDisplay(Math.round(p * score))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [score, visible])

  const color = score >= 75 ? '#3ecf8e' : score >= 50 ? '#0070f3' : '#f5a623'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <motion.circle
          cx="26" cy="26" r={r}
          fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: visible ? circ * (1 - score / 100) : circ }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
          transform="rotate(-90 26 26)"
        />
        <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="600"
          fontFamily="var(--font-geist-mono)" fill={color}>{display}</text>
      </svg>
      <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Score</span>
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000) }}
      className="flex items-center gap-1 text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
    >
      {done ? <><Check size={11} className="text-emerald-400" /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  )
}

export default function LeadCard({ lead, index }: { lead: EnrichedLead; index: number }) {
  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])

  const loading = lead.status === 'pending' || lead.status === 'enriching'

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
      className="surface surface-hover rounded-xl overflow-hidden transition-colors duration-200"
    >
      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div className="space-y-2 flex-1 pr-4">
              <div className="skeleton h-4 w-3/5" />
              <div className="skeleton h-3 w-2/5" />
            </div>
            <div className="skeleton w-12 h-12 rounded-full" />
          </div>
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
          <div className="flex gap-2">
            <div className="skeleton h-5 w-28 rounded-full" />
            <div className="skeleton h-5 w-24 rounded-full" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] pt-1">
            <Loader2 size={11} className="animate-spin text-brand" />
            {lead.status === 'enriching' ? 'Reading job postings & signals…' : 'Queued…'}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {lead.status === 'error' && (
        <div className="p-4">
          <p className="text-sm font-medium text-[var(--text)]">{lead.name}</p>
          <p className="text-xs text-[var(--text-3)] mt-0.5">Could not enrich this lead</p>
        </div>
      )}

      {/* ── Done ── */}
      {lead.status === 'done' && (
        <div className="p-4 space-y-3.5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-[var(--text)] text-sm leading-snug">{lead.name}</h3>
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded border font-medium',
                  lead.source === 'maps'
                    ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10'
                    : 'text-[var(--text-3)] border-white/10 bg-white/5'
                )}>
                  {lead.source === 'maps' ? '📍 Local' : '🌐 Web'}
                </span>
              </div>
              {lead.industry && <p className="text-xs text-[var(--text-3)] mt-0.5">{lead.industry}</p>}
              {lead.address && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={10} className="text-[var(--text-3)] shrink-0" />
                  <span className="text-xs text-[var(--text-3)] truncate">{lead.address}</span>
                </div>
              )}
            </div>
            <ScoreRing score={lead.score} visible={visible} />
          </div>

          {/* Contact */}
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)] font-medium">Contact</p>
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                <Phone size={11} className="text-brand shrink-0" />
                <span className="font-mono">{lead.phone}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                <Phone size={11} className="shrink-0" /><span>Phone not found</span>
              </div>
            )}
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                <Mail size={11} className="text-brand shrink-0" />
                <span className="truncate font-mono">{lead.email}</span>
              </a>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
                <Mail size={11} className="shrink-0" /><span>Email not found</span>
              </div>
            )}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[var(--text-2)] hover:text-[var(--text)] transition-colors">
                <Globe size={11} className="text-brand shrink-0" />
                <span className="truncate">{lead.website.replace(/^https?:\/\//, '').slice(0, 45)}</span>
                <ExternalLink size={9} className="shrink-0 text-[var(--text-3)]" />
              </a>
            )}
          </div>

          {/* Pain signals */}
          {lead.painSignals?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)] font-medium mb-2">Signals</p>
              <div className="flex flex-wrap gap-1.5">
                {lead.painSignals.slice(0, 3).map((s: PainSignal, i: number) => {
                  const style = SIGNAL_STYLE[s.type] ?? SIGNAL_STYLE.tech
                  const Icon = style.icon
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.07 + 0.2 }}
                      className={clsx('flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] border font-medium', style.pill)}
                    >
                      <Icon size={10} />
                      {s.signal.slice(0, 48)}{s.signal.length > 48 ? '…' : ''}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Toggle: why now + opener */}
          <button
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors py-0.5"
          >
            <span>Why reach out + outreach opener</span>
            <ChevronDown size={13} className={clsx('transition-transform duration-200', open && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden space-y-2.5"
              >
                {lead.whyNow && (
                  <div className="rounded-lg bg-brand/[0.07] border border-brand/20 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-brand/60 font-medium mb-1.5">Why now</p>
                    <p className="text-xs text-[var(--text-2)] leading-relaxed">{lead.whyNow}</p>
                  </div>
                )}
                {lead.outreachBlueprint && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)] font-medium">Opener</p>
                      <CopyBtn text={lead.outreachBlueprint} />
                    </div>
                    <p className="text-xs text-[var(--text-2)] leading-relaxed italic">"{lead.outreachBlueprint}"</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
