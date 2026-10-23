import { Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { SessionsProvider } from './context/SessionsContext';
import Dashboard from './pages/Dashboard';
import Estacoes from './pages/Estacoes';
import Monitoramento from './pages/Monitoramento';
import Demanda from './pages/Demanda';
import IA from './pages/IA';
import Tarifacao from './pages/Tarifacao';
import Sessoes from './pages/Sessoes';
import NovaSessao from './pages/NovaSessao';
import Protocolos from './pages/Protocolos';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';

function App() {
  return (
    <SessionsProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="estacoes" element={<Estacoes />} />
          <Route path="monitoramento" element={<Monitoramento />} />
          <Route path="demanda" element={<Demanda />} />
          <Route path="ia" element={<IA />} />
          <Route path="tarifacao" element={<Tarifacao />} />
          <Route path="sessoes" element={<Sessoes />} />
          <Route path="nova-sessao" element={<NovaSessao />} />
          <Route path="protocolos" element={<Protocolos />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
      </Routes>
    </SessionsProvider>
  );
}

export default App;
