import type { TemplateContext } from '../templates/notification-templates';

/** Dados do ambiente que os modelos de e-mail usam (a base do front, para os links). */
export const TEMPLATE_CONTEXT = Symbol('TEMPLATE_CONTEXT');

export type { TemplateContext };
