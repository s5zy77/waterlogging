import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Map, BarChart3, Activity, ListFilter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OfficialPage() {
  const navigate = useNavigate();
  const [reports] = useState([
    { id: 1, loc: 'Park Street', risk: 85, status: 'Critical', time: '10 mins ago' },
    { id: 2, loc: 'Camac Street', risk: 65, status: 'Warning', time: '25 mins ago' },
    { id: 3, loc: 'Salt Lake Sec V', risk: 92, status: 'Critical', time: '5 mins ago' }
  ]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <Activity className="text-red-400" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-transparent">
                Command Center
              </h1>
              <p className="text-sm text-gray-400">Flood-Ready Streets Dashboard</p>
            </div>
          </div>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors border border-gray-700">
            Citizen View
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <DashboardCard title="Active Alerts" value="24" icon={<AlertTriangle className="text-red-400" />} trend="+3 today" />
          <DashboardCard title="Critically Waterlogged" value="8" icon={<Map className="text-orange-400" />} trend="2 cleared" />
          <DashboardCard title="Avg Response Time" value="14m" icon={<BarChart3 className="text-emerald-400" />} trend="-2m from avg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 rounded-2xl h-[500px] flex items-center justify-center border border-gray-800 relative overflow-hidden">
            <div className="absolute inset-0 opacity-20 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=Kolkata&zoom=12&size=800x600&maptype=roadmap&style=feature:all|element:labels.text.fill|color:0x9ca3af&style=feature:all|element:labels.text.stroke|color:0x111827&style=feature:water|element:geometry|color:0x1f2937&style=feature:landscape|element:geometry|color:0x111827')] bg-cover bg-center" />
            <div className="z-10 bg-gray-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-gray-700 text-sm font-medium">
              Live Interactive Map (Simulated)
            </div>
          </div>

          <div className="glass-card rounded-2xl border border-gray-800 flex flex-col">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/10 rounded-t-2xl">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <ListFilter size={18} /> Priority Queue
              </h2>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {reports.map((r, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={r.id} 
                  className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-200 group-hover:text-white">{r.loc}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${r.risk > 80 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      Risk: {r.risk}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>{r.status}</span>
                    <span>{r.time}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, value, icon, trend }) {
  return (
    <div className="glass-card p-6 rounded-2xl border border-gray-800 relative overflow-hidden group hover:border-gray-600 transition-colors cursor-default">
      <div className="absolute top-0 right-0 p-6 opacity-20 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform">
        {React.cloneElement(icon, { size: 64 })}
      </div>
      <div className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">{title}</div>
      <div className="text-4xl font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">{value}</div>
      <div className="mt-4 text-xs font-medium text-gray-500">{trend}</div>
    </div>
  );
}