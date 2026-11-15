import { useEffect, useState } from 'react'

/**
 * Horário atual (em ms) que se atualiza sozinho a cada `intervalMs`. Para telas que ficam abertas
 * por muito tempo e mostram coisas que dependem da hora (ex.: o botão "Não compareceu" só aparece
 * depois do horário do agendamento). Chamar Date.now() direto no render deixaria a tela parada
 * no horário em que foi aberta.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return now
}
