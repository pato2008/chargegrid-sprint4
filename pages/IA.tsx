import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { Card, CardHeader } from '../components/ui/Card';
import { AIInsightCard } from '../components/dashboard/AIInsightCard';
import { aiInsights } from '../mock/ai-insights';

export default function IA() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="IA aplicada"
        title="Inteligência Artificial"
        description="Recomendações geradas a partir do histórico de consumo, geração solar e demanda."
      />

      <Card>
        <CardHeader eyebrow="Insights ativos" title="Recomendações" />
        <div className="space-y-3">
          {aiInsights.map((insight) => (
            <AIInsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      </Card>
    </PageContainer>
  );
}
