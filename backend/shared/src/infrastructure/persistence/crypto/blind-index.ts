import { createHmac } from 'crypto';
import { deriveSubkey } from './encrypted-column.transformer';

/**
 * Índice cego: HMAC-SHA-256 do valor com uma subchave própria (derivada de DATA_ENCRYPTION_KEY).
 * Serve para achar ou proibir duplicados por igualdade (CPF, e-mail) sem guardar o valor em claro:
 * a coluna cifrada usa IV aleatório e, por isso, não permite comparar. Quem tem só o banco não
 * consegue recalcular o índice sem a chave, e o rótulo de uso (`purpose`) impede que o mesmo texto
 * gere o mesmo índice em campos diferentes.
 */
export type BlindIndexPurpose = 'cpf' | 'email' | 'name-word';

const INDEX_LABEL = 'doesangue:blind-index:v1';

export function blindIndex(purpose: BlindIndexPurpose, value: string): string {
  return createHmac('sha256', deriveSubkey(INDEX_LABEL))
    .update(`${purpose}\u0000${value}`)
    .digest('hex');
}

/**
 * Índice do CPF: pontuação e espaços não contam (com ou sem máscara, o resultado é o mesmo). Os demais
 * caracteres ficam: o pseudônimo de um doador anonimizado não é só dígitos e não pode colidir com outro.
 */
export const cpfIndex = (cpf: string): string => blindIndex('cpf', cpf.replace(/[.\-\s]/g, ''));

/** Índice do e-mail, sem diferenciar maiúsculas nem espaços nas pontas. */
export const emailIndex = (email: string): string =>
  blindIndex('email', email.trim().toLowerCase());

/**
 * Palavras de um nome para busca: minúsculas, sem acento, só letras e dígitos, com pelo menos duas
 * letras e sem repetição. "José da Silva" vira ["jose", "da", "silva"].
 */
export function nameWords(text: string): string[] {
  const words = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2);
  return [...new Set(words)];
}

/** Índices das palavras do nome (um por palavra): a busca por nome compara palavras inteiras. */
export const nameWordIndexes = (name: string): string[] =>
  nameWords(name).map((word) => blindIndex('name-word', word));
