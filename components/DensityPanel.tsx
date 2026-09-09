'use client';

import { useEffect, useState } from 'react';
import { Section } from './ui/Section';
import { applyDensity, type Density } from '@/lib/density';

const OPTIONS: { value: Density; label: string; hint: string }[] = [
  { value: 'comfortable', label: 'Confortável', hint: 'Respiro maior entre as linhas.' },
  { value: 'compact', label: 'Compacto', hint: 'Mais linhas visíveis sem sair do lugar.' },
];

/**
 * Density lives on the root element, so the server already stamped it during
 * render. Reading it back from the DOM rather than from a second source keeps
 * one writer: the appliers below change the element, and this reflects it.
 */
export function DensityPanel() {
  const [density, setDensity] = useState<Density>('comfortable');

  useEffect(() => {
    setDensity(document.documentElement.dataset.density === 'compact' ? 'compact' : 'comfortable');
  }, []);

  const choose = (value: Density) => {
    applyDensity(value);
    setDensity(value);
  };

  return (
    <Section eyebrow="Densidade">
      <p className="conn-intro">
        Vale para as listas de todos os painéis. Muda só o ritmo vertical: o tamanho do texto
        continua o mesmo.
      </p>
      <div className="density-options" role="radiogroup" aria-label="Densidade das listas">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={density === option.value}
            className={`chip${density === option.value ? ' chip-active' : ''}`}
            onClick={() => choose(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="conn-help">{OPTIONS.find((o) => o.value === density)?.hint}</p>
    </Section>
  );
}
