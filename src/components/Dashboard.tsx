import React from 'react';
import { User } from '@supabase/supabase-js';
import { ArrowUpRight, ArrowDownLeft, Wallet, Plus, Scissors, Info } from 'lucide-react';
import { motion } from 'motion/react';
import { splitWallet } from '../lib/wallet';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface DashboardProps {
  balance: number | null;
  user: User;
  setView: (view: any) => void;
}

export function Dashboard({ balance, user, setView }: DashboardProps) {
  const [splitting, setSplitting] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) setTransactions(data);
    };

    fetchRecent();

    const subscription = supabase
      .channel('dashboard_tx')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'transactions',
        filter: `sender_id=eq.${user.id},receiver_id=eq.${user.id}` 
      }, (payload) => {
        setTransactions(prev => [payload.new, ...prev].slice(0, 5));
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user.id]);


  const handleSplit = async () => {
    if (!balance || balance < 100) return alert("Min 100 required to split");
    setSplitting(true);
    try {
      await splitWallet(100);
      alert("Currency Split Simulation Successful! 100 -> 50 + 50");
    } catch (err) {
      console.error(err);
    } finally {
      setSplitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Balance Card */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-gradient-to-br from-[#111] to-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group shadow-2xl"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <Wallet className="w-40 h-40" />
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-gray-400 font-mono text-xs uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-[#00FF00] animate-pulse" />
            Total Balance
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-bold tracking-tighter">
              {balance?.toLocaleString() ?? '---'}
            </span>
            <span className="text-2xl text-[#00FF00] font-mono font-bold">QR</span>
          </div>
          <div className="text-gray-500 text-sm font-mono truncate max-w-[200px]">
            Wallet ID: {user.id.slice(0, 16)}...
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button 
            onClick={() => setView('generate')}
            className="flex-1 bg-white text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#00FF00] transition-all hover:scale-[1.02]"
          >
            <ArrowUpRight className="w-5 h-5" />
            Send
          </button>
          <button 
            onClick={() => setView('scan')}
            className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-all hover:scale-[1.02]"
          >
            <ArrowDownLeft className="w-5 h-5" />
            Receive
          </button>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4">
        <ActionItem 
          onClick={handleSplit}
          icon={<Scissors className="text-blue-400" />}
          label="Split Currency"
          description="Split units into smaller parts"
          loading={splitting}
        />
      </div>

      {/* Info Box */}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl flex gap-4">
        <Info className="w-5 h-5 text-yellow-500 shrink-0" />
        <p className="text-sm text-yellow-500/80 italic font-mono">
          Security: QR codes expire in 10 minutes. Each QR is unique and can only be scanned once.
        </p>
      </div>
    </div>
  );
}

function ActionItem({ icon, label, description, onClick, loading }: { 
  icon: React.ReactNode; 
  label: string; 
  description: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      className="p-6 bg-white/5 border border-white/5 rounded-3xl text-left space-y-2 hover:bg-white/10 transition-all group"
    >
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-bold text-white leading-tight">{label}</h3>
      <p className="text-[10px] text-gray-500 leading-tight uppercase font-mono tracking-wider">
        {loading ? 'Processing...' : description}
      </p>
    </button>
  );
}
