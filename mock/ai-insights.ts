export type InsightTone = 'success' | 'warning' | 'info';

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  tone: InsightTone;
  metric?: string;
}

export const aiInsights: AIInsight[] = [
  {
    id: 'AI-01',
    title: 'Deslocar recargas lentas para a madrugada',
    description:
      'Mover 3 sessões do tipo "lenta" para o horário entre 22h e 06h reduziria o custo médio em até 19% sem impactar o tempo de entrega dos veículos.',
    tone: 'success',
    metric: '-19% custo',
  },
  {
    id: 'AI-02',
    title: 'Pico de demanda previsto às 18h40',
    description:
      'Com base no histórico das últimas 2 semanas, a demanda deve se aproximar do limite de 100 kW contratado. Recomenda-se limitar a potência de sessões "rápida" preventivamente.',
    tone: 'warning',
    metric: '96% do limite',
  },
  {
    id: 'AI-03',
    title: 'Geração solar acima da média hoje',
    description:
      'A produção solar está 12% acima da média para o horário, permitindo priorizar autoconsumo nas próximas sessões de recarga.',
    tone: 'info',
    metric: '+12% geração',
  },
];
