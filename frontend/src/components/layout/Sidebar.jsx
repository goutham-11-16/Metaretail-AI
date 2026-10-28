import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Camera, Package, MapPin, BarChart3, Clock, Bell, FileText, Settings, Moon, Sun, ShoppingCart, Receipt, Map, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Switch } from '../ui/switch';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Camera, label: 'Cameras', path: '/cameras' },
  { icon: Receipt, label: 'Cashierless POS', path: '/checkout' },
  { icon: Map, label: 'Store Blueprint', path: '/floorplan' },
  { icon: Layers, label: 'Smart Planogram', path: '/planogram' },
  { icon: Package, label: 'Products', path: '/products' },
  { icon: MapPin, label: 'Zones', path: '/zones' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Clock, label: 'Interactions', path: '/interactions' },
  { icon: Bell, label: 'Alerts', path: '/alerts' },
  { icon: FileText, label: 'Event Log', path: '/events' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar({ collapsed, setCollapsed, isDark, toggleTheme }) {
  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out bg-card border-r border-border flex flex-col shadow-sm",
      collapsed ? "w-[72px]" : "w-64"
    )}>
      <div className={cn("flex items-center h-16 px-4 border-b border-border", collapsed ? "justify-center" : "gap-3")}>
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0 shadow-sm">
          <ShoppingCart className="w-5 h-5" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg text-foreground tracking-tight truncate">
            MetaRetail <span className="text-primary font-semibold text-sm">AI</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all group relative font-medium text-sm",
              isActive 
                ? "bg-primary/10 text-primary font-bold shadow-xs dark:bg-primary/20 dark:text-primary-foreground" 
                : "text-slate-700 hover:text-slate-950 hover:bg-slate-100/90 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", isActive ? "text-primary dark:text-primary-foreground" : "text-slate-500 dark:text-slate-400 group-hover:text-foreground")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-border mt-auto bg-muted/20">
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            "w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/80 active:scale-95 transition-all cursor-pointer text-left border border-border/40",
            collapsed && "justify-center p-2"
          )}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            {isDark ? (
              <Moon className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
            )}
            {!collapsed && (
              <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            )}
          </div>
          {!collapsed && (
            <div className={cn(
              "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center",
              isDark ? "bg-primary justify-end" : "bg-zinc-300 dark:bg-zinc-700 justify-start"
            )}>
              <div className="w-4 h-4 rounded-full bg-white shadow-md transition-transform" />
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
