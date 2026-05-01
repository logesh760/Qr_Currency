import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUpRight, ArrowDownLeft, Scissors, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface Transaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  type: 'send' | 'receive' | 'split';
  status: string;
  created_at: string;
}

export function TransactionHistory({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (data) setTransactions(data);
      setLoading(false);
    };

    fetchHistory();
  }, [userId]);


  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-bold tracking-tight">Recent Activity</h1>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 font-mono">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx, i) => (
            <motion.div 
              key={tx.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  tx.type === 'split' ? 'bg-blue-500/20 text-blue-400' :
                  tx.sender_id === userId ? 'bg-red-500/20 text-red-400' : 'bg-[#00FF00]/20 text-[#00FF00]'
                }`}>
                  {tx.type === 'split' ? <Scissors className="w-5 h-5" /> :
                   tx.sender_id === userId ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {tx.type === 'split' ? 'Currency Split' :
                     tx.sender_id === userId ? `Sent to ${tx.receiver_id.slice(0, 6)}...` : `Received from ${tx.sender_id.slice(0, 6)}...`}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-mono">
                    {new Date(tx.created_at).toLocaleDateString()} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${
                  tx.type === 'split' ? 'text-white' :
                  tx.sender_id === userId ? 'text-red-400' : 'text-[#00FF00]'
                }`}>
                  {tx.sender_id === userId && tx.type !== 'split' ? '-' : '+'}{tx.amount}
                </p>
                <p className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">{tx.status}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
