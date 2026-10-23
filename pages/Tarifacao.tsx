import { useEffect, useState } from 'react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { getTarifas, type TarifasResponse } from '../lib/api';

const POLL_INTERVAL_MS = 3000;

export default function Tarifacao() {
  const [tarifas, setTarifas] = useState<TarifasResponse | null>(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const dados = await getTarifas();
        if (ativo) setTarifas(dados);
      } catch {
        // mantém último valor conhecido em caso de falha momentânea da API
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
        eyebrow="Regras de cobrança"
        title="Tarifação"
        description="Tarifa dinâmica calculada pelo backend por horário, demanda simultânea e tipo de recarga (sistemaCobranca.py)."
      />

      {!tarifas ? (
        <Card>
          <p className="text-sm text-text-muted">Carregando tarifas do backend…</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader eyebrow="Agora" title="Tarifa por horário" />
              <p className="font-mono text-3xl font-semibold text-text">R$ {tarifas.tarifaHorario.toFixed(2)}<span className="text-sm text-text-faint">/kWh</span></p>
              <p className="mt-2 text-xs text-text-muted">
                Pico (18h–21h): R$ 0,95 · Madrugada (22h–06h): R$ 0,65 · Normal: R$ 0,80
              </p>
            </Card>

            <Card>
              <CardHeader eyebrow="Demanda simultânea" title="Adicional por demanda" />
              <p className="font-mono text-3xl font-semibold text-text">
                R$ {tarifas.adicionalDemanda.toFixed(2)}
                <span className="text-sm text-text-faint">/kWh</span>
              </p>
              <p className="mt-2 text-xs text-text-muted">
                {tarifas.carrosAtivos} carro{tarifas.carrosAtivos !== 1 ? 's' : ''} carregando agora — adicional se aplica a partir de 3.
              </p>
            </Card>
          </div>

          <Card padded={false} className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-text-faint">
                  <th className="px-4 py-3 font-medium">Tipo de recarga</th>
                  <th className="px-4 py-3 font-medium">Potência máxima</th>
                  <th className="px-4 py-3 font-medium">Adicional</th>
                  <th className="px-4 py-3 font-medium">Tarifa final estimada</th>
                </tr>
              </thead>
              <tbody>
                {tarifas.porTipo.map((tipo) => (
                  <tr key={tipo.tipo} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-3 font-medium text-text">{tipo.label}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">{tipo.maxPowerKw} kW</td>
                    <td className="px-4 py-3 font-mono text-text-muted">R$ {tipo.adicionalTipo.toFixed(2)}/kWh</td>
                    <td className="px-4 py-3 font-mono text-text">R$ {tipo.tarifaFinal.toFixed(2)}/kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </PageContainer>
  );
}
