import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { CHARGE_TYPES } from '../mock/types';
import { useSessions } from '../context/SessionsContext';

export default function Relatorios() {
  const { sessions } = useSessions();

  const totalEnergia = sessions.reduce((acc, s) => acc + s.energyKwh, 0);
  const totalReceita = sessions.reduce((acc, s) => acc + s.costBrl, 0);
  const concluidas = sessions.filter((s) => s.status === 'concluida').length;

  const porTipo = Object.values(CHARGE_TYPES).map((tipo) => {
    const doTipo = sessions.filter((s) => s.chargeType === tipo.id);
    return {
      tipo: tipo.label,
      sessoes: doTipo.length,
      energia: doTipo.reduce((acc, s) => acc + s.energyKwh, 0),
      receita: doTipo.reduce((acc, s) => acc + s.costBrl, 0),
    };
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Resumo"
        title="Relatórios"
        description="Consolidado de sessões, energia entregue e receita por tipo de recarga."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="mb-1 text-xs text-text-faint">Sessões concluídas</p>
          <p className="font-display text-2xl font-semibold text-text">{concluidas} / {sessions.length}</p>
        </Card>
        <Card>
          <p className="mb-1 text-xs text-text-faint">Energia entregue</p>
          <p className="font-display text-2xl font-semibold text-text">{totalEnergia.toFixed(1)} kWh</p>
        </Card>
        <Card>
          <p className="mb-1 text-xs text-text-faint">Receita total</p>
          <p className="font-display text-2xl font-semibold text-text">R$ {totalReceita.toFixed(2).replace('.', ',')}</p>
        </Card>
      </div>

      <Card padded={false} className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-faint">
              <th className="px-4 py-3 font-medium">Tipo de recarga</th>
              <th className="px-4 py-3 font-medium">Sessões</th>
              <th className="px-4 py-3 font-medium">Energia</th>
              <th className="px-4 py-3 font-medium">Receita</th>
            </tr>
          </thead>
          <tbody>
            {porTipo.map((row) => (
              <tr key={row.tipo} className="border-b border-border-soft last:border-0">
                <td className="px-4 py-3 font-medium text-text">{row.tipo}</td>
                <td className="px-4 py-3 font-mono text-text-muted">{row.sessoes}</td>
                <td className="px-4 py-3 font-mono text-text-muted">{row.energia.toFixed(1)} kWh</td>
                <td className="px-4 py-3 font-mono text-text">R$ {row.receita.toFixed(2).replace('.', ',')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
}
