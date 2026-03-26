import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Simulator from './pages/Simulator';
import ImportData from './pages/ImportData';
import Strategies from './pages/Strategies';
import GameList from './pages/GameList';
import CompoundOdds from './pages/CompoundOdds';
import DaySelection from './pages/DaySelection';
import SniperList from './pages/SniperList';

const Header: React.FC = () => {
  const location = useLocation();

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return isActive
      ? "text-primary text-sm font-semibold border-b-2 border-primary pb-1 transition-all"
      : "text-slate-400 hover:text-white text-sm font-medium transition-colors pb-1 border-b-2 border-transparent";
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-background-dark/80 backdrop-blur-md px-6 py-3">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-center">
             {/* Using a direct image link or icon as requested */}
            <span className="material-symbols-outlined text-primary text-2xl">monitoring</span>
          </div>
          <h1 className="text-xl font-bold tracking-tighter text-white uppercase italic">
            Odd <span className="text-primary">Científica</span>
          </h1>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/dashboard" className={getLinkClass('/dashboard')}>Dashboard</Link>
          <Link to="/import" className={getLinkClass('/import')}>Importação</Link>
          <Link to="/games" className={getLinkClass('/games')}>Lista de Jogos</Link>
          <Link to="/day-selection" className={getLinkClass('/day-selection')}>⭐ Seleção do Dia</Link>
          <Link to="/sniper-list" className={
            location.pathname === '/sniper-list'
              ? 'text-orange-400 text-sm font-semibold border-b-2 border-orange-400 pb-1 transition-all'
              : 'text-slate-400 hover:text-orange-400 text-sm font-medium transition-colors pb-1 border-b-2 border-transparent'
          }>🎯 Sniper List</Link>
          <Link to="/simulator" className={getLinkClass('/simulator')}>Simulador</Link>
          <Link to="/strategies" className={getLinkClass('/strategies')}>Estratégias</Link>
          <Link to="/compound" className={getLinkClass('/compound')}>Juros Compostos</Link>
        </nav>

        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-400 hover:text-white transition-colors relative group">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-background-dark animate-pulse"></span>
          </button>
          <div className="h-8 w-[1px] bg-border-subtle mx-2"></div>
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white leading-none">Dr. Data</p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">PRO ACCOUNT</p>
            </div>
            {/* Direct image link for user avatar */}
            <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center overflow-hidden group-hover:border-primary transition-all">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHVrgiqGKEWbxpLNKsbEzL01gHh6uFVGnaQ8888f5V9agyjkMNnfFVngOOPESiyXXcSOiacHhMntWvpp-1viNxZXjfhLfylZs9YFxoYIipXJYPUta2NmylBfELErGBnigHo9SoNsJHuDFTtfC96r4lnrpkWIOtEoMzLX5UvnG403BE2zxcKPJtr2f9BUf9u6BjNV7y8o1EyfkQb1JGMkGSHa_d8MXJU0A5VAu8wJfzOdbGuuI3Jvt_8r6VqZsVliuxB1EQLjIvztY" 
                alt="User" 
                className="w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen bg-background-dark text-slate-100 font-display selection:bg-primary/30 flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/games" element={<GameList />} />
            <Route path="/day-selection" element={<DaySelection />} />
            <Route path="/sniper-list" element={<SniperList />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/import" element={<ImportData />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/compound" element={<CompoundOdds />} />
          </Routes>
        </main>
        
        <footer className="border-t border-border-subtle bg-background-dark py-4 px-6 mt-auto">
          <div className="max-w-[1600px] mx-auto flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(36,255,189,0.8)]"></div>
                <p className="text-[10px] font-mono text-slate-400">STATUS: <span className="text-white">OPTIMAL</span></p>
              </div>
              <div className="h-3 w-[1px] bg-border-subtle"></div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[14px]">database</span>
                <p className="text-[10px] font-mono text-slate-400">DB: <span className="text-white">4.2TB / 8.0TB</span></p>
              </div>
              <div className="h-3 w-[1px] bg-border-subtle"></div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[14px]">memory</span>
                <p className="text-[10px] font-mono text-slate-400">LATENCY: <span className="text-white">12ms</span></p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-tighter">© 2024 Odd Científica v2.4.12 - Secure Data Protocol Active</p>
            </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;