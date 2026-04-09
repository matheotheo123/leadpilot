'use client'

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      {/* Subtle dot grid */}
      <div className="absolute inset-0 dot-grid opacity-100" />
      {/* Single very soft blue glow — top left */}
      <div
        className="absolute"
        style={{
          top: '-20%',
          left: '-10%',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(0,112,243,0.07) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  )
}
