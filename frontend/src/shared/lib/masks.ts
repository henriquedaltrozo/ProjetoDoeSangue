/** Só os dígitos de um texto (ex.: "037.651.570-82" -> "03765157082"). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Máscara do CPF enquanto a pessoa digita: 000.000.000-00 (até 11 dígitos). */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Máscara do telefone enquanto a pessoa digita: (00) 0000-0000 ou, com 11 dígitos (celular),
 * (00) 00000-0000.
 */
export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** UF enquanto a pessoa digita: só letras, em maiúsculas, até 2 (ex.: "rs" -> "RS"). */
export function maskUf(value: string): string {
  return value
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Termo da busca de doadores ("nome ou CPF"): se parece um CPF (só dígitos, pontos, traço e espaços),
 * vira só os dígitos, que é como o CPF está guardado; um nome fica como está.
 */
export function normalizeDonorSearch(term: string): string {
  return /^[\d.\-\s]+$/.test(term) ? onlyDigits(term) : term
}

/** Telefone guardado (só dígitos) para exibir; formatos fora do padrão aparecem como estão. */
export function formatPhone(phone: string): string {
  const d = onlyDigits(phone)
  return d.length === 10 || d.length === 11 ? maskPhone(d) : phone
}
