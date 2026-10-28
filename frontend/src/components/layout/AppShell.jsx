import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '../../lib/utils';

import { ErrorBoundary } from '../common/ErrorBoundary';
import { RetailCopilot } from '../copilot/RetailCopilot';

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const location = useLocation();

  // Load initial theme from localStorage or default to 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('metaretail_theme') || 'light';
  });

  const [userExplicitOverride, setUserExplicitOverride] = useState(false);

  // If user visits /interactions without an explicit user preference, default to dark
  useEffect(() => {
    if (location.pathname === '/interactions' && !userExplicitOverride) {
      const saved = localStorage.getItem('metaretail_theme');
      if (!saved) {
        setTheme('dark');
      }
    }
  }, [location.pathname, userExplicitOverride]);

  const isDark = theme === 'dark';

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('metaretail_theme', nextTheme);
    setUserExplicitOverride(true);
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen w-full max-w-full bg-background text-foreground flex transition-colors duration-200 overflow-x-hidden">
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        isDark={isDark} 
        toggleTheme={toggleTheme}
      />
      
      <main className={cn(
        "flex-1 flex flex-col min-w-0 w-full max-w-full transition-all duration-300 ease-in-out overflow-x-hidden",
        collapsed ? "md:pl-[72px]" : "md:pl-64"
      )}>
        <Header 
          toggleSidebar={() => setCollapsed(!collapsed)} 
          isDark={isDark}
          toggleTheme={toggleTheme}
          onOpenCopilot={() => setIsCopilotOpen(true)}
        />
        <div className="flex-1 p-4 sm:p-6 w-full max-w-full overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {/* Floating AI Retail Copilot Widget */}
      <RetailCopilot 
        isOpen={isCopilotOpen} 
        setIsOpen={setIsCopilotOpen} 
      />
    </div>
  );
}
