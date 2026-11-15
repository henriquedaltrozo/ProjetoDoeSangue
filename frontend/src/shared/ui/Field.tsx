import {
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react'

interface FieldWrapperProps {
  label: string
  htmlFor: string
  errorId: string
  error?: string
  hint?: string
  className?: string
  children: ReactNode
}

function FieldWrapper({ label, htmlFor, errorId, error, hint, className = '', children }: FieldWrapperProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Gera o id do campo (único na página, a menos que `id` seja informado) e os atributos que ligam
 * a mensagem de erro ao campo para leitores de tela.
 */
function useFieldIds(id: string | undefined, error: string | undefined) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  return {
    fieldId,
    errorId,
    ariaProps: {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : undefined,
    },
  }
}

const inputClass =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:bg-slate-100 aria-invalid:border-red-500'

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  /** Texto de ajuda abaixo do campo. */
  hint?: string
  /** Classe do bloco (rótulo + campo), ex.: para ocupar duas colunas numa grade. */
  wrapperClassName?: string
  /** Formata o texto enquanto a pessoa digita (ex.: máscara de CPF ou telefone). */
  mask?: (value: string) => string
}

export function InputField({
  label,
  error,
  hint,
  wrapperClassName,
  mask,
  id,
  className = '',
  onChange,
  ...rest
}: InputFieldProps) {
  const { fieldId, errorId, ariaProps } = useFieldIds(id, error)
  return (
    <FieldWrapper
      label={label}
      htmlFor={fieldId}
      errorId={errorId}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <input
        id={fieldId}
        className={`${inputClass} ${className}`}
        {...ariaProps}
        {...rest}
        onChange={(event) => {
          // Aplica a máscara antes de avisar o formulário, que lê o valor já formatado.
          if (mask) event.target.value = mask(event.target.value)
          onChange?.(event)
        }}
      />
    </FieldWrapper>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  wrapperClassName?: string
  children: ReactNode
}

export function SelectField({
  label,
  error,
  hint,
  wrapperClassName,
  id,
  className = '',
  children,
  ...rest
}: SelectFieldProps) {
  const { fieldId, errorId, ariaProps } = useFieldIds(id, error)
  return (
    <FieldWrapper
      label={label}
      htmlFor={fieldId}
      errorId={errorId}
      error={error}
      hint={hint}
      className={wrapperClassName}
    >
      <select id={fieldId} className={`${inputClass} bg-white ${className}`} {...ariaProps} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  )
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function TextareaField({ label, error, id, className = '', ...rest }: TextareaFieldProps) {
  const { fieldId, errorId, ariaProps } = useFieldIds(id, error)
  return (
    <FieldWrapper label={label} htmlFor={fieldId} errorId={errorId} error={error}>
      <textarea id={fieldId} className={`${inputClass} resize-y ${className}`} rows={3} {...ariaProps} {...rest} />
    </FieldWrapper>
  )
}
