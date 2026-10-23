import { useState } from 'react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const inputClass =
  'w-full rounded-lg border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm text-text outline-none focus:border-magenta';
const labelClass = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint';

export default function Configuracoes() {
  const [limiteKw, setLimiteKw] = useState(18);
  const [modoAutomatico, setModoAutomatico] = useState(true);
  const [saved, setSaved] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Ajustes"
        title="Configurações"
        description="Parâmetros da estação e do algoritmo de controle de demanda."
      />

      <Card className="max-w-xl">
        <CardHeader eyebrow="Estação HCA-001" title="Parâmetros gerais" />
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Limite contratado (kW)</label>
            <input
              type="number"
              className={inputClass}
              value={limiteKw}
              onChange={(e) => setLimiteKw(Number(e.target.value))}
            />
          </div>

          <label className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-2 px-3.5 py-3">
            <span className="text-sm text-text">Controle de demanda automático</span>
            <input
              type="checkbox"
              checked={modoAutomatico}
              onChange={(e) => setModoAutomatico(e.target.checked)}
              className="h-4 w-4 accent-magenta"
            />
          </label>

          <Button
            variant="primary"
            onClick={() => setSaved(true)}
          >
            Salvar alterações
          </Button>
          {saved && <p className="text-xs text-success">Configurações salvas (demo — não persiste após recarregar).</p>}
        </div>
      </Card>
    </PageContainer>
  );
}
