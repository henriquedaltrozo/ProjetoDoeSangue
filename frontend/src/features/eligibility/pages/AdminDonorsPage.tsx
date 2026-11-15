import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MIN_DONOR_SEARCH_LENGTH, useDonors } from '@/features/eligibility/hooks/useEligibility'
import { formatCpf } from '@/shared/lib/format'
import { normalizeDonorSearch } from '@/shared/lib/masks'
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue'
import { usePageTitle } from '@/shared/lib/usePageTitle'
import { Button } from '@/shared/ui/Button'
import { Card } from '@/shared/ui/Card'
import { ErrorAlert } from '@/shared/ui/ErrorAlert'
import { InputField } from '@/shared/ui/Field'
import { PageTitle } from '@/shared/ui/PageTitle'
import { Spinner } from '@/shared/ui/Spinner'

export function AdminDonorsPage() {
  usePageTitle('Doadores')
  // A busca e a página ficam no endereço (?q=...&page=...): ao abrir um doador e voltar, a lista
  // aparece do mesmo jeito, sem precisar buscar de novo.
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [search, setSearch] = useState(query)
  // Só busca quando a pessoa para de digitar, em vez de uma requisição por tecla.
  const debounced = useDebouncedValue(search.trim())
  useEffect(() => {
    if (debounced === query) return
    // Busca nova começa na página 1. "replace": digitar não enche o histórico do navegador.
    setParams(debounced ? { q: debounced } : {}, { replace: true })
  }, [debounced, query, setParams])

  // CPF com pontuação vira só dígitos (é como está guardado); nome fica como está.
  const term = normalizeDonorSearch(query)
  const donors = useDonors(term, page)
  const tooShort = term.length < MIN_DONOR_SEARCH_LENGTH
  const result = tooShort ? undefined : donors.data
  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1

  function goToPage(next: number) {
    setParams({ q: query, page: String(next) })
    window.scrollTo?.({ top: 0 })
  }

  return (
    <div>
      <PageTitle>Doadores</PageTitle>

      <Card className="mb-6">
        <InputField label="Buscar por nome ou CPF" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Card>

      {/* Só lista depois de uma busca: cada doador exibido entra na auditoria (LGPD). */}
      {tooShort && (
        <Card>
          <p className="text-slate-500">
            Digite ao menos {MIN_DONOR_SEARCH_LENGTH} caracteres do nome ou do CPF para buscar um doador.
          </p>
        </Card>
      )}
      {donors.isLoading && <Spinner label="Carregando doadores..." />}
      <ErrorAlert error={donors.error} fallback="Não foi possível carregar os doadores." className="mb-4" />

      {result && result.total === 0 && (
        <Card>
          <p className="text-slate-500">Nenhum doador encontrado.</p>
        </Card>
      )}

      {result && result.total > 0 && (
        <>
          <p className="mb-3 text-sm text-slate-500" aria-live="polite">
            {result.total === 1 ? '1 doador encontrado' : `${result.total} doadores encontrados`}
            {totalPages > 1 && ` - página ${result.page} de ${totalPages}`}
          </p>

          {result.items.length === 0 ? (
            // Página além do fim (ex.: endereço antigo depois de a busca encolher).
            <Card className="flex flex-col items-start gap-3">
              <p className="text-slate-500">Esta página não tem doadores.</p>
              <Button variant="secondary" onClick={() => goToPage(1)}>
                Ir para a primeira página
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {result.items.map((d) => (
                <Link key={d.id} to={`/admin/donors/${d.id}`}>
                  <Card className="transition-colors hover:border-red-300">
                    <p className="font-medium text-slate-900">{d.completeName}</p>
                    <p className="text-sm text-slate-500">
                      CPF: {formatCpf(d.cpf)}
                      {d.bloodType && ` - Tipo sanguíneo: ${d.bloodType}`}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Páginas da busca" className="mt-4 flex items-center justify-between gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                ← Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Página {result.page} de {totalPages}
              </span>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                Próxima →
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
