import type { Request, Response } from 'express';

import { UnauthorizedError, ValidationError } from '../../core/errors.js';
import type { Logger } from '../../core/logger.js';
import { verifyGitHubSignature } from './github-signature.js';
import type { WebhookService } from './webhook.service.js';

export class WebhookController {
  constructor(
    private readonly webhooks: WebhookService,
    private readonly secret: string,
    private readonly logger: Logger,
  ) {}

  receiveGitHub = (req: Request, res: Response): void => {
    const rawBody: unknown = req.body;
    if (!Buffer.isBuffer(rawBody)) throw new ValidationError('Expected a JSON payload');
    if (!verifyGitHubSignature(this.secret, rawBody, req.header('x-hub-signature-256'))) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    const eventName = req.header('x-github-event');
    const deliveryId = req.header('x-github-delivery');
    if (!eventName || !deliveryId) throw new ValidationError('Missing GitHub event headers');

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new ValidationError('Malformed JSON payload');
    }

    res.status(202).json({ received: true });

    // Processed after acknowledging: GitHub expects a response within 10 seconds.
    this.webhooks.handle(eventName, deliveryId, payload).catch((err: unknown) => {
      this.logger.error({ err, eventName, deliveryId }, 'Webhook processing failed');
    });
  };
}
