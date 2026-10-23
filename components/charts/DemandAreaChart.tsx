import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DemandPoint } from '../../mock/energy';

interface DemandAreaChartProps {
  data: DemandPoint[];
}

export function DemandAreaChart({ data }: DemandAreaChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c026d3" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#c026d3" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#262832" vertical={false} />
          <XAxis dataKey="time" stroke="#6b6e80" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#6b6e80" fontSize={11} tickLine={false} axisLine={false} unit=" kW" />
          <Tooltip
            contentStyle={{
              background: '#181a23',
              border: '1px solid #262832',
              borderRadius: 8,
              fontSize: 12,
              color: '#f2f3f7',
            }}
            labelStyle={{ color: '#9a9db0' }}
          />
          <Area
            type="monotone"
            dataKey="demandKw"
            name="Demanda"
            stroke="#c026d3"
            strokeWidth={2}
            fill="url(#demandFill)"
          />
          <Line
            type="monotone"
            dataKey="limitKw"
            name="Limite"
            stroke="#ff3b5c"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
