import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.validation';

/**
 * Modulo global de configuração/`.env`, com validação de tipos na
 * inicialização (falha rápido se uma variável estiver com formato errado).
 * Importar uma vez em cada app raiz (AppModule).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env', '../../../.env'],
    }),
  ],
})
export class AppConfigModule {}
