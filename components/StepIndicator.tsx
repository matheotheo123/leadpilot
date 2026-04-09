'use client'

import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { label: 'Reading business' },
  { label: 'Finding leads' },
  { label: 'Analysing signals' },
  { label: 'Done' },
]

export default function StepIndicator({
  currentStep,
  totalLeads = 0,
  enrichedCount = 0,
}: {
  currentStep: number
  totalLeads?: number
  enrichedCount?: number
}) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((s, i) => {
            const done   = i < currentStep
            const active = i === currentStep
            return (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-300',
                    done   && 'bg-brand border-brand',
                    active && 'border-brand bg-brand/10',
                    !done && !active && 'border-white/10 bg-white/5',
                  )}>
                    {done   ? <Check size={13} className="text-white" /> :
                     active ? <Loader2 size={13} className="text-brand animate-spin" /> :
                              <span className="text-[10px] text-[var(--text-3)] font-mono">{i + 1}</span>}
                  </div>
                  <span className={clsx(
                    'text-[11px] whitespace-nowrap',
                    done || active ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]'
                  )}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 mb-5 h-px bg-white/[0.06] relative overflow-hidden">
                    {done && (
                      <motion.div
                        className="absolute inset-0 bg-brand"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        style={{ transformOrigin: 'left' }}
                        transition={{ duration: 0.4 }}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {currentStep === 2 && totalLeads > 0 && (
          <div>
            <div className="flex justify-between text-[11px] text-[var(--text-3)] mb-1.5">
              <span>Enriching lead {enrichedCount} of {totalLeads}</span>
              <span className="font-mono">{Math.round((enrichedCount / totalLeads) * 100)}%</span>
            </div>
            <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-brand rounded-full"
                animate={{ width: `${(enrichedCount / totalLeads) * 100}%` }}
                transition={{ ease: 'easeOut', duration: 0.3 }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
