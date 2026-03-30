import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function GET() {
  const results: Record<string, unknown> = {}

  // ── Test Serper ───────────────────────────────────────────────────────
  try {
    const serperKey = process.env.SERPER_API_KEY
    results.serper_key_present = !!serperKey
    results.serper_key_prefix = serperKey ? serperKey.slice(0, 6) + '...' : 'MISSING'

    const serperRes = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: 'software company Ottawa', num: 3 }),
    })

    const serperData = await serperRes.json()
    results.serper_status = serperRes.status
    results.serper_ok = serperRes.ok
    results.serper_result_count = serperData?.organic?.length ?? 0
    results.serper_first_result = serperData?.organic?.[0]?.title ?? null
    results.serper_error = serperData?.message ?? null
  } catch (e) {
    results.serper_exception = String(e)
  }

  // ── Test DeepSeek ─────────────────────────────────────────────────────
  try {
    const deepseekKey = process.env.DEEPSEEK_API_KEY
    results.deepseek_key_present = !!deepseekKey
    results.deepseek_key_prefix = deepseekKey ? deepseekKey.slice(0, 6) + '...' : 'MISSING'

    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Reply with the word OK and nothing else.' }],
        max_tokens: 10,
      }),
    })

    const dsData = await dsRes.json()
    results.deepseek_status = dsRes.status
    results.deepseek_ok = dsRes.ok
    results.deepseek_reply = dsData?.choices?.[0]?.message?.content ?? null
    results.deepseek_error = dsData?.error?.message ?? null
  } catch (e) {
    results.deepseek_exception = String(e)
  }

  // ── Test Supabase ─────────────────────────────────────────────────────
  results.supabase_url_present = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  results.supabase_key_present = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json(results, { status: 200 })
}
