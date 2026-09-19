import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from '@/components/ui/sonner'
import { ogMetadata, twitterImage } from '@/lib/og-metadata'
import { siteConfig, siteUrl } from '@/lib/site-config'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Rooster Ridge Digital | Web Design, Automation & Digital Solutions',
    template: '%s',
  },
  description:
    'Rooster Ridge Digital helps businesses with web design, AI automation, digital strategy, branding, and custom technology solutions.',
  applicationName: siteConfig.name,
  generator: 'v0.app',
  alternates: { canonical: siteUrl },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: 'Rooster Ridge Digital | Web Design, Automation & Digital Solutions',
    description: siteConfig.description,
    url: siteUrl,
    images: [ogMetadata('home')],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rooster Ridge Digital | Web Design, Automation & Digital Solutions',
    description: siteConfig.description,
    images: [twitterImage('home')],
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1a2233',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-dvh antialiased font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': `${siteUrl}/#organization`,
                  name: siteConfig.name,
                  url: siteUrl,
                  logo: `${siteUrl}/images/roosters-ridge-digital-logo.png`,
                  description: siteConfig.description,
                  sameAs: siteConfig.socials.filter((social) => social.url).map((social) => social.url),
                },
                {
                  '@type': 'WebSite',
                  '@id': `${siteUrl}/#website`,
                  name: siteConfig.name,
                  url: siteUrl,
                  publisher: { '@id': `${siteUrl}/#organization` },
                },
              ],
            }),
          }}
        />
        {children}
        <Toaster position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
