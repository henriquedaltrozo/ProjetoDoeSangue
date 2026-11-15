export function Spinner({ label = 'Carregando...' }: { label?: string }) {
  return (
    // role="status": leitores de tela anunciam o "Carregando..." sem tirar o foco do usuário.
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-red-600"
      />
      {label}
    </div>
  )
}
