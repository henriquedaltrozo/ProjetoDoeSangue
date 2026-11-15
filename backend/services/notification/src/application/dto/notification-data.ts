import type { NewEmailNotification } from '../../domain/entities/notification-log';

/** Dados de entrada para registrar/enviar uma notificação por e-mail (o que o worker recebe da fila). */
export type NotificationData = NewEmailNotification;
