import { Sex, BloodType } from '@shared/domain/enums';
import { BusinessRuleError, InvalidValueError } from '../errors';
import {
  ADULT_AGE_YEARS,
  MAX_AGE_FIRST_DONATION_YEARS,
  MAX_AGE_YEARS,
  MAX_PLAUSIBLE_AGE_YEARS,
  MAX_PLAUSIBLE_WEIGHT_KG,
  MIN_PLAUSIBLE_WEIGHT_KG,
} from '../rules/eligibility-rules.constants';
import { isBeforeSixty } from '../services/age-rules';
import { calculateAge, toDateISO } from '../services/dates';
import {
  appendDonation,
  calculateLastDonation,
  validateDonationDate,
} from '../services/record-donation';
import { Cpf, Email } from '../value-objects';

/** Texto que substitui campos de texto livre potencialmente identificantes na anonimização. */
export const TEXT_ANONYMIZED = '[dados removidos a pedido do titular]';

export interface DonorProps {
  id: string;
  userId: string;
  completeName: string;
  cpf: string;
  birthDate: string;
  sex: Sex;
  /** Opcional: o doador informa no cadastro ou depois, no perfil. */
  phone: string | null;
  email: string;
  weightKg: number;
  bloodType: BloodType | null;
  lastDonationAt: string | null;
  /** Datas das doações dos últimos 12 meses (base do limite anual); ausente equivale a vazio. */
  donationDates?: string[];
  permanentUnfit: boolean;
  permanentUnfitnessReason: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Declarações do doador (o sistema não tem o histórico de fora dele). Ausente = não declarado.
  /** Menor de 18 anos: nome do responsável legal. */
  guardianName?: string | null;
  /** Menor de 18 anos: confirmou que apresentará o termo de consentimento assinado. */
  guardianConsentDeclared?: boolean;
  /** 60 anos ou mais: declarou ter doado antes dos 60 (null = não respondeu). */
  donatedBefore60?: boolean | null;
  /** 70 anos ou mais: declarou ser doador voluntário regular. */
  regularDonorDeclared?: boolean;
  /** Data (AAAA-MM-DD) em que um admin registrou a avaliação médica favorável (70 anos ou mais). */
  medicalClearanceAt?: string | null;
  /** Admin que registrou a avaliação médica. */
  medicalClearanceBy?: string | null;
  /** Versão para concorrência otimista: muda a cada gravação. Ausente equivale a 1. */
  version?: number;
  /**
   * [LGPD] Quando o doador consentiu com o uso dos dados de saúde (no cadastro). Null em cadastros
   * anteriores à coleta do consentimento.
   */
  healthDataConsentAt?: Date | null;
  /**
   * Aceita receber avisos por e-mail que não são resposta a algo que ele fez: campanhas urgentes e
   * "você já pode doar". Ausente equivale a sim (o doador desmarca no perfil).
   */
  receiveAlerts?: boolean;
  /**
   * O doador confirmou o endereço de e-mail (pelo link do auth-service). Sem confirmar, não recebe
   * campanhas nem o "já pode doar": evita mandar avisos a quem não é dono do endereço. Ausente = sim.
   */
  emailVerified?: boolean;
}

/** Dados de um doador ainda não persistido (id e datas são gerados pela persistência). */
export type NewDonor = Omit<DonorProps, 'id' | 'createdAt' | 'updatedAt' | 'version'>;

export interface DonorRegistrationData {
  userId: string;
  completeName: string;
  cpf: string;
  birthDate: string;
  sex: Sex;
  email: string;
  /** Opcional: também pode ser informado depois, no perfil. */
  phone?: string;
  weightKg: number;
  guardianName?: string;
  guardianConsent?: boolean;
  donatedBefore60?: boolean;
  regularDonor?: boolean;
  /** AAAA-MM-DD da última doação, para quem já doou (inclusive fora deste sistema). */
  lastDonationDate?: string;
  /** Tipo sanguíneo, se o doador souber. */
  bloodType?: BloodType;
  /** [LGPD] Consentimento para o uso dos dados de saúde: o cadastro só é aceito com true. */
  healthDataConsent?: boolean;
  /** O e-mail já foi confirmado (ausente = sim). */
  emailVerified?: boolean;
}

/** O que o doador pode corrigir depois do cadastro (a data da última doação não: vem dos agendamentos). */
export interface DonorDeclarationsData {
  guardianName?: string;
  guardianConsent?: boolean;
  donatedBefore60?: boolean;
  regularDonor?: boolean;
}

/**
 * O que o doador pode corrigir no próprio perfil. Nome e e-mail ficam de fora: são do login e chegam
 * pelo auth-service (ver updateIdentity). Status e consentimento são do sistema.
 */
export interface DonorProfileData {
  cpf?: string;
  birthDate?: string;
  sex?: Sex;
  /** `null` (ou vazio) apaga o telefone. */
  phone?: string | null;
  weightKg?: number;
  bloodType?: BloodType;
  /** Só avança: uma data anterior à já registrada encurtaria o intervalo mínimo entre doações. */
  lastDonationDate?: string;
  /** Aceita receber avisos de campanhas e de quando pode doar de novo. */
  receiveAlerts?: boolean;
}

/** Nome e e-mail, que o auth-service (dono do login) mantém iguais nos dois serviços. */
export interface DonorIdentityData {
  completeName?: string;
  email?: string;
  /** O doador confirmou o e-mail. */
  emailVerified?: boolean;
}

/** Dono dos dados cadastrais/clínicos do doador. Valores em texto puro (a cifra é da persistência). */
export class Donor {
  readonly id: string;
  readonly userId: string;
  readonly completeName: string;
  readonly cpf: string;
  readonly birthDate: string;
  readonly sex: Sex;
  readonly phone: string | null;
  readonly email: string;
  readonly weightKg: number;
  readonly bloodType: BloodType | null;
  readonly lastDonationAt: string | null;
  readonly donationDates: string[];
  readonly permanentUnfit: boolean;
  readonly permanentUnfitnessReason: string | null;
  readonly active: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly guardianName: string | null;
  readonly guardianConsentDeclared: boolean;
  readonly donatedBefore60: boolean | null;
  readonly regularDonorDeclared: boolean;
  readonly medicalClearanceAt: string | null;
  readonly medicalClearanceBy: string | null;
  readonly version: number;
  readonly healthDataConsentAt: Date | null;
  readonly receiveAlerts: boolean;
  readonly emailVerified: boolean;

  constructor(props: DonorProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.completeName = props.completeName;
    this.cpf = props.cpf;
    this.birthDate = props.birthDate;
    this.sex = props.sex;
    this.phone = props.phone;
    this.email = props.email;
    this.weightKg = props.weightKg;
    this.bloodType = props.bloodType;
    this.lastDonationAt = props.lastDonationAt;
    this.donationDates = props.donationDates ?? [];
    this.permanentUnfit = props.permanentUnfit;
    this.permanentUnfitnessReason = props.permanentUnfitnessReason;
    this.active = props.active;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.guardianName = props.guardianName ?? null;
    this.guardianConsentDeclared = props.guardianConsentDeclared ?? false;
    this.donatedBefore60 = props.donatedBefore60 ?? null;
    this.regularDonorDeclared = props.regularDonorDeclared ?? false;
    this.medicalClearanceAt = props.medicalClearanceAt ?? null;
    this.medicalClearanceBy = props.medicalClearanceBy ?? null;
    this.version = props.version ?? 1;
    this.healthDataConsentAt = props.healthDataConsentAt ?? null;
    this.receiveAlerts = props.receiveAlerts ?? true;
    this.emailVerified = props.emailVerified ?? true;
  }

  /**
   * Novo cadastro: ativo, sem inaptidão permanente, sem doação anterior e sem tipo sanguíneo. CPF e
   * e-mail são validados aqui (value objects), e não só na API: a regra vale para qualquer entrada.
   * Só o cadastro valida; doadores já gravados (ex.: anonimizados, com CPF pseudônimo) não passam por aqui.
   */
  static draft(data: DonorRegistrationData, now: Date): NewDonor {
    const todayISO = toDateISO(now);
    // Dados de saúde (dado sensível, LGPD art. 11) só são tratados com consentimento específico.
    if (data.healthDataConsent !== true) {
      throw new InvalidValueError(
        'É preciso concordar com o uso dos seus dados de saúde para se cadastrar.',
      );
    }
    validateBirthDate(data.birthDate, now);
    validateWeight(data.weightKg);
    requireDeclarationsForAge(data, calculateAge(data.birthDate, now));
    const lastDonation = data.lastDonationDate ?? null;
    if (lastDonation) {
      validateDonationDate(lastDonation, todayISO);
      if (lastDonation < data.birthDate) {
        throw new InvalidValueError('A data da última doação não pode ser anterior ao nascimento.');
      }
    }
    return {
      userId: data.userId,
      completeName: data.completeName,
      cpf: Cpf.parse(data.cpf).value,
      birthDate: data.birthDate,
      sex: data.sex,
      phone: data.phone?.trim() || null,
      email: Email.parse(data.email).value,
      weightKg: data.weightKg,
      bloodType: data.bloodType ?? null,
      lastDonationAt: lastDonation,
      donationDates: lastDonation ? appendDonation([], lastDonation, todayISO) : [],
      permanentUnfit: false,
      permanentUnfitnessReason: null,
      active: true,
      guardianName: data.guardianName?.trim() || null,
      guardianConsentDeclared: data.guardianConsent ?? false,
      // Uma última doação anterior aos 60 responde a pergunta, mesmo que a resposta tenha sido outra.
      donatedBefore60:
        lastDonation && isBeforeSixty(data.birthDate, lastDonation)
          ? true
          : (data.donatedBefore60 ?? null),
      regularDonorDeclared: data.regularDonor ?? false,
      medicalClearanceAt: null,
      medicalClearanceBy: null,
      healthDataConsentAt: now,
      receiveAlerts: true,
      emailVerified: data.emailVerified ?? true,
    };
  }

  /**
   * O doador corrige o que declarou (ex.: completou 60 anos e informa que já doou antes). Deixar de
   * se declarar doador regular desfaz a avaliação médica, que só vale para doadores regulares.
   */
  updateDeclarations(data: DonorDeclarationsData): void {
    const guardianName =
      data.guardianName === undefined ? this.guardianName : data.guardianName.trim() || null;
    const guardianConsent = data.guardianConsent ?? this.guardianConsentDeclared;
    if (guardianConsent && !guardianName) {
      throw new InvalidValueError('Informe o nome do responsável legal.');
    }
    const regularDonor = data.regularDonor ?? this.regularDonorDeclared;
    this.mutate({
      guardianName,
      guardianConsentDeclared: guardianConsent,
      ...(data.donatedBefore60 !== undefined && { donatedBefore60: data.donatedBefore60 }),
      regularDonorDeclared: regularDonor,
      ...(!regularDonor && { medicalClearanceAt: null, medicalClearanceBy: null }),
    });
  }

  /**
   * [admin] Avaliação médica favorável para doar com 70 anos ou mais: só para doadores regulares que já
   * têm 70 anos (uma avaliação feita antes não vale para essa idade). Vale por
   * MEDICAL_CLEARANCE_VALIDITY_MONTHS meses; registrar de novo renova.
   */
  registerMedicalClearance(adminId: string, now: Date): void {
    if (calculateAge(this.birthDate, now) <= MAX_AGE_YEARS) {
      throw new BusinessRuleError(
        'A avaliação médica só é registrada para doadores com 70 anos ou mais.',
      );
    }
    if (!this.regularDonorDeclared) {
      throw new BusinessRuleError(
        'A avaliação médica só pode ser registrada para quem declarou ser doador regular.',
      );
    }
    this.mutate({ medicalClearanceAt: toDateISO(now), medicalClearanceBy: adminId });
  }

  /**
   * [admin] Inaptidão permanente (ex.: condição de saúde que impede doar para sempre): o doador deixa
   * de poder doar. O motivo é obrigatório, para quem consultar o cadastro depois saber por quê.
   */
  registerPermanentUnfitness(reason: string): void {
    const text = reason.trim();
    if (text.length < 3) {
      throw new InvalidValueError('Descreva o motivo da inaptidão permanente.');
    }
    if (this.permanentUnfit) {
      throw new BusinessRuleError('O doador já está registrado como inapto permanente.');
    }
    this.mutate({ permanentUnfit: true, permanentUnfitnessReason: text });
  }

  /** [admin] Desfaz a inaptidão permanente (ex.: registrada por engano no doador errado). */
  revokePermanentUnfitness(): void {
    if (!this.permanentUnfit) {
      throw new BusinessRuleError('O doador não está registrado como inapto permanente.');
    }
    this.mutate({ permanentUnfit: false, permanentUnfitnessReason: null });
  }

  /** [admin] Desfaz a avaliação médica (ex.: nova avaliação desfavorável). */
  revokeMedicalClearance(): void {
    this.mutate({ medicalClearanceAt: null, medicalClearanceBy: null });
  }

  /**
   * O doador corrige os próprios dados; muda só o que foi informado. Tudo é validado antes de mudar
   * qualquer campo. A elegibilidade é recalculada na próxima avaliação com os dados novos (inclusive as
   * declarações que a nova idade passar a exigir, cobradas pela avaliação).
   */
  updateProfile(data: DonorProfileData, now: Date): void {
    const todayISO = toDateISO(now);
    const birthDate = data.birthDate ?? this.birthDate;
    if (data.birthDate !== undefined) {
      validateBirthDate(data.birthDate, now);
    }
    if (data.weightKg !== undefined) {
      validateWeight(data.weightKg);
    }
    const cpf = data.cpf === undefined ? undefined : Cpf.parse(data.cpf).value;
    const lastDonation = data.lastDonationDate;
    if (lastDonation !== undefined) {
      validateDonationDate(lastDonation, todayISO);
      if (this.lastDonationAt && lastDonation < this.lastDonationAt) {
        throw new BusinessRuleError(
          'A data da última doação não pode ser anterior à já registrada. Se ela estiver errada, procure o hemocentro.',
        );
      }
    }
    const effectiveLastDonation = lastDonation ?? this.lastDonationAt;
    if (effectiveLastDonation && effectiveLastDonation < birthDate) {
      throw new InvalidValueError('A data da última doação não pode ser anterior ao nascimento.');
    }

    const birthDateChanged = data.birthDate !== undefined && data.birthDate !== this.birthDate;
    this.mutate({
      ...(cpf !== undefined && { cpf }),
      ...(data.birthDate !== undefined && { birthDate: data.birthDate }),
      ...(data.sex !== undefined && { sex: data.sex }),
      ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
      ...(data.weightKg !== undefined && { weightKg: data.weightKg }),
      ...(data.bloodType !== undefined && { bloodType: data.bloodType }),
      ...(data.receiveAlerts !== undefined && { receiveAlerts: data.receiveAlerts }),
      // A avaliação médica foi feita para a idade de antes: com outra data de nascimento, deixa de valer.
      ...(birthDateChanged && { medicalClearanceAt: null, medicalClearanceBy: null }),
      ...(birthDateChanged &&
        this.lastDonationAt &&
        isBeforeSixty(birthDate, this.lastDonationAt) && { donatedBefore60: true }),
    });
    if (lastDonation !== undefined) {
      this.registerDonationCompleted(lastDonation, todayISO);
    }
  }

  /** Nome e e-mail, vindos do auth-service quando o usuário os troca na conta. */
  updateIdentity(data: DonorIdentityData): void {
    const completeName = data.completeName?.trim();
    if (completeName !== undefined && completeName.length < 3) {
      throw new InvalidValueError('Informe o nome completo.');
    }
    this.mutate({
      ...(completeName !== undefined && { completeName }),
      ...(data.email !== undefined && { email: Email.parse(data.email).value }),
      ...(data.emailVerified !== undefined && { emailVerified: data.emailVerified }),
    });
  }

  /**
   * Idempotente: registra a doação da data informada (ou de hoje). A `lastDonationAt` nunca recua
   * para uma data mais antiga, mas o histórico dos últimos 12 meses recebe a doação mesmo fora de
   * ordem (ex.: o evento de uma doação mais antiga reprocessado depois do de uma mais recente),
   * senão o limite anual contaria a menos. Repetir a mesma data não muda nada. Devolve `true`
   * quando houve alteração.
   */
  registerDonationCompleted(donationDate: string | undefined, todayISO: string): boolean {
    const date = donationDate ?? todayISO;
    const nextLastDonation = calculateLastDonation(this.lastDonationAt, donationDate, todayISO);
    const history = appendDonation(this.donationDates, date, todayISO);
    const historyChanged =
      history.length !== this.donationDates.length ||
      history.some((d, i) => d !== this.donationDates[i]);
    if (nextLastDonation === null && !historyChanged) {
      return false;
    }
    this.mutate({
      lastDonationAt: nextLastDonation ?? this.lastDonationAt,
      donationDates: history,
      // Guarda o fato: o histórico só mantém 12 meses e a última doação, e esta data se perderia.
      ...(isBeforeSixty(this.birthDate, date) && { donatedBefore60: true }),
    });
    return true;
  }

  /**
   * [LGPD] Descaracteriza o que identifica a pessoa e desativa o doador, preservando dados
   * clínicos/estatísticos (tipo sanguíneo, doações). O CPF vira um hash determinístico do id
   * (cabe nos 11 caracteres, nunca colide e respeita a unicidade).
   */
  anonymize(): void {
    this.mutate({
      completeName: 'Doador anonimizado',
      cpf: pseudonymize(this.id),
      phone: null,
      email: `anon-${this.id}@anonymized.local`,
      permanentUnfitnessReason: this.permanentUnfitnessReason ? TEXT_ANONYMIZED : null,
      guardianName: null,
      active: false,
    });
  }

  /** Único ponto de alteração de estado: só os métodos de domínio mudam a entidade. */
  private mutate(changes: Partial<DonorProps>): void {
    Object.assign(this, changes);
  }
}

/** Peso fora da faixa plausível é erro de digitação (o mínimo para doar é conferido na avaliação). */
function validateWeight(weightKg: number): void {
  if (
    !Number.isFinite(weightKg) ||
    weightKg < MIN_PLAUSIBLE_WEIGHT_KG ||
    weightKg > MAX_PLAUSIBLE_WEIGHT_KG
  ) {
    throw new InvalidValueError('Informe um peso válido.');
  }
}

/** Data de nascimento no futuro ou de mais de 120 anos é erro de digitação: distorceria as regras de idade. */
function validateBirthDate(birthDate: string, now: Date): void {
  if (birthDate > toDateISO(now)) {
    throw new InvalidValueError('A data de nascimento não pode estar no futuro.');
  }
  if (calculateAge(birthDate, now) > MAX_PLAUSIBLE_AGE_YEARS) {
    throw new InvalidValueError('Data de nascimento inválida: confira o ano digitado.');
  }
}

/**
 * O que o cadastro exige conforme a idade: menor de 18 informa o responsável e confirma o termo; quem
 * tem 60 anos ou mais responde se doou antes dos 60; quem tem 70 ou mais responde se é doador regular.
 */
function requireDeclarationsForAge(data: DonorRegistrationData, age: number): void {
  if (age < ADULT_AGE_YEARS && (!data.guardianName?.trim() || data.guardianConsent !== true)) {
    throw new InvalidValueError(
      'Menores de 18 anos precisam informar o responsável legal e confirmar que apresentarão o termo de consentimento assinado por ele.',
    );
  }
  if (age >= MAX_AGE_FIRST_DONATION_YEARS && typeof data.donatedBefore60 !== 'boolean') {
    throw new InvalidValueError('Informe se você já doou sangue antes dos 60 anos.');
  }
  if (age > MAX_AGE_YEARS && typeof data.regularDonor !== 'boolean') {
    throw new InvalidValueError('Informe se você é doador voluntário regular.');
  }
}

/** Pseudônimo determinístico e puro (FNV-1a duplo) de 11 caracteres hex; evita dependência de `crypto` no domínio. */
function pseudonymize(value: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 11);
}
