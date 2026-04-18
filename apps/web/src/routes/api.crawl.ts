import { createFileRoute } from '@tanstack/react-router'
import { crawlUrl } from '../lib/crawlers'

export const Route = createFileRoute('/api/crawl')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }

        try {
          const body = await request.json()
          const url = body?.url

          if (!url) {
            return Response.json(
              { error: 'URL is required' },
              { status: 400, headers: corsHeaders }
            )
          }

          const data = await crawlUrl(url)
          
          return Response.json(
            { 
              status: 'ok',
              ...data
            }, 
            { headers: corsHeaders }
          )
        } catch (error) {
          return Response.json(
            { 
              error: error instanceof Error ? error.message : 'Internal Server Error' 
            }, 
            { status: 500, headers: corsHeaders }
          )
        }
      },
    },
  },
})
