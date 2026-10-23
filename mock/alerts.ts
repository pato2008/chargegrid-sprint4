export type AlertLevel = 'critico' | 'atencao' | 'info';

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  level: AlertLevel;
  time: string;
}

export const alerts: AlertItem[] = [
  {
    id: 'AL-01',
    title: 'Demanda próxima do limite',
    description: 'Estação HCA-001 atingiu 92% do limite contratado de potência.',
    level: 'atencao',
    time: 'há 6 min',
  },
  {
    id: 'AL-02',
    title: 'Sessão concluída',
    description: 'S-1041 finalizada com sucesso — 38.1 kWh entregues.',
    level: 'info',
    time: 'há 42 min',
  },
  {
    id: 'AL-03',
    title: 'Falha de comunicação (recuperada)',
    description: 'Conector 2 perdeu conexão OCPP por 8s e voltou automaticamente.',
    level: 'critico',
    time: 'há 1h',
  },
];
