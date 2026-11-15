import type { InjectionToken, Provider } from '@nestjs/common';

/**
 * Classe da camada application que declara, sem depender do framework, os
 * tokens das suas dependências (na ordem do construtor) em `static inject`.
 */
export interface Injectable<T = unknown> {
  new (...args: any[]): T;
  readonly inject?: readonly InjectionToken[];
}

/** Registra uma classe da application no contêiner do Nest, usando `static inject`. */
export function provide<T>(cls: Injectable<T>): Provider {
  return {
    provide: cls,
    inject: [...(cls.inject ?? [])],
    useFactory: (...dependencies: unknown[]) => new cls(...dependencies),
  };
}

/** Registra várias classes da application de uma vez. */
export function provideAll(classes: readonly Injectable[]): Provider[] {
  return classes.map(provide);
}
