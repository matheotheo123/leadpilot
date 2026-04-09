'use client'

import { motion } from 'framer-motion'
import LeadCard from './LeadCard'
import type { EnrichedLead } from '@/types'

export default function LeadGrid({ leads }: { leads: EnrichedLead[] }) {
  const done = leads.filter((l) => l.status === 'done')
  const rest = leads.filter((l) => l.status !== 'done')
  const sorted = [...done.sort((a, b) => b.score - a.score), ...rest]

  return (
    <div>
      {done.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mb-5"
        >
          <span className="text-xs text-[var(--text-2)]">
            <span className="text-[var(--text)] font-semibold">{done.length}</span> lead{done.length !== 1 ? 's' : ''} found
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] text-[var(--text-3)]">sorted by signal strength</span>
        </motion.div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((lead, i) => (
          <LeadCard key={lead.id || i} lead={lead} index={i} />
        ))}
      </div>
    </div>
  )
}
