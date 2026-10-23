import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { EnergyFlow } from '../components/dashboard/EnergyFlow';
import { AlertsPanel } from '../components/dashboard/AlertsPanel';
import { energyFlow } from '../mock/energy';
import { alerts } from '../mock/alerts';
import { useSessions } from '../context/SessionsContext';

export default function Monitoramento() {
  const { sessions } = useSessions();
  const active = sessions.filter((s) => s.status === 'em-andamento');

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Tempo real"
        title="Monitoramento"
        description="Acompanhamento contínuo do fluxo de energia e eventos da estação."
      />

      <Card>
        <CardHeader eyebrow="Fluxo de energia" title="Estado atual" />
        <EnergyFlow data={energyFlow} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Sessões ativas" title="Carregadores em operação" />
          {active.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhuma sessão em andamento no momento.</p>
          ) : (
            <div className="space-y-3">
              {active.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-2 px-3.5 py-3">
                  <div>
                    <p className="text-sm font-medium text-text">{s.clientName}</p>
                    <p className="text-xs text-text-muted">{s.vehicleModel} · {s.stationName}</p>
                  </div>
                  <p className="font-mono text-sm text-text">{s.avgPowerKw.toFixed(1)} kW</p>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader eyebrow="Últimos eventos" title="Alertas" />
          <AlertsPanel alerts={alerts} />
        </Card>
      </div>
    </PageContainer>
  );
}
