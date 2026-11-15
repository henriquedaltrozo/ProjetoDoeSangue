export const LOGGER = Symbol('Logger');

/**
 * Registro de eventos operacionais (falhas toleradas, alertas). `context` rotula a origem do log;
 * `trace` carrega o stack de uma exceção.
 */
export interface LoggerPort {
  warn(message: string, context?: string): void;
  error(message: string, context?: string, trace?: string): void;
}
