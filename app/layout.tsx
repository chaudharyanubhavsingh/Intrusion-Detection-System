import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Anubhavs App',
  description: 'Created with Anubhavs',
  generator: 'Anubhavs.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
