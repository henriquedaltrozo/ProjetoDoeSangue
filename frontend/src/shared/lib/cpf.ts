/** Dígito verificador do CPF calculado sobre os primeiros `length` dígitos (9 para o 1º, 10 para o 2º). */
function checkDigit(digits: number[], length: number): number {
  let sum = 0
  for (let i = 0; i < length; i++) {
    sum += digits[i] * (length + 1 - i)
  }
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

/**
 * Confere um CPF de 11 dígitos (sem pontuação): formato e os dois dígitos verificadores.
 * Sequências repetidas (ex.: 11111111111) passam na conta, mas não são CPFs válidos.
 */
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }
  const digits = [...cpf].map(Number)
  return checkDigit(digits, 9) === digits[9] && checkDigit(digits, 10) === digits[10]
}
