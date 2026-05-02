import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { GenerateQR } from './components/GenerateQR';
import { ScanQR } from './components/ScanQR';
import { TransactionHistory } from './components/TransactionHistory';
import { TokenManager } from './components/TokenManager';
import { BankManager } from './components/BankManager';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, LogIn, Loader2, WifiOff } from 'lucide-react';
import { getOfflineIntents, removeOfflineIntent } from './lib/offlineStore';
import { claimQR, transferToken, initializeWallet } from './lib/wallet';
import { User } from '@supabase/supabase-js';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [view, setView] = useState<'dashboard' | 'generate' | 'scan' | 'history' | 'tokens' | 'bank'>('dashboard');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    const intents = getOfflineIntents();
    if (intents.length === 0) return;
    setSyncing(true);
    for (const intent of intents) {
      try {
        if (intent.type === 'claim' && intent.data.qrId) {
          await claimQR(intent.data.qrId);
        } else if (intent.type === 'transfer' && intent.data.tokenId) {
          await transferToken(intent.data.tokenId);
        }
        removeOfflineIntent(intent.id);
      } catch (e) {
        console.error("Sync failed for intent:", intent.id, e);
      }
    }
    setSyncing(false);
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        initData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        initData(currentUser.id);
      } else {
        setBalance(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  const initData = async (userId: string) => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      await initializeWallet();
      
      // Initial balance fetch
      const { data: walletData } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();
      
      if (walletData) setBalance(walletData.balance);

      // Realtime balance listener
      const subscription = supabase
        .channel('wallet_changes')
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'wallets', 
          filter: `user_id=eq.${userId}` 
        }, (payload) => {
          setBalance(payload.new.balance);
        })
        .subscribe();

      setLoading(false);
      return () => {
        subscription.unsubscribe();
      };
    } catch (err) {
      console.error("Initialization error:", err);
      setLoading(false);
    }
  };


  const handleLogin = async () => {
    try {
      if (!supabase) return;
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (err) {
      console.error(err);
      // Fallback if anonymous is disabled: Just simulate success visually or show error
      alert("Guest access failed. Please ensure Anonymous Auth is enabled in Supabase.");
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 text-[#00FF00] animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="w-20 h-20 bg-[#00FF00] rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(0,255,0,0.3)]">
            <QrCode className="w-12 h-12 text-black" />
          </div>
          <h1 className="text-4xl font-bold tracking-tighter">QR Currency</h1>
          <p className="text-gray-400">
            A secure QR-based digital wallet simulation. Pay, split, and track your virtual currency instantly.
          </p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-[#00FF00] text-black font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-[#00cc00] transition-colors"
          >
            <LogIn className="w-5 h-5" />
            Enter Wallet
          </button>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-mono">
            This is a simulation wallet (Not real money)
          </p>
        </motion.div>
      </div>
    );
  }

  if (user && !supabase) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white p-6 text-center space-y-4">
        <div className="p-8 bg-yellow-500/10 border border-yellow-500/20 rounded-[2rem] max-w-sm">
          <WifiOff className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Setup Required</h2>
          <p className="text-sm text-gray-400 mb-6 font-medium">
            To use the wallet, you need to connect your Supabase project. Add these environment variables in the <strong>Settings</strong> menu:
          </p>
          <div className="text-left space-y-2 mb-8">
            <div className="bg-black/80 px-4 py-3 rounded-xl font-mono text-[11px] border border-white/5 flex flex-col">
              <span className="text-gray-500 mb-1">Key Name</span>
              <span className="text-[#00FF00]">VITE_SUPABASE_URL</span>
            </div>
            <div className="bg-black/80 px-4 py-3 rounded-xl font-mono text-[11px] border border-white/5 flex flex-col">
              <span className="text-gray-500 mb-1">Key Name</span>
              <span className="text-[#00FF00]">VITE_SUPABASE_ANON_KEY</span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold border border-white/10 transition-colors"
          >
            Logout & Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      activeView={view} 
      setView={setView} 
      onLogout={handleLogout} 
      user={user}
      isOnline={isOnline}
      syncing={syncing}
      pendingSyncCount={getOfflineIntents().length}
      onSync={handleSync}
    >
      <AnimatePresence mode="wait">
        {view === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: "spring", damping: 20 }}
          >
            <Dashboard balance={balance} user={user} setView={setView} />
          </motion.div>
        )}
        {view === 'generate' && (
          <motion.div
            key="generate"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <GenerateQR onBack={() => setView('dashboard')} />
          </motion.div>
        )}
        {view === 'scan' && (
          <motion.div
            key="scan"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ScanQR onBack={() => setView('dashboard')} />
          </motion.div>
        )}
        {view === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <TransactionHistory userId={user.id} />
          </motion.div>
        )}
        {view === 'tokens' && (
          <motion.div
            key="tokens"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <TokenManager user={user} />
          </motion.div>
        )}
        {view === 'bank' && (
          <motion.div
            key="bank"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <BankManager user={user} />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
