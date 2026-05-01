import React from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { QrCode, Wallet, Activity, LogOut, ScanLine, WifiOff, RefreshCcw, Coins, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: 'dashboard' | 'generate' | 'scan' | 'history' | 'tokens' | 'bank';
  setView: (view: 'dashboard' | 'generate' | 'scan' | 'history' | 'tokens' | 'bank') => void;
  onLogout: () => void;
  user: FirebaseUser;
  isOnline: boolean;
  syncing: boolean;
  pendingSyncCount: number;
  onSync: () => void;
}

export function Layout({ 
  children, 
  activeView, 
  setView, 
  onLogout, 
  user,
  isOnline,
  syncing,
  pendingSyncCount,
  onSync
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-white/10 glass-bg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#00FF00] rounded-lg flex items-center justify-center">
            <QrCode className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">QR CURRENCY</span>
        </div>
        <div className="flex items-center gap-4">
          {!isOnline && <WifiOff className="w-5 h-5 text-red-500 animate-pulse" />}
          {isOnline && pendingSyncCount > 0 && (
            <button onClick={onSync} disabled={syncing} className="p-2 bg-[#00FF00]/20 rounded-lg">
              <RefreshCcw className={`w-5 h-5 text-[#00FF00] ${syncing ? 'animate-spin' : ''}`} />
            </button>
          )}
          <img 
            src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            alt="Profile" 
            className="w-8 h-8 rounded-full border border-white/20"
          />
          <button 
            onClick={onLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 relative max-w-2xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="p-4 border-t border-white/10 glass-bg sticky bottom-0 z-50">
        <div className="flex justify-around items-center max-w-sm mx-auto">
          <NavButton 
            active={activeView === 'bank'} 
            onClick={() => setView('bank')}
            icon={<Building2 />}
            label="Bank"
          />
          <NavButton 
            active={activeView === 'dashboard'} 
            onClick={() => setView('dashboard')}
            icon={<Wallet />}
            label="Wallet"
          />
          <NavButton 
            active={activeView === 'scan'} 
            onClick={() => setView('scan')}
            icon={<ScanLine />}
            label="Scan"
            primary
          />
          <NavButton 
            active={activeView === 'tokens'} 
            onClick={() => setView('tokens')}
            icon={<Coins />}
            label="Tokens"
          />
          <NavButton 
            active={activeView === 'history'} 
            onClick={() => setView('history')}
            icon={<Activity />}
            label="Activity"
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, primary }: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  primary?: boolean;
}) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex flex-col items-center gap-1 transition-all ${
        primary 
          ? 'bg-[#00FF00] text-black p-4 rounded-2xl -mt-10 shadow-[0_10px_20px_rgba(0,255,0,0.2)]' 
          : active ? 'text-[#00FF00]' : 'text-gray-500'
      }`}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        {icon}
      </div>
      {!primary && <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>}
      {active && !primary && (
        <motion.div 
          layoutId="nav-glow"
          className="absolute -bottom-4 w-1 h-1 bg-[#00FF00] rounded-full shadow-[0_0_10px_#00FF00]"
        />
      )}
    </button>
  );
}
