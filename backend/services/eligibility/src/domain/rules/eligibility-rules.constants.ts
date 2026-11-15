/**
 * Constantes do motor de elegibilidade. Regras de idade adotadas pelo projeto: de 16 a 69 anos, 11 meses
 * e 29 dias; menores de 18 com consentimento formal do responsável legal; de 60 a 69 anos, só quem já
 * doou antes dos 60; a partir dos 70, só doadores voluntários regulares considerados aptos em avaliação
 * médica do serviço de hemoterapia. Como o sistema não tem o histórico de doações de fora dele, o próprio
 * doador declara o que falta (ver Donor.draft e Donor.updateDeclarations).
 * Valores conforme a Portaria GM/MS nº 11.685,
 * de 2 de julho de 2026 (Anexo I, que passou a integrar o Anexo IV-B da Portaria de
 * Consolidação GM/MS nº 5/2017), em vigor desde 30/09/2026:
 *
 * - idade (art. 39): de 16 a 69 anos, 11 meses e 29 dias (a idade em anos completos é comparada
 *   com 16, 18, 60 e 69);
 * - peso mínimo (art. 40): 50 kg;
 * - intervalo mínimo (art. 38, §1º): dois meses para homens e três meses para mulheres;
 * - máximo em 12 meses (art. 38): quatro doações de sangue total para homens e três para mulheres.
 *
 * Fora do escopo implementado: exceção de peso por avaliação médica e a lista de condições clínicas.
 */
export const MIN_AGE_YEARS = 16;
/** Abaixo desta idade, o responsável legal precisa consentir (o doador apresenta o termo assinado). */
export const ADULT_AGE_YEARS = 18;
/** Idade máxima regular: de 70 anos em diante, só doadores regulares aprovados em avaliação médica. */
export const MAX_AGE_YEARS = 69;
/** A partir desta idade, só doa quem já doou sangue antes dela (a primeira doação precisa ser antes dos 60). */
export const MAX_AGE_FIRST_DONATION_YEARS = 60;
export const MIN_WEIGHT_KG = 50;
export const MIN_INTERVAL_MONTHS_MALE = 2;
export const MIN_INTERVAL_MONTHS_FEMALE = 3;
export const MAX_DONATIONS_PER_12_MONTHS_MALE = 4;
export const MAX_DONATIONS_PER_12_MONTHS_FEMALE = 3;
export const ANNUAL_WINDOW_MONTHS = 12;
/**
 * Faixa de peso aceita no cadastro e no perfil: fora dela é erro de digitação (ex.: 7 em vez de 70,
 * ou 700). O mínimo para doar continua sendo MIN_WEIGHT_KG, conferido na avaliação.
 */
export const MIN_PLAUSIBLE_WEIGHT_KG = 1;
export const MAX_PLAUSIBLE_WEIGHT_KG = 300;
/** Idade acima da qual a data de nascimento é tratada como erro de digitação no cadastro. */
export const MAX_PLAUSIBLE_AGE_YEARS = 120;
/** Validade da avaliação médica que libera um doador regular com 70 anos ou mais. */
export const MEDICAL_CLEARANCE_VALIDITY_MONTHS = 12;
