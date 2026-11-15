import { Link, type LinkProps } from 'react-router-dom'
import { type ButtonVariant, buttonClasses } from '@/shared/ui/Button'

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
}

/**
 * Link de navegação com a aparência de um botão. Evita aninhar `<button>` dentro de `<a>`,
 * que é HTML inválido e cria duas paradas de foco no teclado.
 */
export function ButtonLink({ variant = 'primary', className = '', ...rest }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, className)} {...rest} />
}
