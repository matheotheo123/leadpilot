'use client'

import { motion } from 'framer-motion'
import { Calendar, MapPin, ExternalLink, Users, Mic, Zap, Globe, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import type { LeadEvent, EventType } from '@/types'

const TYPE_STYLE: Record<EventType, { label: string; pill: string }> = {
  conference: { label: 'Conference',  pill: 'text-blue-400 border-blue-500/25 bg-blue-500/10' },
  networking: { label: 'Networking',  pill: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10' },
  expo:       { label: 'Expo',        pill: 'text-orange-400 border-orange-500/25 bg-orange-500/10' },
  hackathon:  { label: 'Hackathon',   pill: 'text-purple-400 border-purple-500/25 bg-purple-500/10' },
  meetup:     { label: 'Meetup',      pill: 'text-amber-400 border-amber-500/25 bg-amber-500/10' },
  other:      { label: 'Event',       pill: 'text-[var(--text-3)] border-white/10 bg-white/5' },
}

function EventIcon({ type }: { type: EventType }) {
  if (type === 'networking' || type === 'meetup') return <Users size={13} className="shrink-0" />
  if (type === 'conference') return <Mic size={13} className="shrink-0" />
  if (type === 'hackathon') return <Zap size={13} className="shrink-0" />
  if (type === 'expo') return <Globe size={13} className="shrink-0" />
  return <Calendar size={13} className="shrink-0" />
}

function EventCard({ event, index }: { event: LeadEvent; index: number }) {
  const style = TYPE_STYLE[event.type] ?? TYPE_STYLE.other

  return (
    <motion.a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      className="surface surface-hover rounded-xl p-4 block group transition-colors duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 text-[var(--text-3)] group-hover:text-brand transition-colors">
            <EventIcon type={event.type} />
          </div>
          <h4 className="text-sm font-medium text-[var(--text)] leading-snug line-clamp-2 group-hover:text-brand transition-colors">
            {event.title}
          </h4>
        </div>
        <ExternalLink size={11} className="shrink-0 text-[var(--text-3)] mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <p className="text-xs text-[var(--text-3)] leading-relaxed line-clamp-2 mb-3 ml-[25px]">
        {event.description}
      </p>

      <div className="flex items-center gap-2 flex-wrap ml-[25px]">
        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border font-medium', style.pill)}>
          {style.label}
        </span>

        {event.isLocal && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border text-emerald-400 border-emerald-500/25 bg-emerald-500/10 font-medium">
            📍 Local
          </span>
        )}

        {event.date && (
          <div className="flex items-center gap-1 text-[11px] text-[var(--text-3)]">
            <Calendar size={10} />
            {event.date}
          </div>
        )}

        {event.location && event.location !== 'Location TBD' && (
          <div className="flex items-center gap-1 text-[11px] text-[var(--text-3)]">
            <MapPin size={10} />
            <span className="truncate max-w-[140px]">{event.location}</span>
          </div>
        )}
      </div>
    </motion.a>
  )
}

interface Props {
  events: LeadEvent[]
  loading: boolean
}

export default function EventsSection({ events, loading }: Props) {
  if (!loading && events.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="mt-10"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-brand" />
          <span className="text-xs font-semibold text-[var(--text)]">Relevant Events</span>
        </div>
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[11px] text-[var(--text-3)]">conferences · networking · expos</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--text-3)] py-4">
          <Loader2 size={13} className="animate-spin text-brand" />
          Finding relevant events…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {events.map((event, i) => (
            <EventCard key={event.url} event={event} index={i} />
          ))}
        </div>
      )}
    </motion.div>
  )
}
