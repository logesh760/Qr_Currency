import { supabase } from './supabase';
import { auth } from './firebase';
import { handleSupabaseError, OperationType } from './wallet';

export async function createBankAccount() {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  const userId = auth.currentUser.uid;

  const { data: existing } = await supabase.from('bank_accounts').select('*').eq('user_id', userId).single();
  if (existing) return existing;

  const { data, error } = await supabase.from('bank_accounts').insert({
    user_id: userId,
    account_number: Math.floor(1000000000 + Math.random() * 9000000000).toString(),
    ifsc_code: 'QRC0001234',
    bank_name: 'QR Bank Simulation',
    balance: 0
  }).select().single();

  if (error) handleSupabaseError(error, OperationType.WRITE, 'bank_accounts');
  return data;
}

export async function depositToBank(amount: number) {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  const userId = auth.currentUser.uid;

  const { data: acc } = await supabase.from('bank_accounts').select('balance').eq('user_id', userId).single();
  if (!acc) throw new Error("Account not found");

  await supabase.from('bank_accounts').update({ 
    balance: acc.balance + amount 
  }).eq('user_id', userId);

  await supabase.from('bank_transactions').insert({
    user_id: userId,
    type: 'deposit',
    amount,
    status: 'completed'
  });
}

export async function transferBankToWallet(amount: number) {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  const userId = auth.currentUser.uid;

  const { data: bank } = await supabase.from('bank_accounts').select('balance').eq('user_id', userId).single();
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userId).single();

  if (!bank || (bank.balance < amount)) throw new Error("Insufficient bank balance");

  // Update Bank
  await supabase.from('bank_accounts').update({ balance: bank.balance - amount }).eq('user_id', userId);
  
  // Update Wallet
  await supabase.from('wallets').update({ balance: (wallet?.balance || 0) + amount }).eq('user_id', userId);

  await supabase.from('bank_transactions').insert({
    user_id: userId,
    type: 'wallet_transfer_out',
    amount,
    status: 'completed'
  });
}

export async function transferWalletToBank(amount: number) {
  if (!auth.currentUser) throw new Error("Unauthenticated");
  const userId = auth.currentUser.uid;

  const { data: bank } = await supabase.from('bank_accounts').select('balance').eq('user_id', userId).single();
  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', userId).single();

  if (!wallet || wallet.balance < amount) throw new Error("Insufficient wallet balance");

  // Update Wallet
  await supabase.from('wallets').update({ balance: wallet.balance - amount }).eq('user_id', userId);

  // Update Bank
  await supabase.from('bank_accounts').update({ balance: (bank?.balance || 0) + amount }).eq('user_id', userId);

  await supabase.from('bank_transactions').insert({
    user_id: userId,
    type: 'wallet_transfer_in',
    amount,
    status: 'completed'
  });
}
