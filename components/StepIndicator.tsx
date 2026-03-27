'use client'

import { motion } from 'framer-motion'
import { Check, Loader2, Cpu, Search, Zap, Database } from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { id: 'analyzing', label: 'Analyzing business', icon: Cpu },
  { id: 'searching', label: 'Scanning for leads', icon: Search },
  { id: 'enriching', label: 'Extracting signals', icon: Zap },
  { id: 'saving', label: 'Saving results', icon: Database },
]

interface StepIndicatorProps {
  currentStep: number
  totalLeads?: number
  enrichedCount?: number
}

export default function StepIndicator({ currentStep, totalLeads, enrichedCount }: StepIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="w-full max-w-2xl mx-auto mb-10"
    >
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Steps */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon
            const isComplete = index < currentStep
            const isActive = index === currentStep
            const isPending = index > currentStep

            return (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <motion.div
                    animate={
                      isActive
                        ? { scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }
                        : {}
                    }
                    transition={
                      isActive
                        ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                        : {}
                    }
                    className={clsx(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500',
                      isComplete && 'bg-blue-600',
                      isActive && 'bg-blue-600/20 border border-blue-500/60',
                      isPending && 'bg-white/5 border border-white/10'
                    )}
                  >
                    {isComplete ? (
                      <Check size={16} className="text-white" />
                    ) : isActive ? (
                      <Loader2 size={16} className="text-blue-400 animate-spin" />
                    ) : (
                      <Icon size={16} className="text-zinc-600" />
                    )}
                  </motion.div>
                  <span
                    className={clsx(
                      'text-xs mt-2 text-center leading-tight',
                      isComplete || isActive ? 'text-zinc-300' : 'text-zinc-600'
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 mb-5">
                    <div className="h-px bg-white/10 relative overflow-hidden">
                      {(isComplete || (isActive && index === 0)) && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: isComplete ? '100%' : '60%' }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="absolute inset-y-0 left-0 bg-blue-600"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress detail */}
        {currentStep === 2 && totalLeads && totalLeads > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-5"
          >
            <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
              <span>Enriching leads with Pain Signal Intelligence</span>
              <span className="text-zinc-400 font-mono">
                {enrichedCount}/{totalLeads}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400"
                animate={{
                  width: `${Math.round(((enrichedCount || 0) / totalLeads) * 100)}%`,
                }}
                transition={{ ease: 'easeOut', duration: 0.4 }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
