import { UnsubscribeTokenCodec } from '@shared/infrastructure/auth';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  UnsubscribeLinkBuilder,
  UnsubscribeLinks,
} from '../../application/ports/unsubscribe-links.port';

/** Links de descadastro com token assinado (o eligibility-service confere com o mesmo segredo). */
@Injectable()
export class SignedUnsubscribeLinks implements UnsubscribeLinkBuilder {
  private readonly codec: UnsubscribeTokenCodec;
  private readonly frontendUrl: string;
  private readonly apiUrl: string;

  constructor(config: ConfigService) {
    this.codec = new UnsubscribeTokenCodec(config.getOrThrow<string>('JWT_SECRET'));
    this.frontendUrl = config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/+$/, '');
    this.apiUrl = config.get<string>('PUBLIC_API_URL', 'http://localhost:3000').replace(/\/+$/, '');
  }

  forDonor(donorId: string): UnsubscribeLinks {
    const token = encodeURIComponent(this.codec.generate(donorId));
    return {
      pageUrl: `${this.frontendUrl}/unsubscribe?token=${token}`,
      oneClickUrl: `${this.apiUrl}/donors/alerts/unsubscribe?token=${token}`,
    };
  }
}
