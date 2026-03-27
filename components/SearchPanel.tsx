'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, FileText, MapPin, Zap, ArrowRight } from 'lucide-react'
import clsx from 'clsx'

interface SearchPanelProps {
  onSearch: (params: { type: 'description' | 'url'; value: string; location: string }) => void
  loading: boolean
}

export default function SearchPanel({ onSearch, loading }: SearchPanelProps) {
  const [tab, setTab] = useState<'description' | 'url'>('description')
  const [value, setValue] = useState('')
  const [location, setLocation] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim() || loading) return
    onSearch({ type: tab, value: value.trim(), location: location.trim() })
  }

  const examples = {
    description: 'We help B2B SaaS companies implement AI agents and automation. We also place FinOps engineers to help companies reduce cloud spend.',
    url: 'https://yourcompany.com',
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="w-full max-w-2xl mx-auto"
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Tab switcher */}
        <div
          className="flex border-b"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {[
            { key: 'description', label: 'Describe your business', icon: FileText },
            { key: 'url', label: 'Paste website URL', icon: Globe },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key as 'description' | 'url')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all duration-200',
                tab === key
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
              style={
                tab === key
                  ? { background: 'rgba(59,130,246,0.05)' }
                  : {}
              }
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* Main input */}
          {tab === 'description' ? (
            <div>
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={examples.description}
                rows={4}
                className="w-full bg-transparent text-white placeholder-zinc-600 text-sm leading-relaxed resize-none outline-none"
                disabled={loading}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-zinc-500 flex-shrink-0" />
              <input
                type="url"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://yourcompany.com"
                className="w-full bg-transparent text-white placeholder-zinc-600 text-sm outline-none"
                disabled={loading}
              />
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

          {/* Location + Submit */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <MapPin size={14} className="text-zinc-500 flex-shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (e.g. New York, NY) — leave blank for global"
                className="w-full bg-transparent text-white placeholder-zinc-600 text-sm outline-none"
                disabled={loading}
              />
            </div>

            <motion.button
              type="submit"
              disabled={!value.trim() || loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-shrink-0',
                value.trim() && !loading
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              )}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Running</span>
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>Find Leads</span>
                  <ArrowRight size={14} />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Helper text */}
      <p className="text-center text-zinc-600 text-xs mt-3">
        Powered by Pain Signal Intelligence — finds leads & tells you exactly why to reach out
      </p>
    </motion.form>
  )
}
