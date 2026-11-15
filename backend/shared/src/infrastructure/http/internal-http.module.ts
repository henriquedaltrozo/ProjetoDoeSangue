import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { RequestContextService } from '../observability';
import { InternalHttpClient } from './internal-http.client';

/** Disponibiliza o InternalHttpClient para os adaptadores que chamam outros serviços. */
@Module({
  imports: [HttpModule.register({ timeout: 5000 })],
  providers: [InternalHttpClient, RequestContextService],
  exports: [InternalHttpClient],
})
export class InternalHttpModule {}
