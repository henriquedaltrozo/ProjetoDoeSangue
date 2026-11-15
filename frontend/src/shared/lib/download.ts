/** Baixa um objeto como arquivo JSON, direto no navegador (sem passar pelo servidor). */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // Libera a URL só depois: alguns navegadores começam o download de forma assíncrona e, com a
  // URL liberada logo após o clique, baixariam um arquivo vazio (ou nada).
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
