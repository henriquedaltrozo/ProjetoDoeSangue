import { z } from 'zod'
import { ageFromBirthDate, declarationsForAge, MAX_PLAUSIBLE_AGE_YEARS } from '@/shared/lib/age'
import { isValidCpf } from '@/shared/lib/cpf'
import { businessDate } from '@/shared/lib/format'
import { onlyDigits } from '@/shared/lib/masks'
import { BLOOD_TYPES, SEXES } from '@/shared/types'

/** O bcrypt do backend só considera os primeiros 72 bytes (acentos ocupam mais de um byte). */
const MAX_PASSWORD_BYTES = 72

const newPassword = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, {
    message: 'A senha pode ter no máximo 72 bytes (cerca de 72 caracteres sem acento).',
  })
export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
})
export type LoginFormValues = z.infer<typeof loginSchema>

/** Resposta sim/não de um select ('' = ainda não respondeu). */
const yesNo = z.enum(['', 'yes', 'no']).optional()

export const registerDonorSchema = z
  .object({
    name: z.string().min(3, 'Informe seu nome completo.').max(150),
    email: z.email('Informe um e-mail válido.'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Repita a senha.'),
    // Aceita com ou sem pontuação (a tela aplica a máscara); envia só os dígitos.
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
      // Mesmas regras do backend: nem no futuro, nem de mais de 120 anos (erro de digitação).
      .refine((value) => value <= businessDate(), 'A data de nascimento não pode estar no futuro.')
      .refine(
        (value) => (ageFromBirthDate(value) ?? 0) <= MAX_PLAUSIBLE_AGE_YEARS,
        'Data de nascimento inválida: confira o ano digitado.',
      ),
    sex: z.enum(SEXES, 'Selecione o sexo.'),
    // Opcional, com máscara na tela: sai só com os dígitos (DDD + número); em branco não é enviado.
    phone: z
      .string()
      .optional()
      .transform((value) => onlyDigits(value ?? ''))
      .refine(
        (value) => value === '' || value.length === 10 || value.length === 11,
        'Informe o telefone com DDD, ex.: (55) 99999-9999.',
      ),
    weightKg: z.coerce.number().min(1, 'Informe um peso válido.').max(300, 'Informe um peso válido.'),
    // Declarações (o sistema não tem o histórico de doações de fora dele): o que é exigido depende da idade.
    guardianName: z.string().max(150).optional(),
    guardianConsent: z.boolean().optional(),
    donatedBefore60: yesNo,
    regularDonor: yesNo,
    lastDonationDate: z.string().optional(),
    // '' = não sabe o tipo sanguíneo (o campo é opcional).
    bloodType: z.enum(['', ...BLOOD_TYPES]).optional(),
    // [LGPD] Dados de saúde são dados sensíveis: o cadastro exige o consentimento específico.
    healthDataConsent: z
      .boolean()
      .optional()
      .refine((value) => value === true, 'Para se cadastrar, é preciso concordar com o uso dos seus dados de saúde.'),
  })
  .superRefine((values, ctx) => {
    if (values.confirmPassword !== values.password) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'As senhas não conferem.' })
    }
    const required = declarationsForAge(ageFromBirthDate(values.birthDate))
    if (required.guardian) {
      if (!values.guardianName || values.guardianName.trim().length < 3) {
        ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Informe o nome do responsável legal.' })
      }
      if (!values.guardianConsent) {
        ctx.addIssue({
          code: 'custom',
          path: ['guardianConsent'],
          message: 'Confirme que vai apresentar o termo de consentimento assinado pelo responsável.',
        })
      }
    }
    if (required.donatedBefore60 && !values.donatedBefore60) {
      ctx.addIssue({
        code: 'custom',
        path: ['donatedBefore60'],
        message: 'Responda se você já doou sangue antes dos 60 anos.',
      })
    }
    if (required.regularDonor && !values.regularDonor) {
      ctx.addIssue({ code: 'custom', path: ['regularDonor'], message: 'Responda se você é doador voluntário regular.' })
    }
    if (values.lastDonationDate && values.lastDonationDate > businessDate()) {
      ctx.addIssue({ code: 'custom', path: ['lastDonationDate'], message: 'A data não pode estar no futuro.' })
    }
  })
  // Envia só as declarações que valem para a idade, já como booleanos.
  .transform(
    ({
      guardianName,
      guardianConsent,
      donatedBefore60,
      regularDonor,
      lastDonationDate,
      confirmPassword: _confirmPassword,
      bloodType,
      phone,
      healthDataConsent: _healthDataConsent,
      ...rest
    }) => {
      const required = declarationsForAge(ageFromBirthDate(rest.birthDate))
      return {
        ...rest,
        // Chega aqui só com o consentimento dado (ver superRefine).
        healthDataConsent: true as const,
        ...(bloodType && { bloodType }),
        ...(phone && { phone }),
        ...(required.guardian && { guardianName: guardianName?.trim(), guardianConsent: guardianConsent === true }),
        ...(required.donatedBefore60 && { donatedBefore60: donatedBefore60 === 'yes' }),
        ...(required.regularDonor && { regularDonor: regularDonor === 'yes' }),
        ...(lastDonationDate && { lastDonationDate }),
      }
    },
  )
export type RegisterDonorFormValues = z.infer<typeof registerDonorSchema>

export const registerAdminSchema = z
  .object({
    name: z.string().min(3, 'Informe o nome completo.').max(150),
    email: z.email('Informe um e-mail válido.'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Repita a senha.'),
  })
  .refine((values) => values.confirmPassword === values.password, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })
  // A confirmação só serve na tela: o servidor recebe nome, e-mail e senha.
  .transform(({ confirmPassword: _confirmPassword, ...rest }) => rest)
export type RegisterAdminFormInput = z.input<typeof registerAdminSchema>
export type RegisterAdminFormValues = z.output<typeof registerAdminSchema>

export const forgotPasswordSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
})
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Informe o token recebido.'),
    newPassword: newPassword,
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
