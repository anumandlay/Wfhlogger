import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay
const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
const key_secret = process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder';

const instance = new Razorpay({
  key_id,
  key_secret,
});

export async function createOrder(amount, currency = 'USD') {
  // Strict validation
  if (amount === undefined || amount === null || isNaN(amount) || Number(amount) <= 0) {
    throw new Error('Invalid amount: Amount must be a positive number');
  }

  // Convert to cents (integer)
  // Math.round ensures we don't have floating point errors
  const amountInCents = Math.round(Number(amount) * 100);

  if (amountInCents < 50) { // Minimum amount check (approx 50 cents/paise rule usually applies)
     // For USD, usually minimum is 50 cents ($0.50)
     throw new Error('Amount too small: Minimum order is $0.50');
  }

  const options = {
    amount: amountInCents,
    currency,
    receipt: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };

  try {
    const order = await instance.orders.create(options);
    return order;
  } catch (error) {
    console.error('[Razorpay] Create Order Error:', JSON.stringify(error, null, 2));
    // If error is 406, it often means currency not supported or min amount
    if (error.statusCode === 406) {
        throw new Error('Razorpay rejected the order (406). Check if your account supports USD or if the amount is valid.');
    }
    throw error;
  }
}

export function verifySignature(orderId, paymentId, signature) {
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', key_secret)
    .update(body.toString())
    .digest('hex');
  return expectedSignature === signature;
}
