import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LeadPilot — Pain Signal Intelligence',
  description:
    'Find your next client before they find you. AI-powered lead intelligence that detects pain signals and tells you exactly why to reach out.',
  keywords: ['lead generation', 'B2B leads', 'sales intelligence', 'AI leads'],
  openGraph: {
    title: 'LeadPilot',
    description: 'Find your next client before they find you.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
