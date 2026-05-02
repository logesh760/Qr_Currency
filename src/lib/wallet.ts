import { supabase } from './supabase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export async function handleSupabaseError(error: any, operationType: OperationType, path: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  const errInfo = {
    error: error.message || String(error),
    authInfo: {
      userId: user?.id,
      email: user?.email,
    },
    operationType,
    path
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function claimQR(qrId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const receiverId = user.id;

  try {
    // 1. Get QR Info
    const { data: qrData, error: qrError } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('id', qrId)
      .single();

    if (qrError || !qrData) throw new Error("QR Code not found");
    if (qrData.is_claimed) throw new Error("This QR Code has already been claimed");
    if (qrData.sender_id === receiverId) throw new Error("You cannot claim your own QR code");

    const amount = qrData.amount;
    const senderId = qrData.sender_id;

    // 2. Perform Transfer (Simulation of atomic logic)
    // Note: In production, use a Database Function (RPC) for atomicity.
    
    // Check sender balance
    const { data: senderWallet, error: senderError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', senderId)
      .single();

    if (senderError || (senderWallet?.balance || 0) < amount) {
      throw new Error("Sender has insufficient balance");
    }

    // Update Sender
    await supabase.from('wallets').update({ 
      balance: senderWallet.balance - amount,
      updated_at: new Date().toISOString()
    }).eq('user_id', senderId);

    // Update Receiver
    const { data: receiverWallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', receiverId)
      .single();

    const newReceiverBalance = (receiverWallet?.balance || 0) + amount;
    
    await supabase.from('wallets').upsert({ 
      user_id: receiverId,
      balance: newReceiverBalance,
      updated_at: new Date().toISOString()
    });

    // Mark as claimed
    await supabase.from('qr_codes').update({ is_claimed: true }).eq('id', qrId);

    return { amount, senderId };
  } catch (error) {
    await handleSupabaseError(error, OperationType.WRITE, `qr_codes/${qrId}`);
  }
}

export async function generatePaymentQR(amount: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const senderId = user.id;

  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', senderId)
    .single();

  if (!wallet || wallet.balance < amount) {
    throw new Error("Insufficient balance to generate QR");
  }

  const { data, error } = await supabase
    .from('qr_codes')
    .insert({
      sender_id: senderId,
      amount: amount,
      is_claimed: false
    })
    .select()
    .single();

  if (error) await handleSupabaseError(error, OperationType.WRITE, 'qr_codes');
  return data.id;
}

export async function createToken(amount: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const userId = user.id;

  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (!wallet || wallet.balance < amount) throw new Error("Insufficient balance");

  // Subtract bank
  await supabase.from('wallets').update({ balance: wallet.balance - amount }).eq('user_id', userId);

  const { error } = await supabase.from('tokens').insert({
    owner_id: userId,
    amount,
    is_spent: false
  });

  if (error) await handleSupabaseError(error, OperationType.WRITE, 'tokens');
}

export async function transferToken(tokenId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const receiverId = user.id;

  const { data: token } = await supabase.from('tokens').select('*').eq('id', tokenId).single();
  if (!token || token.is_spent) throw new Error("Token invalid or spent");

  const { error } = await supabase.from('tokens').update({
    owner_id: receiverId,
    updated_at: new Date().toISOString()
  }).eq('id', tokenId);

  if (error) await handleSupabaseError(error, OperationType.WRITE, 'tokens');
  return { amount: token.amount, senderId: token.owner_id };
}

// Logic for initial wallet creation if missing
export async function initializeWallet() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const userId = user.id;
  
  const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
  if (!data) {
    await supabase.from('wallets').insert({ user_id: userId, balance: 1000 }); // Bonus 1000 for new users
  }
}

export async function splitWallet(amount: number) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");
  const uid = user.id;

  const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', uid).single();
  if (!wallet || wallet.balance < amount) throw new Error("Insufficient balance");

  await supabase.from('transactions').insert({
    sender_id: uid,
    receiver_id: uid,
    amount,
    type: 'split',
    status: 'completed'
  });
}
