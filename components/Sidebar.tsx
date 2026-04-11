import React from 'react';
import { Search, Database, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ path, icon: Icon, label }: { path: string; icon: any; label: string }) => (
    <Link
      to={path}
      className={`flex md:flex-row flex-col items-center md:gap-3 gap-1 md:px-4 md:py-3 px-2 py-1 md:rounded-lg rounded transition-colors md:mb-1 flex-1 md:flex-none justify-center md:justify-start ${isActive(path)
        ? 'md:bg-brand-600 text-brand-500 md:text-white'
        : 'text-slate-400 md:hover:bg-slate-800 hover:text-white'
        }`}
    >
      <Icon className="w-5 h-5 md:w-5 md:h-5" />
      <span className="font-medium text-[10px] md:text-base whitespace-nowrap hidden md:inline">{label}</span>
      <span className="font-medium text-[10px] md:hidden block mt-0.5">{label.split(' ')[0]}</span>
    </Link>
  );

  return (
    <div className="md:w-64 w-full bg-slate-900 md:h-screen h-16 flex md:flex-col flex-row fixed md:left-0 md:top-0 left-0 bottom-0 text-white md:border-r border-t md:border-t-0 border-slate-800 z-50">
      <div className="p-6 border-b border-slate-800 hidden md:block">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Database className="text-brand-500" />
          GrowthScout
        </h1>
      </div>

      <nav className="flex-1 md:p-4 px-2 py-0 flex md:flex-col flex-row overflow-x-auto md:overflow-y-auto items-center justify-around md:justify-start overflow-hidden">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-4 hidden md:block">
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