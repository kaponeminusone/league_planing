import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-social-meta',
      transformIndexHtml(html) {
        const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || '').replace(/\/$/, '')
        if (!siteUrl) return html
        return html
          .replaceAll('__OG_URL__', siteUrl)
          .replaceAll('__OG_IMAGE__', `${siteUrl}/og-image.png`)
      },
    },
  ],
})
