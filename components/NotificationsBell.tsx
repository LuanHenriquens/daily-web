'use client';

import { useEffect, useState } from 'react';
import type { NotificationItem, NotificationSource, PanelResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { tabular } from '@/lib/theme';
import { cn } from '@/lib/utils';

/** De onde o aviso veio, em uma palavra. O rótulo era fixo em "JIRA", que
 *  passou a mentir quando o sino ganhou pull request e e-mail. */
const SOURCE_LABEL: Record<NotificationSource, string> = {
  jira_mention: 'JIRA',
  pull_request: 'PR',
  email: 'E-MAIL',
};

interface Props {
  notifications: PanelResult<NotificationItem[]>;
  onChanged: () => void;
  /** Marca como lida na tela antes de o servidor responder. */
  onMarkedRead: (id: string) => void;
  /** O mesmo, para o lote inteiro. */
  onMarkedAllRead: (ids: string[]) => void;
}

export function NotificationsBell({
  notifications,
  onChanged,
  onMarkedRead,
  onMarkedAllRead,
}: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marcandoTodas, setMarcandoTodas] = useState(false);
  const items = notifications.data ?? [];
  const naoLidas = items.filter((n) => !n.read);
  const unreadCount = naoLidas.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const markRead = async (item: NotificationItem) => {
    // O badge cai agora, não quando o servidor responder: a ação é local e
    // não há motivo para a tela esperar uma ida ao banco.
    onMarkedRead(item.id);
    setError(null);

    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Falha ao marcar como lida');
      // Desfaz recarregando do servidor, que é a fonte da verdade.
      onChanged();
      return;
    }
  };

  const markAllRead = async () => {
    if (marcandoTodas || unreadCount === 0) return;
    // Os ids são fixados antes da ida ao servidor: um ciclo do refresher no
    // meio dela mudaria a lista, e o pedido tem de valer para o que estava
    // na tela quando você clicou.
    const ids = naoLidas.map((n) => n.id);

    setMarcandoTodas(true);
    onMarkedAllRead(ids);
    setError(null);

    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setMarcandoTodas(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Falha ao marcar todas como lidas');
      onChanged();
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`notificações (${unreadCount} não lidas)`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Notificações
        {unreadCount > 0 && (
          <Badge className={cn('type-caption px-1.5 leading-none', tabular)}>{unreadCount}</Badge>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-[calc(100%+0.5rem)] right-0 z-50 max-h-[70vh] w-[min(460px,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-line-strong bg-glass-strong p-4 shadow-e4"
            role="dialog"
            aria-label="central de notificações"
          >
            {/* Dispensar um a um custa um clique por aviso, e o sino chega a
                60. O botão só existe quando há o que dispensar. */}
            {unreadCount > 0 && (
              <div className="mb-2 flex items-center justify-between gap-3 border-b border-line pb-3">
                <span className="type-caption text-ink-dim">
                  {unreadCount === 1 ? '1 não lida' : `${unreadCount} não lidas`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={marcandoTodas}
                  onClick={() => void markAllRead()}
                >
                  {marcandoTodas ? 'Marcando…' : 'Marcar todas como lidas'}
                </Button>
              </div>
            )}

            {notifications.error && (
              <p
                role="alert"
                className="type-caption my-2 rounded-r-md border-l-2 border-warning/40 bg-warning-tint p-3 text-ink-mid [overflow-wrap:anywhere]"
              >
                {notifications.error}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="type-caption my-2 rounded-r-md border-l-2 border-warning/40 bg-warning-tint p-3 text-ink-mid [overflow-wrap:anywhere]"
              >
                {error}
              </p>
            )}

            {items.length === 0 && <p className="type-caption py-8 text-ink-dim">Nada por aqui.</p>}

            <ul>
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex flex-col gap-2 border-b border-line py-3 last:border-b-0',
                    item.read && 'text-ink-dim',
                  )}
                >
                  {/* O aviso de e-mail não tem página para abrir: vira texto,
                      porque um href vazio recarregaria o dashboard. */}
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        'type-body block leading-snug hover:underline [overflow-wrap:anywhere]',
                        item.read ? 'text-ink-dim' : 'text-ink',
                      )}
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="type-body [overflow-wrap:anywhere]">{item.title}</span>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-caption tracking-wider text-ink-dim">
                      {SOURCE_LABEL[item.source]}
                    </span>
                    {!item.read && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label={`marcar ${item.title} como lida`}
                        onClick={() => void markRead(item)}
                      >
                        Marcar como lida
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
