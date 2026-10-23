import { useMemo, useState } from 'react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { CHARGE_TYPES, type ChargeType } from '../mock/types';
import { useSessions } from '../context/SessionsContext';
import { createSession, type NovaSessaoResponse } from '../lib/api';

// Cada carro é criado via start_session() no Supabase (porta de Carros.py +
// equacoesRecarga.py + sistemaCobranca.py + SimuladorOCPP.py, Data Structures
// Sprint). A fatura retornada na criação é uma estimativa — a bateria segue
// evoluindo no banco (ver charge_sessions_live), e o SessionsContext faz
// polling para refletir o progresso real.

const inputClass =
  'w-full rounded-lg border border-border-soft bg-surface-2 px-3.5 py-2.5 text-sm text-text outline-none focus:border-magenta';
const labelClass = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-faint';

function formatDuracao(horas: number): string {
  if (!isFinite(horas) || horas <= 0) return '—';
  const totalMin = Math.round(horas * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function NovaSessao() {
  const { sessions, refresh } = useSessions();
  const [resposta, setResposta] = useState<NovaSessaoResponse | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [modelo, setModelo] = useState('');
  const [tipoRecarga, setTipoRecarga] = useState<ChargeType>('rapida');
  const [capacidadeKwh, setCapacidadeKwh] = useState(60);

  const tempoCargaCompleta = useMemo(
    () => capacidadeKwh / CHARGE_TYPES[tipoRecarga].maxPowerKw,
    [capacidadeKwh, tipoRecarga],
  );

  async function adicionarCarro() {
    if (!nome.trim() || !modelo.trim() || enviando || capacidadeKwh <= 0) return;

    setEnviando(true);
    setErro(null);
    try {
      const novaSessao = await createSession({ nome, modelo, tipoRecarga, capacidadeKwh });
      setResposta(novaSessao);
      setNome('');
      setModelo('');
      await refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar a sessão.');
    } finally {
      setEnviando(false);
    }
  }

  const fatura = resposta?.fatura ?? null;
  const tempoSessaoReal = resposta ? resposta.session.energyKwh / resposta.session.avgPowerKw : null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Nova sessão"
        title="Nova sessão de recarga"
        description="Cadastra um veículo no Supabase (função start_session, porta de gerenciamentoDeRecarga.py) e inicia a sessão via OCPP StartTransaction."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Cadastro" title="Adicionar carro" />
          <div className="space-y-3.5">
            <div>
              <label className={labelClass}>Nome do cliente</label>
              <input className={inputClass} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João Pedro" />
            </div>
            <div>
              <label className={labelClass}>Modelo do veículo</label>
              <input className={inputClass} value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex: Tesla Model 3" />
            </div>
            <div>
              <label className={labelClass}>Tipo de recarga</label>
              <select
                className={inputClass}
                value={tipoRecarga}
                onChange={(e) => setTipoRecarga(e.target.value as ChargeType)}
              >
                {Object.values(CHARGE_TYPES).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} — até {t.maxPowerKw} kW
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Capacidade da bateria (kWh)</label>
              <input
                type="number"
                min={1}
                max={300}
                step={1}
                className={inputClass}
                value={capacidadeKwh}
                onChange={(e) => setCapacidadeKwh(Number(e.target.value))}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-2 px-3.5 py-3">
              <span className="text-sm text-text-muted">Tempo estimado p/ carga completa (0→100%)</span>
              <span className="font-mono text-sm text-text">{formatDuracao(tempoCargaCompleta)}</span>
            </div>

            <p className="text-xs text-text-faint">
              O nível de bateria inicial do veículo é sorteado pelo backend (mesma regra de Carros.py) — por
              isso a sessão criada pode levar menos tempo que a estimativa acima.
            </p>
            {erro && <p className="text-xs text-red">{erro}</p>}
            <Button variant="primary" className="w-full justify-center" onClick={adicionarCarro} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Iniciar sessão e gerar fatura'}
            </Button>
          </div>
        </Card>

        <Card className={fatura ? 'border-magenta/30 bg-magenta-dim' : undefined}>
          <CardHeader eyebrow="Cobrança" title="Fatura gerada" />
          {!fatura ? (
            <p className="text-sm text-text-muted">Preencha o formulário e inicie uma sessão para ver a fatura calculada aqui.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text">{fatura.clienteNome}</p>
                  <p className="text-xs text-text-muted">{fatura.veiculoModelo}</p>
                </div>
                <Badge tone="magenta" dot>Em andamento</Badge>
              </div>

              <div className="space-y-1.5 rounded-lg border border-border-soft bg-surface-2 px-3.5 py-3 font-mono text-xs text-text-muted">
                <div className="flex justify-between"><span>Energia consumida</span><span className="text-text">{fatura.energiaKwh.toFixed(2)} kWh</span></div>
                <div className="flex justify-between"><span>Tarifa base (horário)</span><span>R$ {fatura.detalheTarifa.tarifaHorario.toFixed(2)}/kWh</span></div>
                <div className="flex justify-between"><span>Adicional por demanda</span><span>R$ {fatura.detalheTarifa.tarifaDemanda.toFixed(2)}/kWh</span></div>
                <div className="flex justify-between"><span>Adicional por tipo</span><span>R$ {fatura.detalheTarifa.tarifaTipo.toFixed(2)}/kWh</span></div>
                <div className="flex justify-between border-t border-border-soft pt-1.5"><span>Tarifa final</span><span className="text-text">R$ {fatura.detalheTarifa.tarifaFinal.toFixed(2)}/kWh</span></div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-surface-3 px-3.5 py-3">
                <span className="text-sm text-text">Total estimado</span>
                <span className="font-mono text-lg font-semibold text-text">R$ {fatura.totalBrl.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-2 px-3.5 py-3">
                <span className="text-sm text-text-muted">Tempo de carregamento desta sessão</span>
                <span className="font-mono text-sm text-text">{formatDuracao(tempoSessaoReal ?? 0)}</span>
              </div>
              <p className="text-[11px] text-text-faint">
                Estimativa calculada na criação da sessão. O valor final é ajustado quando a sessão é concluída (bateria atinge 100%).
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card padded={false} className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-text-faint">
              <th className="px-4 py-3 font-medium">Sessão</th>
              <th className="px-4 py-3 font-medium">Cliente / Veículo</th>
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
                <td className="px-4 py-3 text-text-muted">{CHARGE_TYPES[session.chargeType].label}</td>
                <td className="px-4 py-3 font-mono text-text-muted">{session.durationMin.toFixed(1)} min</td>
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
