import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from 'sonner';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={0}>
      <App />
      <Toaster theme="system" position="bottom-right" richColors />
    </TooltipProvider>
  </React.StrictMode>,
);
