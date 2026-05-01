import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft, Info, Loader2, Download } from 'lucide-react';
import { generatePaymentQR } from '../lib/wallet';
import { motion, AnimatePresence } from 'motion/react';

export function GenerateQR({ onBack }: { onBack: () => void }) {
  const [amount, setAmount] = useState<string>('');
  const [qrId, setQrId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return setError("Invalid amount");
    
    setLoading(true);
    setError(null);
    try {
      const id = await generatePaymentQR(val);
      setQrId(id);
    } catch (err: any) {
      setError(err.message || "Failed to generate QR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Generate Payment</h1>
      </div>

      {!qrId ? (
        <div className="space-y-6">
          <div className="space-y-4">
            <label className="text-xs text-gray-500 uppercase tracking-widest font-mono">Enter Amount (QR)</label>
            <div className="relative">
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[#111] border border-white/10 p-6 rounded-2xl text-4xl font-bold focus:border-[#00FF00] focus:ring-1 focus:ring-[#00FF00] outline-none transition-all placeholder:text-white/10"
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[#00FF00] font-mono font-bold">QR</div>
            </div>
            {error && <p className="text-red-500 text-sm font-mono">{error}</p>}
          </div>

          <button 
            onClick={handleGenerate}
            disabled={loading || !amount}
            className="w-full py-5 bg-[#00FF00] text-black font-bold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-3 transition-transform active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Create Secure QR'}
          </button>

          <div className="p-4 bg-white/5 rounded-2xl flex gap-3 italic text-xs text-gray-400">
            <Info className="w-4 h-4 shrink-0" />
            Generating a QR code will lock the balance until claimed or expired (10 mins).
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center space-y-6 p-8 bg-white rounded-[2.5rem]"
        >
          <div className="p-4 bg-[#0a0a0a] rounded-3xl">
            <QRCodeSVG value={qrId} size={250} level="H" includeMargin />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-black text-3xl font-bold tracking-tighter">{amount} QR</h2>
            <p className="text-gray-500 text-xs font-mono">Scan this to receive payment</p>
          </div>
          <button 
            onClick={() => setQrId(null)}
            className="w-full py-4 border-2 border-black/10 text-black font-bold rounded-2xl"
          >
            Create Another
          </button>
        </motion.div>
      )}
    </div>
  );
}
