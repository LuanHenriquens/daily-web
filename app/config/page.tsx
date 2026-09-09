import Link from 'next/link';
import { UsersPanel } from '@/components/UsersPanel';
import { LayoutPanel } from '@/components/LayoutPanel';
import { IntegrationsPanel } from '@/components/IntegrationsPanel';
import { DensityPanel } from '@/components/DensityPanel';

export default function ConfigPage() {
  return (
    <main className="shell">
      <header className="now">
        <div className="now-main">
          <h1 className="type-heading">Configuração</h1>
        </div>
        <div className="now-aside">
          <Link className="btn" href="/">
            Voltar ao painel
          </Link>
        </div>
      </header>

      <div className="columns">
        <div className="col">
          <IntegrationsPanel />
        </div>
        <div className="col">
          <UsersPanel />
          <LayoutPanel />
          <DensityPanel />
        </div>
      </div>
    </main>
  );
}
