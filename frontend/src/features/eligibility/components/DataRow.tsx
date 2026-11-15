/** Linha "rótulo: valor" dos cartões de dados do doador. */
export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      {/* Valor longo (ex.: e-mail sem espaços) quebra linha em vez de passar da borda no celular. */}
      <span className="min-w-0 text-right font-medium text-slate-900 [overflow-wrap:anywhere]">{value}</span>
    </div>
  )
}
