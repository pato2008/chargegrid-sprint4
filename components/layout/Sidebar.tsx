import {
  LayoutGrid,
  Zap,
  Activity,
  Gauge,
  BrainCircuit,
  Receipt,
  History,
  Plug,
  FileBarChart,
  Settings,
  PlusCircle,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/estacoes', label: 'Estações', icon: Zap },
  { to: '/monitoramento', label: 'Monitoramento', icon: Activity },
  { to: '/demanda', label: 'Demanda', icon: Gauge },
  { to: '/ia', label: 'Inteligência Artificial', icon: BrainCircuit },
  { to: '/tarifacao', label: 'Tarifação', icon: Receipt },
  { to: '/sessoes', label: 'Sessões de Recarga', icon: History },
  { to: '/nova-sessao', label: 'Nova Sessão', icon: PlusCircle },
  { to: '/protocolos', label: 'Protocolos', icon: Plug },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Fechar menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red to-magenta">
              <Zap className="h-[18px] w-[18px] text-white" fill="white" strokeWidth={0} />
            </div>
            <div>
              <p className="font-display text-sm font-semibold leading-tight tracking-wide text-text">
                ChargeGrid
              </p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-faint">Intelligence</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-faint lg:hidden" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gradient-to-r from-red-dim to-magenta-dim text-text'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('h-[18px] w-[18px]', isActive && 'text-magenta')} strokeWidth={1.8} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <NavLink
            to="/configuracoes"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-surface-2 text-text' : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )
            }
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} />
            Configurações
          </NavLink>
        </div>
      </aside>
    </>
  );
}
