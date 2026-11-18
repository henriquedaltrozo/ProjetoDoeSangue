import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { ValueTransformer } from 'typeorm';

/** Formato atual: AES-256-GCM (cifra + etiqueta de autenticação). */
const ALGORITHM_GCM = 'aes-256-gcm';
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
/** Prefixo dos valores GCM: o formato antigo (CBC, sem prefixo) continua legível. */
export const PREFIX_GCM = 'gcm:';

/** Formato legado (AES-256-CBC, sem verificação de integridade) - só leitura. */
const ALGORITHM_CBC = 'aes-256-cbc';
const CBC_IV_LENGTH = 16;

/**
 * Deriva a chave de 32 bytes usada para cifrar/decifrar a partir de
 * `DATA_ENCRYPTION_KEY`. Aceita hex (64 chars) ou base64 (32 bytes) já no
 * tamanho certo; qualquer outra string é hasheada (SHA-256) para 32 bytes,
 * então uma frase simples no `.env` de desenvolvimento também funciona.
 *
 * Lemos direto de `process.env` (em vez de injetar ConfigService) porque um
 * `ValueTransformer` do TypeORM é instanciado como um objeto simples, fora
 * do container de DI do Nest - não há como injetar nada aqui.
 */
function getKey(): Buffer {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'DATA_ENCRYPTION_KEY não configurada - obrigatória para colunas criptografadas em repouso (ver .env.example).',
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  if (/^[A-Za-z0-9+/]{43}=$/.test(raw)) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) {
      return buf;
    }
  }
  return createHash('sha256').update(raw).digest();
}

/**
 * Subchave de 32 bytes derivada da chave principal para um uso específico (HMAC da chave com um
 * rótulo). Separa as chaves: o índice cego, por exemplo, não usa a mesma chave da cifra.
 */
export function deriveSubkey(label: string): Buffer {
  return createHmac('sha256', getKey()).update(label).digest();
}

export interface EncryptedColumnOptions<T = string> {
  /**
   * Deriva o IV de forma determinística a partir do próprio texto puro (HMAC
   * da chave), em vez de um IV aleatório a cada gravação. Isso faz com que o
   * mesmo valor sempre produza o mesmo texto cifrado, preservando busca e
   * unicidade por igualdade (`WHERE coluna = ...`, `@Index({unique:true})`)
   * mesmo com o dado cifrado no banco.
   *
   * Trade-off aceito para o escopo deste TCC: um IV determinístico revela
   * quando dois registros têm o mesmo valor (ex.: dois doadores com o mesmo
   * tipo sanguíneo terão o mesmo texto cifrado nessa coluna) - um adversário
   * com acesso ao banco aprende padrões de igualdade, não o valor em si. Em
   * produção real, a alternativa mais robusta seria uma coluna de índice
   * cego (HMAC) separada do valor cifrado (com IV aleatório). Usar somente
   * em colunas que realmente precisam de igualdade/unicidade no banco.
   */
  deterministic?: boolean;
  /** Converte o texto puro decifrado de volta para o tipo do campo (padrão: identidade/string). */
  parse?: (raw: string) => T;
  /** Converte o valor do campo para texto antes de cifrar (padrão: `String(value)`). */
  serialize?: (value: T) => string;
}

/**
 * `ValueTransformer` do TypeORM que cifra o valor da coluna em repouso
 * (AES-256-GCM) e decifra de volta na leitura - ver docs/01, seção sobre
 * proteção de dados sensíveis (LGPD).
 *
 * A coluna no Postgres precisa ser `varchar`/`text` (não `enum`/`decimal`/
 * `integer` nativos), já que o valor persistido é o texto cifrado em
 * base64, não o dado original - ver o `@Column({ type: ... })` de cada
 * campo que usa este transformer.
 */
/**
 * Cifra com AES-256-GCM. Formato: `gcm:` + base64(iv[12] | tag[16] | cifrado).
 * A etiqueta de autenticação faz qualquer adulteração do valor no banco falhar na leitura.
 * No modo determinístico o IV vem de um HMAC do texto puro (mesmo texto => mesmo IV), então
 * só valores idênticos compartilham IV e o resultado é igual - o que a busca por igualdade exige.
 */
export function encryptValue(plainText: string, deterministic = false): string {
  const key = getKey();
  const iv = deterministic ? deterministicIv(ivKey(key), plainText) : randomBytes(GCM_IV_LENGTH);
  return encryptWithIv(key, iv, plainText);
}

/**
 * Subchave usada só para derivar o IV determinístico (HMAC da chave principal com um rótulo): a
 * mesma chave não serve a dois algoritmos (HMAC e AES), boa prática de separação de chaves.
 */
function ivKey(key: Buffer): Buffer {
  return createHmac('sha256', key).update('doesangue:deterministic-iv:v1').digest();
}

function deterministicIv(hmacKey: Buffer, plainText: string): Buffer {
  return createHmac('sha256', hmacKey).update(plainText).digest().subarray(0, GCM_IV_LENGTH);
}

/**
 * Cifra determinística no formato anterior (IV derivado da própria chave principal). Só para a
 * migration que regrava os valores antigos poder ser desfeita; não usar em código novo.
 */
export function encryptDeterministicLegacy(plainText: string): string {
  const key = getKey();
  return encryptWithIv(key, deterministicIv(key, plainText), plainText);
}

function encryptWithIv(key: Buffer, iv: Buffer, plainText: string): string {
  const cipher = createCipheriv(ALGORITHM_GCM, key, iv, { authTagLength: GCM_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX_GCM + Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/** Decifra valores GCM (com prefixo) e também os antigos em CBC (sem prefixo). */
export function decryptValue(value: string): string {
  const key = getKey();
  if (value.startsWith(PREFIX_GCM)) {
    const raw = Buffer.from(value.slice(PREFIX_GCM.length), 'base64');
    const iv = raw.subarray(0, GCM_IV_LENGTH);
    const tag = raw.subarray(GCM_IV_LENGTH, GCM_IV_LENGTH + GCM_TAG_LENGTH);
    const encrypted = raw.subarray(GCM_IV_LENGTH + GCM_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM_GCM, key, iv, { authTagLength: GCM_TAG_LENGTH });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
  const raw = Buffer.from(value, 'base64');
  const decipher = createDecipheriv(ALGORITHM_CBC, key, raw.subarray(0, CBC_IV_LENGTH));
  return Buffer.concat([decipher.update(raw.subarray(CBC_IV_LENGTH)), decipher.final()]).toString(
    'utf8',
  );
}

/** Valor ainda no formato antigo (CBC)? Usado pelo script de migração. */
export const legacyValue = (value: string): boolean => !value.startsWith(PREFIX_GCM);

export function encryptedColumn<T = string>(
  options: EncryptedColumnOptions<T> = {},
): ValueTransformer {
  const deterministic = options.deterministic ?? false;
  const parse = options.parse ?? ((raw: string) => raw as unknown as T);
  const serialize = options.serialize ?? ((value: T) => String(value));

  return {
    to(value: T | null | undefined): string | null {
      if (value === null || value === undefined) {
        return null;
      }
      return encryptValue(serialize(value), deterministic);
    },
    from(value: string | null | undefined): T | null {
      if (value === null || value === undefined) {
        return null;
      }
      return parse(decryptValue(value));
    },
  };
}
