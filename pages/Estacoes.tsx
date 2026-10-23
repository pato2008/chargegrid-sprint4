import { Plug, Zap } from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { stations, type StationStatus } from '../mock/stations';
import type { BadgeTone } from '../components/ui/Badge';

const statusLabel: Record<StationStatus, string> = {
  disponivel: 'Disponível',
  'em-uso': 'Em uso',
  offline: 'Offline',
  manutencao: 'Manutenção',
};

const statusTone: Record<StationStatus, BadgeTone> = {
  disponivel: 'success',
  'em-uso': 'magenta',
  offline: 'neutral',
  manutencao: 'warning',
};

export default function Estacoes() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestrutura"
        title="Estações de recarga"
        description="Status e capacidade de cada ponto de recarga cadastrado."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stations.map((station) => (
          <Card key={station.id}>
            <CardHeader
              eyebrow={station.location}
              title={station.name}
              action={<Badge tone={statusTone[station.status]} dot>{statusLabel[station.status]}</Badge>}
            />
            <div className="flex items-center gap-4 text-sm text-text-muted">
              <span className="flex items-center gap-1.5">
                <Plug className="h-4 w-4 text-text-faint" strokeWidth={1.8} />
                {station.connectors} conector{station.connectors > 1 ? 'es' : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-text-faint" strokeWidth={1.8} />
                até {station.maxPowerKw} kW
              </span>
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
