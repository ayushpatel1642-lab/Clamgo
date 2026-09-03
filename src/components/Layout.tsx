import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Brain, LayoutList, Clock, Info, BotMessageSquare, BarChart3, HeartHandshake, Settings as SettingsIcon } from 'lucide-react';
import clsx from 'clsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/brain-dump', icon: Brain, label: 'Dump' },
    { to: '/timeline', icon: Clock, label: 'Timeline' },
    { to: '/habits', icon: HeartHandshake, label: 'Habits' },
    { to: '/memory-dock', icon: LayoutList, label: 'Later' },
    { to: '/insights', icon: BarChart3, label: 'Insights' },
    { to: '/coach', icon: BotMessageSquare, label: 'Coach' },
    { to: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#F4F5F2] flex flex-col md:flex-row text-[#1A1C19] font-sans">
      <main className="flex-1 pb-20 md:pb-0 md:pl-20 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#FBFDF8] border-t border-[#E0E3DB] px-3 py-2 flex justify-around items-center z-50 safe-area-pb">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-colors',
                isActive ? 'text-[#3A693A]' : 'text-[#424940] hover:text-[#1A1C19]'
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[9px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Desktop Sidebar Navigation */}
      <nav className="hidden md:flex fixed top-0 left-0 bottom-0 w-20 bg-[#FBFDF8] border-r border-[#E0E3DB] flex-col items-center py-6 z-50">
        <NavLink to="/" className="w-10 h-10 rounded-lg bg-[#3A693A] flex items-center justify-center mb-6 shadow-sm">
          <div className="w-4 h-4 border-2 border-white rounded-full"></div>
        </NavLink>
        
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto scrollbar-none py-2">
          {navItems.slice(0, 7).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                clsx(
                  'p-3 rounded-xl transition-colors flex items-center justify-center',
                  isActive ? 'bg-[#DDE5D9] text-[#101F10]' : 'text-[#424940] hover:bg-[#EDF1E9] hover:text-[#101F10]'
                )
              }
            >
              <item.icon className="w-5 h-5" />
            </NavLink>
          ))}
        </div>

        {/* Settings pinned at bottom of sidebar */}
        <div className="pt-2 border-t border-[#E0E3DB]/80 w-full px-3 flex justify-center">
          <NavLink
            to="/settings"
            title="Settings & Profile"
            className={({ isActive }) =>
              clsx(
                'p-3 rounded-xl transition-colors flex items-center justify-center w-full',
                isActive ? 'bg-[#DDE5D9] text-[#101F10]' : 'text-[#424940] hover:bg-[#EDF1E9] hover:text-[#101F10]'
              )
            }
          >
            <SettingsIcon className="w-5 h-5" />
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
