import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { CHARGE_TYPES } from '../mock/types';
import { useSessions } from '../context/SessionsContext';

export default function Sessoes() {
  const { sessions } = useSessions();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Histórico"
        title="Sessões de recarga"
        description="Sessões iniciadas e encerradas via StartTransaction / StopTransaction."
      />

      <Card padded={false} className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-faint">
              <th className="px-4 py-3 font-medium">Sessão</th>
              <th className="px-4 py-3 font-medium">Cliente / Veículo</th>
              <th className="px-4 py-3 font-medium">Estação</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Duração</th>
              <th className="px-4 py-3 font-medium">Energia</th>
              <th className="px-4 py-3 font-medium">Custo</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-b border-border-soft last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-text-muted">{session.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-text">{session.clientName}</p>
                  <p className="text-xs text-text-muted">{session.vehicleModel}</p>
                </td>
                <td className="px-4 py-3 text-text-muted">{session.stationName}</td>
                <td className="px-4 py-3 text-text-muted">{CHARGE_TYPES[session.chargeType].label}</td>
                <td className="px-4 py-3 font-mono text-text-muted">{session.durationMin} min</td>
                <td className="px-4 py-3 font-mono text-text-muted">{session.energyKwh.toFixed(1)} kWh</td>
                <td className="px-4 py-3 font-mono text-text">R$ {session.costBrl.toFixed(2).replace('.', ',')}</td>
                <td className="px-4 py-3">
                  <Badge tone={session.status === 'em-andamento' ? 'info' : 'success'} dot>
                    {session.status === 'em-andamento' ? 'Em andamento' : 'Concluída'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
