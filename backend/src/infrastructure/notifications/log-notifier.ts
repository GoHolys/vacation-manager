import type { Logger } from '../../core/logger';
import type { Notification, Notifier } from '../../core/notifier';

/**
 * Development notifier: writes notifications to the structured log instead of sending e-mails.
 * Replace with an SMTP / SES / SendGrid implementation of `Notifier` in production.
 */
export class LogNotifier implements Notifier {
  constructor(private readonly logger: Logger) {}

  async send({ to, subject, body }: Notification): Promise<void> {
    this.logger.info({ to: to.email, subject, body }, '📧 notification sent');
  }
}
