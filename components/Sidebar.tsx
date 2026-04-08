import React from 'react';
import { Search, Database, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }: { path: string; icon: any; label: string }) => (
    <Link
      to={path}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${isActive(path)
        ? 'bg-brand-600 text-white'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col fixed left-0 top-0 text-white border-r border-slate-800">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Database className="text-brand-500" />
          GrowthScout
        </h1>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-4">
          Navigation
        </div>
        <NavItem path="/" icon={Search} label="Manual Sniper" />
        <NavItem path="/pipeline" icon={Database} label="Mass Pipeline" />
        <NavItem path="/clients" icon={Users} label="Clients Inbox" />
      </nav>
    </div>
  );
};

export default Sidebar;