const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

export async function deepseekChat(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3
): Promise<string> {
  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`DeepSeek error ${response.status}: ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content as string
}

export async function deepseekJSON<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const raw = await deepseekChat(
    systemPrompt + '\n\nCRITICAL: You must respond with valid JSON only. No markdown, no explanation, just the raw JSON object.',
    userPrompt
  )

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error(`No JSON found in DeepSeek response: ${raw.slice(0, 200)}`)

  return JSON.parse(jsonMatch[0]) as T
}
