import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { createToken } from '../lib/wallet';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, Plus, X, ArrowRight, Loader2, Info } from 'lucide-react';
import { User } from '@supabase/supabase-js';

interface TokenManagerProps {
  user: User;
}

export function TokenManager({ user }: TokenManagerProps) {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<any | null>(null);

  useEffect(() => {
    const userId = user.id;

    const fetchTokens = async () => {
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('owner_id', userId)
        .eq('is_spent', false);
      
      if (data) setTokens(data);
      setLoading(false);
    };

    fetchTokens();

    const subscription = supabase
      .channel('token_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tokens',
        filter: `owner_id=eq.${userId}` 
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTokens(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          fetchTokens(); // Refresh list on update/delete
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user.id]);


  const handleMint = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    setMinting(true);
    try {
      await createToken(val);
      setAmount('');
      setMinting(false);
    } catch (e: any) {
      alert(e.message);
      setMinting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Coins className="text-[#00FF00]" />
          My QR Tokens
        </h1>
      </div>

      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Mint New Token</p>
        <div className="flex gap-3">
          <input 
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-[#00FF00] outline-none transition-all"
          />
          <button 
            onClick={handleMint}
            disabled={minting || !amount}
            className="px-6 bg-[#00FF00] text-black font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
          >
            {minting ? <Loader2 className="animate-spin w-5 h-5" /> : <Plus className="w-5 h-5" />}
            Mint
          </button>
        </div>
        <p className="text-[10px] text-gray-600 flex gap-2">
          <Info className="w-3 h-3 shrink-0" />
          Minting converts wallet balance into portable QR cash tokens.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {loading ? (
          [1, 2].map(i => <div key={i} className="h-32 bg-white/5 rounded-3xl animate-pulse" />)
        ) : tokens.length === 0 ? (
          <div className="col-span-2 py-10 text-center text-gray-500 font-mono text-xs">
            No active tokens. Mint one to get started.
          </div>
        ) : (
          tokens.map(token => (
            <motion.button
              key={token.id}
              layoutId={token.id}
              onClick={() => setSelectedToken(token)}
              className="p-6 bg-white/5 border border-white/5 rounded-3xl text-left space-y-2 hover:bg-white/10 transition-all"
            >
              <div className="text-2xl font-bold">{token.amount} <span className="text-[10px] text-[#00FF00]">QR</span></div>
              <p className="text-[8px] text-gray-500 font-mono uppercase truncate">{token.id}</p>
              <div className="pt-2 flex justify-end">
                <ArrowRight className="w-4 h-4 text-[#00FF00]" />
              </div>
            </motion.button>
          ))
        )}
      </div>

      <AnimatePresence>
        {selectedToken && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-6 backdrop-blur-md"
          >
            <motion.div 
              layoutId={selectedToken.id}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm space-y-6 text-center"
            >
              <div className="flex justify-between items-center text-black mb-4">
                <span className="font-mono text-xs text-gray-500">DIGITAL CURRENCY TOKEN</span>
                <button onClick={() => setSelectedToken(null)} className="p-2 bg-black/5 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-3xl inline-block mx-auto">
                <QRCodeSVG value={`TOKEN:${selectedToken.id}`} size={200} />
              </div>

              <div className="space-y-1">
                <h2 className="text-black text-4xl font-bold tracking-tighter">{selectedToken.amount} QR</h2>
                <p className="text-gray-500 font-mono text-[10px] truncate">{selectedToken.id}</p>
              </div>

              <p className="text-xs text-gray-400 font-mono px-4">
                Show this QR to anyone to transfer this token instantly. It is single-use cash.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
