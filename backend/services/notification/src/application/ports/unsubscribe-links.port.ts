import type { UnsubscribeLinks } from '../templates/notification-templates';

export type { UnsubscribeLinks };

export const UNSUBSCRIBE_LINKS = Symbol('UNSUBSCRIBE_LINKS');

/** Monta os links para o doador deixar de receber campanhas e o "já pode doar". */
export interface UnsubscribeLinkBuilder {
  forDonor(donorId: string): UnsubscribeLinks;
}
