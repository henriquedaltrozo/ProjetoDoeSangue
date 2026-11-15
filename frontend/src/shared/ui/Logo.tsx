/**
 * Logo do sistema: gota em SVG e o nome. SVG (e não emoji) para ficar igual em qualquer sistema e
 * alinhar com a borda do conteúdo.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold text-red-600 ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[1em] w-[1em] fill-current">
        <path d="M12 2.5c-.3 0-.6.2-.8.4C9.6 5 5 11 5 14.8 5 18.8 8.1 22 12 22s7-3.2 7-7.2C19 11 14.4 5 12.8 2.9c-.2-.2-.5-.4-.8-.4Z" />
      </svg>
      DoeSangue
    </span>
  )
}
