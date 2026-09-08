import { getDb } from './db';
import { fetchBodies } from './integrations/imap';
import type { Connection } from './vault/connections';
import type { Account, EmailEnvelope, MailboxKind } from './types';

// Buscar o corpo no IMAP na hora do clique custa segundos. O refresher vai
// guardando os corpos conforme os e-mails chegam, então abrir é instantâneo.
const RETENTION_DAYS = 30;

export function getCachedBody(
  userId: string,
  account: Account,
  messageId: string,
  mailbox: MailboxKind = 'inbox',
): string | null {
  const row = getDb()
    .prepare(
      'SELECT body FROM email_bodies WHERE user_id = ? AND account = ? AND mailbox = ? AND message_id = ?',
    )
    .get(userId, account, mailbox, messageId) as { body: string } | undefined;
  return row?.body ?? null;
}

export function putCachedBody(
  userId: string,
  account: Account,
  messageId: string,
  body: string,
  mailbox: MailboxKind = 'inbox',
): void {
  getDb()
    .prepare(
      `INSERT INTO email_bodies (user_id, account, mailbox, message_id, body, cached_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, account, mailbox, message_id)
       DO UPDATE SET body = excluded.body, cached_at = excluded.cached_at`,
    )
    .run(userId, account, mailbox, messageId, body, new Date().toISOString());
}

export function pruneOldBodies(now: Date = new Date()): number {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  const result = getDb()
    .prepare('DELETE FROM email_bodies WHERE cached_at < ?')
    .run(cutoff.toISOString());
  return result.changes;
}

export function isCached(
  userId: string,
  account: Account,
  messageId: string,
  mailbox: MailboxKind = 'inbox',
): boolean {
  const row = getDb()
    .prepare(
      'SELECT 1 AS present FROM email_bodies WHERE user_id = ? AND account = ? AND mailbox = ? AND message_id = ?',
    )
    .get(userId, account, mailbox, messageId) as { present: number } | undefined;
  return row !== undefined;
}

// Teto por conta e por ciclo. O aquecimento roda em segundo plano enquanto o
// próximo ciclo do refresher se aproxima; sem limite, uma caixa que acabou de
// ser ligada seguraria a conexão por tempo demais e disputaria o login com o
// refresh seguinte. O que sobra é aquecido nos ciclos posteriores.
const MAX_BODIES_PER_CYCLE = 15;

// Roda em segundo plano depois de cada refresh: só busca o que ainda não está
// em cache e usa uma conexão por conta — não uma por mensagem, que é o que faz
// o servidor recusar os logins seguintes com falha de autenticação.
export async function warmBodyCache(
  userId: string,
  connections: Connection[],
  envelopes: EmailEnvelope[],
): Promise<number> {
  let fetched = 0;

  for (const conn of connections) {
    const faltando = envelopes
      .filter(
        (e) => e.account === conn.id && !isCached(userId, e.account, e.id, e.mailbox),
      )
      .slice(0, MAX_BODIES_PER_CYCLE)
      .map((e) => ({ uid: e.id, mailbox: e.mailbox }));

    if (faltando.length === 0) continue;

    try {
      for (const { uid, mailbox, body } of await fetchBodies(conn, faltando)) {
        putCachedBody(userId, conn.id, uid, body, mailbox);
        fetched += 1;
      }
    } catch {
      // Uma caixa fora do ar não pode interromper o aquecimento das outras;
      // ela será tentada de novo no próximo ciclo.
    }
  }

  return fetched;
}
