export interface Notification {
  to: { name: string; email: string };
  subject: string;
  body: string;
}

/** Outbound notification port (e-mail, Slack, push…). */
export interface Notifier {
  send(notification: Notification): Promise<void>;
}
