import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { OrderEvent, RealtimeEvent, StoreEvent } from '@kob/core';

const HEARTBEAT_MS = 15_000;

/**
 * SSE plumbing: sets the correct headers and manages heartbeat + close.
 * Event payloads are JSON with an `id` line so clients can dedupe alerts
 * on reconnect via Last-Event-ID (the client-side alert dedupe layer).
 */
export function openSseStream(
  req: Request,
  res: Response,
  sendInitial: () => void,
): { send: (event: RealtimeEvent) => void; done: () => Promise<void> } {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, HEARTBEAT_MS);

  const send = (event: RealtimeEvent): void => {
    if (res.writableEnded) return;
    const eventId = 'eventId' in event ? event.eventId : randomUUID();
    const name = event.type.replace(/\./g, '-');
    res.write(`id: ${eventId}\nevent: ${name}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  const done = () =>
    new Promise<void>((resolve) => {
      clearInterval(heartbeat);
      if (!res.writableEnded) res.end();
      resolve();
    });

  req.on('close', () => {
    void done();
  });

  sendInitial();
  return { send, done };
}

export function serializeEvent(event: OrderEvent | StoreEvent): string {
  return JSON.stringify(event);
}
