// Whether the in-app chat can run. The key itself never leaves the server.
export interface ChatStatus {
  enabled: boolean
  fake: boolean
}

export function chatStatusFrom(env: Record<string, string | undefined>): ChatStatus {
  const fake = env.RANGEBOOK_FAKE_CHAT === '1'
  return { enabled: fake || Boolean(env.OPENROUTER_API_KEY?.trim()), fake }
}
