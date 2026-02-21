import React from 'react';

// Simple SVG mini-chart components
const ChartGreen = () => (
    <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
        <path d="M0,50 L20,45 L40,48 L60,30 L80,35 L100,10 L120,15 L140,5 L160,20 L180,12 L200,8" fill="none" stroke="#24ffbd" strokeWidth="2" strokeLinecap="round" />
        <path d="M0,50 L20,45 L40,48 L60,30 L80,35 L100,10 L120,15 L140,5 L160,20 L180,12 L200,8 V60 H0 Z" fill="url(#gradGreen)" opacity="0.1" />
        <defs>
            <linearGradient id="gradGreen" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#24ffbd" />
                <stop offset="100%" stopColor="transparent" />
            </linearGradient>
        </defs>
    </svg>
);

const ChartRed = () => (
    <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
        <path d="M0,10 L40,20 L80,15 L120,45 L160,35 L200,55" fill="none" stroke="#ff4747" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const Strategies: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
            <h2 className="text-3xl font-black tracking-tight text-white">Minhas Estratégias</h2>
            <p className="text-slate-400 mt-1">Gerencie e monitore o desempenho de seus algoritmos em tempo real.</p>
        </div>
        <button className="bg-primary hover:bg-primary/90 text-background-dark font-bold py-2.5 px-6 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(36,255,189,0.2)] transform active:scale-95">
            <span className="material-symbols-outlined">add</span>
            Nova Estratégia
        </button>
      </div>

      <div className="bg-surface border border-border-subtle rounded-xl p-4 mb-8 flex flex-wrap items-center gap-4">
         <div className="flex-1 min-w-[240px]">
            <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                <input className="w-full bg-background-dark border-border-subtle rounded-lg pl-10 py-2 focus:ring-primary focus:border-primary text-sm text-white" placeholder="Buscar estratégia por nome..." type="text"/>
            </div>
         </div>
         <div className="flex items-center gap-3">
             <select className="bg-background-dark border-border-subtle rounded-lg px-4 py-2 text-sm focus:ring-primary min-w-[140px] text-white">
                <option>Todos Mercados</option>
                <option>Match Odds</option>
                <option>Over/Under</option>
             </select>
             <button className="p-2 border border-border-subtle rounded-lg hover:bg-background-dark transition-colors">
                <span className="material-symbols-outlined text-slate-400">filter_list</span>
             </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
         {[
             { name: "Martingale V2 PRO", market: "Match Odds", roi: "+14.2%", win: "62%", games: "420", chart: <ChartGreen/>, active: true },
             { name: "Under 2.5 HT Algo", market: "Over/Under", roi: "+8.5%", win: "58%", games: "156", chart: <ChartGreen/>, active: true },
             { name: "Draw No Bet Hunt", market: "DNB Market", roi: "-2.1%", win: "49%", games: "88", chart: <ChartRed/>, active: false },
             { name: "Corner Pressure V4", market: "Corners", roi: "+21.4%", win: "71%", games: "312", chart: <ChartGreen/>, active: true },
         ].map((strat, i) => (
             <div key={i} className="bg-surface border border-border-subtle rounded-xl p-5 flex flex-col transition-all group hover:border-primary">
                 <div className="flex justify-between items-start mb-4">
                     <div>
                        <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors">{strat.name}</h3>
                        <span className="inline-block bg-primary/10 text-primary text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded mt-1">{strat.market}</span>
                     </div>
                     <button className="text-slate-500 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">more_vert</span>
                     </button>
                 </div>
                 <div className="h-16 w-full mb-6 relative">
                    {strat.chart}
                 </div>
                 <div className="grid grid-cols-3 gap-2 mb-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">ROI</span>
                        <span className={`font-mono font-bold ${strat.roi.startsWith('-') ? 'text-negative' : 'text-primary'}`}>{strat.roi}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Win Rate</span>
                        <span className="font-mono text-white font-bold">{strat.win}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Games</span>
                        <span className="font-mono text-white font-bold">{strat.games}</span>
                    </div>
                 </div>
                 <div className="mt-auto pt-4 border-t border-border-subtle flex items-center justify-between">
                     <div className="flex items-center gap-2">
                         <div className={`relative w-9 h-5 rounded-full transition-colors ${strat.active ? 'bg-primary' : 'bg-slate-700'}`}>
                             <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 transition-transform ${strat.active ? 'translate-x-full' : ''}`}></div>
                         </div>
                         <span className={`text-xs font-bold uppercase ${strat.active ? 'text-primary' : 'text-slate-500'}`}>{strat.active ? 'Ativo' : 'Pausado'}</span>
                     </div>
                     <div className="flex gap-2">
                        <button className="p-1.5 hover:bg-background-dark rounded transition-colors text-slate-400 hover:text-white">
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button className="p-1.5 hover:bg-background-dark rounded transition-colors text-slate-400 hover:text-white">
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                        </button>
                     </div>
                 </div>
             </div>
         ))}

         {/* Add New Card */}
         <div className="border-2 border-dashed border-border-subtle rounded-xl p-5 flex flex-col items-center justify-center min-h-[300px] hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
             <div className="size-12 bg-surface border border-border-subtle rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary transition-all">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-background-dark">add</span>
             </div>
             <p className="font-bold text-slate-400 group-hover:text-primary">Criar Nova Estratégia</p>
             <p className="text-xs text-slate-500 mt-2 text-center max-w-[160px]">Comece a automatizar seus palpites com IA</p>
         </div>
      </div>
    </div>
  );
};

export default Strategies;