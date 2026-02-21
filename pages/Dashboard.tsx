import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';

const dataEquity = [
  { day: '01', value: 30000 },
  { day: '05', value: 32000 },
  { day: '10', value: 35000 },
  { day: '15', value: 48000 },
  { day: '20', value: 45000 },
  { day: '25', value: 60000 },
  { day: '30', value: 85000 },
];

const dataScatter = [
  { x: 1.5, y: 70 },
  { x: 1.8, y: 65 },
  { x: 2.1, y: 60 },
  { x: 2.5, y: 45 },
  { x: 3.0, y: 40 },
  { x: 3.5, y: 35 },
  { x: 4.0, y: 30 },
  { x: 5.0, y: 20 },
  { x: 1.6, y: 68 },
  { x: 2.2, y: 55 },
  { x: 3.2, y: 38 },
  { x: 4.5, y: 25 },
];

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Profit", value: "+R$ 12.450,00", sub: "▲ 12.5% vs last month", icon: "trending_up", color: "text-primary" },
          { title: "Total Volume", value: "R$ 84.000,00", sub: "Steady flow detected", icon: "account_balance_wallet", color: "text-white" },
          { title: "ROI %", value: "14.8%", sub: "High Performance", icon: "insights", color: "text-primary", progress: 74 },
          { title: "Win Rate %", value: "58.2%", sub: "Confidence interval: High", icon: "check_circle", color: "text-white" },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-surface p-5 rounded-xl border border-border-subtle hover:border-primary/50 transition-all group">
            <div className="flex justify-between items-start mb-2">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{kpi.title}</p>
              <span className={`material-symbols-outlined ${kpi.title === 'Total Profit' ? 'text-primary' : 'text-slate-500'} text-sm`}>{kpi.icon}</span>
            </div>
            <p className={`${kpi.color} text-2xl font-mono font-bold leading-tight`}>{kpi.value}</p>
            {kpi.progress && (
               <div className="w-full bg-slate-800 h-1 rounded-full mt-3">
                 <div className="bg-primary h-1 rounded-full shadow-[0_0_8px_#24ffbd]" style={{ width: `${kpi.progress}%` }}></div>
               </div>
            )}
            <p className="text-slate-500 text-[10px] font-mono mt-1 group-hover:text-primary/70 transition-colors">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Equity Chart */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white text-lg font-bold">Evolução de Patrimônio</h3>
                <p className="text-slate-500 text-xs">Simulated Equity Curve - Global Aggregate</p>
              </div>
              <div className="flex gap-2">
                {['30D', '90D', 'ALL'].map(d => (
                  <button key={d} className={`px-3 py-1 text-[10px] font-bold rounded border ${d === '30D' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-transparent text-slate-500 border-border-subtle hover:text-white'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dataEquity}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#24ffbd" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#24ffbd" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#666', fontSize: 10}} />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: '8px' }}
                    itemStyle={{ color: '#24ffbd' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#24ffbd" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Bars */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <div className="mb-6">
              <h3 className="text-white text-lg font-bold">Performance por Mercado</h3>
              <p className="text-slate-500 text-xs">Categorized Profit/Loss Distribution</p>
            </div>
            <div className="space-y-4">
              {[
                { label: "Over 2.5 Goals", val: "+R$ 4.250", pct: 85, color: "bg-primary", shadow: "shadow-[0_0_8px_#24ffbd]", txtColor: "text-primary" },
                { label: "Both Teams To Score", val: "+R$ 2.800", pct: 60, color: "bg-primary", shadow: "shadow-[0_0_8px_#24ffbd]", txtColor: "text-primary" },
                { label: "Match Odds (Underdog)", val: "-R$ 1.150", pct: 25, color: "bg-negative", shadow: "shadow-[0_0_8px_#ff4d4d]", txtColor: "text-negative", alignRight: true },
                { label: "Asian Handicap", val: "+R$ 5.900", pct: 95, color: "bg-primary", shadow: "shadow-[0_0_8px_#24ffbd]", txtColor: "text-primary" },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-slate-400 uppercase">{item.label}</span>
                    <span className={`${item.txtColor} font-bold`}>{item.val}</span>
                  </div>
                  <div className={`w-full bg-slate-800 h-2 rounded-full overflow-hidden flex ${item.alignRight ? 'justify-end' : 'justify-start'}`}>
                    <div className={`${item.color} h-full ${item.shadow}`} style={{ width: `${item.pct}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

           {/* Scatter Plot */}
           <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <div className="mb-6">
              <h3 className="text-white text-lg font-bold">Odds vs. Taxa de Acerto</h3>
              <p className="text-slate-500 text-xs">Correlação entre Cotação e Win Rate</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <XAxis type="number" dataKey="x" name="Odd" unit="" tick={{fill: '#666', fontSize: 10}} domain={[1, 5]} />
                  <YAxis type="number" dataKey="y" name="Win Rate" unit="%" tick={{fill: '#666', fontSize: 10}} />
                  <ZAxis type="number" range={[50, 50]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', color: '#fff' }} />
                  <Scatter name="Strategies" data={dataScatter} fill="#24ffbd" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Top Leagues */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6 flex flex-col h-full max-h-[500px]">
            <h3 className="text-white text-lg font-bold mb-4">Top Ligas por ROI</h3>
            <div className="space-y-4 overflow-y-auto flex-1 pr-2">
              {[
                { code: "PL", name: "Premier League", val: "+22.4%", pct: 78 },
                { code: "BUN", name: "Bundesliga", val: "+18.2%", pct: 65 },
                { code: "SR A", name: "Serie A", val: "+14.9%", pct: 54 },
                { code: "LGA", name: "La Liga", val: "+11.1%", pct: 42 },
              ].map((league, i) => (
                <div key={i} className="flex items-center gap-3 group cursor-pointer p-2 rounded-lg hover:bg-white/5 transition-colors">
                  <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300">{league.code}</div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-200">{league.name}</span>
                      <span className="text-[10px] font-mono text-primary">{league.val}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1 rounded-full">
                      <div className="bg-primary h-1 rounded-full" style={{ width: `${league.pct}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors border-t border-border-subtle pt-4">
              View Full Analysis
            </button>
          </div>

          {/* Latest Backtests */}
          <div className="bg-surface rounded-xl border border-border-subtle p-6">
            <h3 className="text-white text-lg font-bold mb-4">Últimos Backtests</h3>
            <div className="space-y-3">
              {[
                { date: "2023-10-24 14:02", name: "Martingale V2 Pro", status: "success" },
                { date: "2023-10-24 11:45", name: "Value Bet Scanner", status: "success" },
                { date: "2023-10-23 22:15", name: "Kelly Crit. Mod 4", status: "error" },
              ].map((bt, i) => (
                <div key={i} className={`p-3 bg-background-dark/50 border border-border-subtle rounded-lg flex justify-between items-center group transition-all cursor-pointer hover:border-${bt.status === 'success' ? 'primary' : 'negative'}/50`}>
                  <div>
                    <p className="text-[10px] font-mono text-slate-500">{bt.date}</p>
                    <p className="text-xs font-bold text-white uppercase tracking-tight">{bt.name}</p>
                  </div>
                  <span className={`material-symbols-outlined ${bt.status === 'success' ? 'text-primary' : 'text-negative'} text-xl`}>
                    {bt.status === 'success' ? 'check_circle' : 'cancel'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;