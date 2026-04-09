'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Globe, FileText, MapPin, ArrowRight, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface SearchPanelProps {
  onSearch: (p: { type: 'description' | 'url'; value: string; location: string }) => void
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

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="rounded-xl overflow-hidden surface">
        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {([
            { key: 'description', label: 'Describe your business', icon: FileText },
            { key: 'url',         label: 'Paste a URL',            icon: Globe },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors',
                tab === key
                  ? 'text-white border-b-2 border-brand bg-white/[0.03]'
                  : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-3">
          {tab === 'description' ? (
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. We help B2B companies implement AI agents to automate operations and reduce cloud costs."
              rows={3}
              disabled={loading}
              className="w-full bg-transparent text-[var(--text)] placeholder-[var(--text-3)] text-sm resize-none outline-none leading-relaxed"
            />
          ) : (
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-[var(--text-3)] shrink-0" />
              <input
                type="url"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="https://yourcompany.com"
                disabled={loading}
                className="w-full bg-transparent text-[var(--text)] placeholder-[var(--text-3)] text-sm outline-none"
              />
            </div>
          )}

          <div className="h-px bg-white/[0.06]" />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <MapPin size={13} className="text-[var(--text-3)] shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or region (optional — leave blank for global)"
                disabled={loading}
                className="w-full bg-transparent text-[var(--text)] placeholder-[var(--text-3)] text-sm outline-none truncate"
              />
            </div>

            <button
              type="submit"
              disabled={!value.trim() || loading}
              className={clsx(
                'shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all',
                value.trim() && !loading
                  ? 'bg-brand hover:bg-brand-hover text-white'
                  : 'bg-white/5 text-[var(--text-3)] cursor-not-allowed'
              )}
            >
              {loading ? (
                <><Loader2 size={12} className="animate-spin" /> Running</>
              ) : (
                <>Find leads <ArrowRight size={12} /></>
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.form>
  )
}
