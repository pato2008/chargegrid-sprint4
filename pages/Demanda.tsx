import { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { DemandAreaChart } from '../components/charts/DemandAreaChart';
import { DemandControl } from '../components/dashboard/DemandControl';
import { getDemanda, getDemandaHistorico, type DemandaResponse, type DemandPoint } from '../lib/api';

const POLL_INTERVAL_MS = 2000;

export default function Demanda() {
  const [demanda, setDemanda] = useState<DemandaResponse | null>(null);
  const [historico, setHistorico] = useState<DemandPoint[]>([]);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const [atual, hist] = await Promise.all([getDemanda(), getDemandaHistorico()]);
        if (ativo) {
          setDemanda(atual);
          setHistorico(hist);
        }
      } catch {
        // mantém últimos valores conhecidos em caso de falha momentânea da API
      }
    }
    carregar();
    const id = setInterval(carregar, POLL_INTERVAL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, []);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Gestão de carga"
        title="Controle de demanda"
        description="Histórico de demanda (gerenciamentoDeRecarga.py) comparado ao limite contratado do condomínio."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader eyebrow="Sessão atual" title="Demanda vs. limite" />
          <DemandAreaChart data={historico} />
        </Card>
        <Card>
          <CardHeader eyebrow="Gerenciamento de potência" title="Controle dinâmico de carga" />
          {demanda ? (
            <DemandControl data={demanda} />
          ) : (
            <p className="text-sm text-text-muted">Carregando dados do backend…</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
