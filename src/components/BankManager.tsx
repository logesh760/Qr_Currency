import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { auth } from '../lib/firebase';
import { createBankAccount, depositToBank, transferBankToWallet, transferWalletToBank } from '../lib/bank';
import { motion, AnimatePresence } from 'motion/react';
import { Landmark, ArrowRightLeft, Plus, History, Loader2, Building2, CreditCard, Wallet } from 'lucide-react';

interface BankAccount {
  user_id: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  balance: number;
}

interface BankTransaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdraw' | 'wallet_transfer_in' | 'wallet_transfer_out';
  amount: number;
  status: string;
  created_at: string;
}

export function BankManager() {
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'view' | 'deposit' | 'transfer_to_wallet' | 'transfer_from_wallet'>('view');

  useEffect(() => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;

    const fetchData = async () => {
      const { data: acc } = await supabase.from('bank_accounts').select('*').eq('user_id', userId).single();
      if (acc) setAccount(acc);

      const { data: txs } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (txs) setTransactions(txs);
      
      setLoading(false);
    };

    fetchData();

    // Listen for changes
    const accountSub = supabase
      .channel('bank_account_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bank_accounts', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => {
        setAccount(payload.new as BankAccount);
      })
      .subscribe();

    const txSub = supabase
      .channel('bank_tx_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'bank_transactions', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => {
        setTransactions(prev => [payload.new as BankTransaction, ...prev].slice(0, 10));
      })
      .subscribe();

    return () => {
      accountSub.unsubscribe();
      txSub.unsubscribe();
    };
  }, []);

  const handleCreateAccount = async () => {
    setActionLoading(true);
    try {
      await createBankAccount();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    setActionLoading(true);
    try {
      if (mode === 'deposit') await depositToBank(val);
      if (mode === 'transfer_to_wallet') await transferBankToWallet(val);
      if (mode === 'transfer_from_wallet') await transferWalletToBank(val);
      setAmount('');
      setMode('view');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#00FF00]" /></div>;

  if (!account) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mb-4">
          <Building2 className="w-12 h-12 text-gray-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">No Bank Account Found</h1>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Create a virtual simulation bank account to start transferring money between your QR Wallet and Bank.
          </p>
        </div>
        <button 
          onClick={handleCreateAccount}
          disabled={actionLoading}
          className="w-full py-4 bg-[#00FF00] text-black font-bold rounded-2xl flex items-center justify-center gap-2"
        >
          {actionLoading ? <Loader2 className="animate-spin" /> : <Plus className="w-5 h-5" />}
          Open QR Bank Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Account Info Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white text-black p-8 rounded-[2.5rem] space-y-8 relative overflow-hidden"
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest leading-none">Simulation Bank Account</p>
            <h2 className="text-xl font-bold tracking-tight">QR Bank Limited</h2>
          </div>
          <Landmark className="text-gray-300 w-8 h-8" />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-400 font-mono">Current Balance</p>
          <div className="text-5xl font-bold tracking-tighter">
            ₹{(account.balance || 0).toLocaleString()}
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest leading-none">Account Number</p>
            <p className="font-mono text-sm tracking-widest font-bold">**** **** {(account.account_number || '').slice(-4)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-mono uppercase tracking-widest leading-none">IFSC Code</p>
            <p className="font-mono text-sm font-bold">{account.ifsc_code}</p>
          </div>
        </div>
      </motion.div>

      {/* Action Tabs */}
      <div className="grid grid-cols-3 gap-3">
        <button 
          onClick={() => setMode(mode === 'deposit' ? 'view' : 'deposit')}
          className={`p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${mode === 'deposit' ? 'bg-[#00FF00] border-[#00FF00] text-black' : 'bg-white/5 border-white/10 text-white'}`}
        >
          <Plus className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider text-center">Deposit</span>
        </button>
        <button 
          onClick={() => setMode(mode === 'transfer_to_wallet' ? 'view' : 'transfer_to_wallet')}
          className={`p-4 rounded-2xl flex flex-col items-center gap-2 border transition-all ${mode === 'transfer_to_wallet' ? 'bg-[#00FF00] border-[#00FF00] text-black' : 'bg-white/5 border-white/10 text-white'}`}
        >
          <ArrowRightLeft className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider text-center leading-tight">To Wallet</span>
        </button>
        <button 
          onClick={() => setMode(mode === 'transfer_from_wallet' ? 'view' : 'transfer_from_wallet')}
          className={`p-4 rounded-2xl flex flex-col items-center gap-2 border border-dashed transition-all ${mode === 'transfer_from_wallet' ? 'bg-[#00FF00] border-[#00FF00] text-black' : 'bg-white/5 border-white/10 text-white'}`}
        >
          <Wallet className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider text-center leading-tight">From Wallet</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode !== 'view' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#00FF00]">
                {mode === 'deposit' && 'Add Money to Bank'}
                {mode === 'transfer_to_wallet' && 'Bank to Wallet Transfer'}
                {mode === 'transfer_from_wallet' && 'Wallet to Bank Transfer'}
              </h3>
              <div className="flex gap-3">
                <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#00FF00]"
                />
                <button 
                  onClick={handleAction}
                  disabled={actionLoading || !amount}
                  className="px-6 bg-[#00FF00] text-black font-bold rounded-xl disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="animate-spin" /> : 'Confirm'}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 font-mono italic">
                * This is a simulated transaction. No real money will be touched.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Section */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <History className="w-4 h-4" />
          Bank Statements
        </h3>
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-white/5 ${
                  tx.type === 'deposit' || tx.type === 'wallet_transfer_in' ? 'text-green-500' : 'text-red-500'
                }`}>
                  {tx.type === 'deposit' && <Plus className="w-4 h-4" />}
                  {tx.type === 'wallet_transfer_in' && <Wallet className="w-4 h-4" />}
                  {tx.type === 'wallet_transfer_out' && <CreditCard className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-bold capitalize">{tx.type.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-gray-500 font-mono">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className={`font-bold ${
                tx.type === 'deposit' || tx.type === 'wallet_transfer_in' ? 'text-[#00FF00]' : 'text-white'
              }`}>
                {tx.type === 'deposit' || tx.type === 'wallet_transfer_in' ? '+' : '-'} ₹{tx.amount}
              </div>
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-center py-8 text-gray-500 font-mono text-xs">
              No transactions yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
