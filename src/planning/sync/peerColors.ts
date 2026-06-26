const PALETTE = ['#5eead4', '#f472b6', '#a78bfa', '#fb923c', '#38bdf8', '#4ade80', '#facc15']

export function peerColor(clientId: string): string {
  let h = 0
  for (let i = 0; i < clientId.length; i++) h = (h * 31 + clientId.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
