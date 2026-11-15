import { z } from 'zod'
import { ageFromBirthDate, MAX_PLAUSIBLE_AGE_YEARS } from '@/shared/lib/age'
import { isValidCpf } from '@/shared/lib/cpf'
import { businessDate } from '@/shared/lib/format'
import { onlyDigits } from '@/shared/lib/masks'
import { BLOOD_TYPES, SEXES, UNFITNESS_CATEGORIES } from '@/shared/types'

/**
 * Formulário "Atualizar meus dados": todos os campos vêm preenchidos com o perfil atual e só o que
 * mudou é enviado (ver profileChanges). Mesmas regras do cadastro.
 */
export const updateProfileSchema = z
  .object({
    completeName: z.string().trim().min(3, 'Informe seu nome completo.').max(150),
    email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
    // Pedida só quando o e-mail muda (a tela mostra o campo nesse caso).
    currentPassword: z.string().optional(),
    // Com ou sem pontuação (a tela aplica a máscara); sai só com os dígitos.
    cpf: z
      .string()
      .transform(onlyDigits)
      .pipe(
        z
          .string()
          .length(11, 'Informe os 11 dígitos do CPF.')
          .refine(isValidCpf, 'CPF inválido: confira os números digitados.'),
      ),
    birthDate: z
      .string()
      .min(1, 'Informe a data de nascimento.')
      .refine((value) => value <= businessDate(), 'A data de nascimento não pode estar no futuro.')
      .refine(
        (value) => (ageFromBirthDate(value) ?? 0) <= MAX_PLAUSIBLE_AGE_YEARS,
        'Data de nascimento inválida: confira o ano digitado.',
      ),
    sex: z.enum(SEXES, 'Selecione o sexo.'),
    // DDD + número (10 dígitos, ou 11 no celular); em branco apaga. Sai só com os dígitos.
    phone: z
      .string()
      .transform(onlyDigits)
      .refine(
        (value) => value === '' || value.length === 10 || value.length === 11,
        'Informe o telefone com DDD, ex.: (55) 99999-9999.',
      ),
    weightKg: z.coerce.number().min(1, 'Informe um peso válido.').max(300, 'Informe um peso válido.'),
    bloodType: z.enum(['', ...BLOOD_TYPES]),
    lastDonationDate: z
      .string()
      .refine((value) => value === '' || value <= businessDate(), 'A data da última doação não pode estar no futuro.'),
  })
  .superRefine((values, ctx) => {
    if (values.lastDonationDate && values.birthDate && values.lastDonationDate < values.birthDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['lastDonationDate'],
        message: 'A data da última doação não pode ser anterior ao nascimento.',
      })
    }
  })

export type UpdateProfileFormValues = z.output<typeof updateProfileSchema>

/** Resposta sim/não de um select ('' = sem resposta). */
const yesNo = z.enum(['', 'yes', 'no']).optional()
const toBoolean = (answer: '' | 'yes' | 'no' | undefined) => (answer ? answer === 'yes' : undefined)

/** Correção das declarações do doador; a tela só mostra os campos que valem para a idade dele. */
export const updateDeclarationsSchema = z
  .object({
    guardianName: z.string().max(150).optional(),
    guardianConsent: z.boolean().optional(),
    donatedBefore60: yesNo,
    regularDonor: yesNo,
  })
  .superRefine((values, ctx) => {
    if (values.guardianConsent && (!values.guardianName || values.guardianName.trim().length < 3)) {
      ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Informe o nome do responsável legal.' })
    }
  })
  .transform((values) => ({
    // Nome em branco não é enviado: o backend exige ao menos 3 caracteres quando o campo vem.
    ...(values.guardianName?.trim() && { guardianName: values.guardianName.trim() }),
    ...(values.guardianConsent !== undefined && { guardianConsent: values.guardianConsent }),
    ...(toBoolean(values.donatedBefore60) !== undefined && { donatedBefore60: toBoolean(values.donatedBefore60) }),
    ...(toBoolean(values.regularDonor) !== undefined && { regularDonor: toBoolean(values.regularDonor) }),
  }))

// --- [admin] ---

export const registerUnfitnessSchema = z
  .object({
    reason: z.string().min(3, 'Descreva o motivo.').max(255),
    category: z.enum(UNFITNESS_CATEGORIES),
    startDate: z.string().min(1, 'Informe a data de início.'),
    // Importante: o literal('') vem ANTES de string().optional() no `.or()` -
    // caso contrário o campo em branco (comum: "fim previsto" não preenchido)
    // seria enviado como '' e rejeitado pelo backend (@IsDateString não aceita
    // string vazia) em vez de omitido.
    expectedEndDate: z
      .literal('')
      .transform(() => undefined)
      .or(z.string().optional()),
  })
  .refine((data) => !data.expectedEndDate || data.expectedEndDate >= data.startDate, {
    message: 'O fim previsto não pode ser anterior ao início.',
    path: ['expectedEndDate'],
  })
export type RegisterUnfitnessFormValues = z.infer<typeof registerUnfitnessSchema>
