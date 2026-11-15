import { Logger } from '@nestjs/common';
import type { LoggerPort } from '../../application/ports';

/**
 * Adaptador do LoggerPort sobre o Logger do Nest. Cada contexto vira o rótulo do log;
 * `defaultContext` vale quando quem chama não informa um.
 */
export class NestLoggerAdapter implements LoggerPort {
  private readonly loggers = new Map<string, Logger>();

  constructor(private readonly defaultContext = 'Application') {}

  warn(message: string, context?: string): void {
    this.for(context).warn(message);
  }

  error(message: string, context?: string, trace?: string): void {
    this.for(context).error(message, trace);
  }

  private for(context = this.defaultContext): Logger {
    let logger = this.loggers.get(context);
    if (!logger) {
      logger = new Logger(context);
      this.loggers.set(context, logger);
    }
    return logger;
  }
}
