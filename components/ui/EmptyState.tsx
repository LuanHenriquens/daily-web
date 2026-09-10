import type { ReactNode } from 'react';

interface Props {
  message: string;
  /** The action the empty screen is pointing at. The zero state of a list is
   *  a first impression, so it should invite rather than shrug. */
  action?: ReactNode;
}

// Uma tela vazia é um convite à ação, nunca um espaço em branco: cada
// painel passa uma mensagem específica do seu contexto.
export function EmptyState({ message, action }: Props) {
  return (
    <div className="empty">
      <p>{message}</p>
      {action}
    </div>
  );
}
