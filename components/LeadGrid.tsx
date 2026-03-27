'use client'

import { motion } from 'framer-motion'
import LeadCard from './LeadCard'
import type { EnrichedLead } from '@/types'

interface LeadGridProps {
  leads: EnrichedLead[]
}

export default function LeadGrid({ leads }: LeadGridProps) {
  const done = leads.filter((l) => l.status === 'done')
  const sorted = [
    ...done.sort((a, b) => b.score - a.score),
    ...leads.filter((l) => l.status !== 'done'),
  ]

  return (
    <div className="w-full">
      {done.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 mb-6"
        >
          <p className="text-sm text-zinc-400">
            <span className="text-white font-semibold">{done.length}</span> leads found
          </p>
          <div className="h-px flex-1 bg-white/5" />
          <p className="text-xs text-zinc-600">Sorted by signal strength</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((lead, index) => (
          <LeadCard key={lead.id || index} lead={lead} index={index} />
        ))}
      </div>
    </div>
  )
}
