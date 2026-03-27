'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, Mail, Globe, MapPin, Copy, Check,
  Zap, TrendingUp, Code2, Newspaper, DollarSign,
  ChevronDown, ChevronUp, Briefcase, ExternalLink, Loader2
} from 'lucide-react'
import clsx from 'clsx'
import type { EnrichedLead, PainSignal, SignalType } from '@/types'

interface LeadCardProps {
  lead: EnrichedLead
  index: number
}

const SIGNAL_CONFIG: Record<SignalType, { icon: typeof Zap; color: string; bg: string }> = {
  hiring: { icon: Briefcase, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  cost: { icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  growth: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  tech: { icon: Code2, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  news: { icon: Newspaper, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  funding: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
}

const URGENCY_GLOW: Record<string, string> = {
  high: 'shadow-red-500/10',
  medium: 'shadow-amber-500/10',
  low: 'shadow-blue-500/5',
}

function AnimatedScore({ target, animate }: { target: number; animate: boolean }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!animate) return
    const duration = 1200
    const start = Date.now()
    const frame = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }, [target, animate])

  const color =
    target >= 80 ? '#34d399' : target >= 60 ? '#60a5fa' : target >= 40 ? '#fbbf24' : '#6b7280'

  return (
    <div className="flex flex-col items-center">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx="28"
          cy="28"
          r="22"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 22}`}
          initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
          animate={{
            strokeDashoffset: animate
              ? 2 * Math.PI * 22 * (1 - target / 100)
              : 2 * Math.PI * 22,
          }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          transform="rotate(-90 28 28)"
        />
        <text
          x="28"
          y="33"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
          fill={color}
        >
          {current}
        </text>
      </svg>
      <span className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">Score</span>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy opener'}
    </button>
  )
}

export default function LeadCard({ lead, index }: LeadCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const isLoading = lead.status === 'pending' || lead.status === 'enriching'
  const isError = lead.status === 'error'

  const scoreColor =
    lead.score >= 80 ? 'text-emerald-400' : lead.score >= 60 ? 'text-blue-400' : 'text-amber-400'

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={visible ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.45, delay: index * 0.04, ease: [0.25, 0.1, 0.25, 1] }}
      className={clsx(
        'relative rounded-2xl overflow-hidden transition-all duration-300',
        !isLoading && `hover:shadow-2xl ${URGENCY_GLOW[lead.painSignals?.[0]?.urgency || 'low']}`
      )}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
      whileHover={!isLoading ? { y: -2, borderColor: 'rgba(255,255,255,0.14)' } : {}}
    >
      {/* Loading skeleton */}
      {isLoading && (
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 w-2/3 rounded-md bg-white/5 animate-pulse" />
              <div className="h-3 w-1/2 rounded-md bg-white/5 animate-pulse" />
            </div>
            <div className="w-14 h-14 rounded-full bg-white/5 animate-pulse" />
          </div>
          <div className="h-3 w-full rounded-md bg-white/5 animate-pulse" />
          <div className="h-3 w-4/5 rounded-md bg-white/5 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-6 w-24 rounded-full bg-white/5 animate-pulse" />
            <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Loader2 size={12} className="animate-spin text-blue-500/60" />
            <span>Extracting pain signals...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-5">
          <p className="font-medium text-white text-sm">{lead.name}</p>
          <p className="text-xs text-zinc-600 mt-1">Could not enrich this lead</p>
        </div>
      )}

      {/* Done state */}
      {lead.status === 'done' && (
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-white text-base leading-tight truncate">
                  {lead.name}
                </h3>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  {lead.source === 'maps' ? '📍 Local' : '🌐 Web'}
                </span>
              </div>
              {lead.industry && (
                <p className="text-zinc-500 text-xs mt-0.5">{lead.industry}</p>
              )}
              {lead.address && (
                <div className="flex items-center gap-1 mt-1">
                  <MapPin size={11} className="text-zinc-600 flex-shrink-0" />
                  <span className="text-zinc-600 text-xs truncate">{lead.address}</span>
                </div>
              )}
            </div>
            <AnimatedScore target={lead.score} animate={visible} />
          </div>

          {/* Contact info */}
          <div
            className="rounded-xl p-3 space-y-2"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Contact</p>
            <div className="grid grid-cols-1 gap-1.5">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  <Phone size={12} className="text-blue-500 flex-shrink-0" />
                  <span className="font-mono">{lead.phone}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <Phone size={12} className="flex-shrink-0" />
                  <span>Phone not found</span>
                </div>
              )}
              {lead.email ? (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  <Mail size={12} className="text-blue-500 flex-shrink-0" />
                  <span className="font-mono truncate">{lead.email}</span>
                </a>
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <Mail size={12} className="flex-shrink-0" />
                  <span>Email not found</span>
                </div>
              )}
              {lead.website && (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  <Globe size={12} className="text-blue-500 flex-shrink-0" />
                  <span className="truncate">{lead.website.replace(/^https?:\/\//, '').slice(0, 40)}</span>
                  <ExternalLink size={10} className="flex-shrink-0 text-zinc-600" />
                </a>
              )}
            </div>
          </div>

          {/* Pain signals */}
          {lead.painSignals?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium mb-2">
                Pain Signals
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.painSignals.slice(0, 4).map((signal: PainSignal, i: number) => {
                  const config = SIGNAL_CONFIG[signal.type] || SIGNAL_CONFIG.tech
                  const Icon = config.icon
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.08 + 0.3 }}
                      className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border',
                        config.bg
                      )}
                    >
                      <Icon size={10} className={config.color} />
                      <span className={clsx('font-medium', config.color)}>
                        {signal.signal.slice(0, 45)}{signal.signal.length > 45 ? '…' : ''}
                      </span>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Expandable section */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
          >
            <span>Why reach out + Outreach opener</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="space-y-3 overflow-hidden"
              >
                {/* Why now */}
                {lead.whyNow && (
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(37,99,235,0.08)',
                      border: '1px solid rgba(37,99,235,0.15)',
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-widest text-blue-400/70 font-medium mb-1.5">
                      Why Now
                    </p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{lead.whyNow}</p>
                  </div>
                )}

                {/* Outreach blueprint */}
                {lead.outreachBlueprint && (
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">
                        Outreach Opener
                      </p>
                      <CopyButton text={lead.outreachBlueprint} />
                    </div>
                    <p className="text-sm text-zinc-400 leading-relaxed italic">
                      &ldquo;{lead.outreachBlueprint}&rdquo;
                    </p>
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
