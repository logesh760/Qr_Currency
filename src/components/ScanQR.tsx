import React, { useState, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ChevronLeft, Loader2, CheckCircle2, XCircle, Image as ImageIcon, ArrowRight, ShieldCheck } from 'lucide-react';
import { claimQR, transferToken } from '../lib/wallet';
import { saveOfflineIntent } from '../lib/offlineStore';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import jsQR from 'jsqr';
import { supabase } from '../lib/supabase';

export function ScanQR({ onBack }: { onBack: () => void }) {
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ amount: number; senderId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Preview States
  const [previewData, setPreviewData] = useState<{ id: string; amount: number; senderId: string; isToken: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScanData = async (qrId: string) => {
    if (!qrId) return;
    setScanning(false);
    setLoading(true);
    setError(null);

    try {
      if (qrId.startsWith('TOKEN:')) {
        const tokenId = qrId.split(':')[1];
        const { data, error: tokenError } = await supabase
          .from('tokens')
          .select('*')
          .eq('id', tokenId)
          .single();

        if (tokenError || !data) {
          throw new Error("Token not found or invalid");
        }

        if (data.is_spent) {
          throw new Error("This token has already been spent");
        }

        setPreviewData({
          id: tokenId,
          amount: data.amount,
          senderId: data.owner_id,
          isToken: true
        });
        return;
      }

      // Fetch QR details for preview
      const { data, error: qrError } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('id', qrId)
        .single();

      if (qrError || !data) {
        throw new Error("Invalid or non-existent QR code");
      }

      if (data.is_claimed) {
        throw new Error("This QR Code has already been claimed");
      }

      setPreviewData({
        id: qrId,
        amount: data.amount,
        senderId: data.sender_id,
        isToken: false
      });
    } catch (err: any) {
      setError(err.message || "Failed to read QR");
    } finally {
      setLoading(false);
    }
  };


  const onScan = (data: any) => {
    if (data && data[0]) {
      handleScanData(data[0].rawValue);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          handleScanData(code.data);
        } else {
          setError("No valid QR code found in image");
          setLoading(false);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAccept = async () => {
    if (!previewData) return;
    setLoading(true);
    setError(null);

    try {
      const claimResult = previewData.isToken 
        ? await transferToken(previewData.id)
        : await claimQR(previewData.id);

      if (claimResult) {
        setResult(claimResult);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00FF00', '#ffffff', '#000000']
        });
      }
    } catch (err: any) {
      const msg = err.message || "Transfer failed";
      setError(msg);
      if (msg.includes('offline') || msg.includes('network')) {
        saveOfflineIntent({ 
          type: previewData.isToken ? 'transfer' : 'claim',
          data: previewData.isToken ? { tokenId: previewData.id } : { qrId: previewData.id }
        });
      }
    } finally {
      setLoading(false);
      setPreviewData(null);
    }
  };

  return (
    <div className="space-y-8 h-[calc(100vh-200px)] flex flex-col">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold tracking-tight">Receive Money</h1>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {scanning && !previewData && !loading && !result && !error && (
            <motion.div 
              key="method-select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full space-y-6"
            >
              <div className="w-full aspect-square rounded-[2.5rem] overflow-hidden border-4 border-white/10 relative">
                <Scanner 
                  onScan={onScan}
                  allowMultiple={false}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-64 h-64 border-2 border-[#00FF00] rounded-3xl relative animate-pulse">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#00FF00] -translate-x-1 -translate-y-1" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#00FF00] translate-x-1 -translate-y-1" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#00FF00] -translate-x-1 translate-y-1" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#00FF00] translate-x-1 translate-y-1" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-center text-xs text-gray-500 font-mono uppercase tracking-widest">Or choose another method</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-blue-400" />
                  <span className="font-bold">Upload from Gallery</span>
                </button>
              </div>
            </motion.div>
          )}

          {previewData && !loading && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-[#111] border border-white/10 p-8 rounded-[2.5rem] space-y-6"
            >
              <div className="flex items-center gap-3 text-[#00FF00] font-mono text-xs uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4" />
                Transaction Verified
              </div>

              <div className="space-y-2">
                <p className="text-gray-500 text-sm font-mono uppercase tracking-widest leading-none">Incoming Amount</p>
                <div className="text-5xl font-bold tracking-tighter">
                  {previewData.amount} <span className="text-[#00FF00] text-2xl">QR</span>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">From Sender</p>
                <p className="font-bold text-lg truncate">{previewData.senderId}</p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={handleAccept}
                  className="w-full py-5 bg-[#00FF00] text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                >
                  Accept Transfer
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => { setPreviewData(null); setScanning(true); }}
                  className="w-full py-4 text-gray-400 font-bold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center space-y-4"
            >
              <Loader2 className="w-12 h-12 text-[#00FF00] animate-spin" />
              <p className="font-mono text-[#00FF00]">Securing Transaction...</p>
            </motion.div>
          )}

          {result && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="text-center space-y-6"
            >
              <div className="w-20 h-20 bg-[#00FF00] rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(0,255,0,0.4)]">
                <CheckCircle2 className="w-12 h-12 text-black" />
              </div>
              <div className="space-y-1">
                <h2 className="text-4xl font-bold tracking-tighter">+{result.amount} QR</h2>
                <p className="text-gray-400 font-mono text-sm px-10">
                  Successfully received from {result.senderId.slice(0, 8)}...
                </p>
              </div>
              <button 
                onClick={onBack}
                className="w-full bg-white text-black py-4 rounded-2xl font-bold"
              >
                Back to Wallet
              </button>
            </motion.div>
          )}

          {error && (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-12 h-12 text-black" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Transfer Refused</h2>
                <p className="text-red-400 text-sm font-mono px-6">
                  {error}
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setScanning(true); setError(null); setResult(null); setPreviewData(null); }}
                  className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-bold"
                >
                  Retry
                </button>
                <button 
                  onClick={onBack}
                  className="flex-1 bg-white text-black py-4 rounded-2xl font-bold"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
