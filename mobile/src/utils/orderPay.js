import { Alert } from 'react-native';
import { apiRequest } from '../api/client';
import { beginInAppCheckout } from '../wallet/checkoutSession';

/** Handle POST /orders response: wallet paid, free order, or Interswitch top-up link. */
export function presentOrderResult({ pack, router, clearCart, token }) {
  const order = pack?.order;
  const payment = pack?.payment;

  if ((payment?.paymentLink || payment?.paymentHtml) && payment?.reference && token && order?._id) {
    if (clearCart) clearCart();
    beginInAppCheckout(router, {
      paymentLink: payment.paymentLink,
      paymentHtml: payment.paymentHtml,
      reference: payment.reference,
      returnUrlPrefixes: payment.returnUrlPrefixes,
      intent: 'order_pay',
      orderId: String(order._id),
    });
    return;
  }

  if (payment?.paymentLink) {
    Alert.alert(
      'Complete payment',
      'Pay the remaining balance with Interswitch, or top up your wallet and finish from your order.',
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            if (clearCart) clearCart();
            if (order?._id) {
              router.push({ pathname: '/(app)/orders/[id]', params: { id: String(order._id) } });
            }
          },
        },
        {
          text: 'Open checkout',
          onPress: async () => {
            const { Linking } = await import('react-native');
            Linking.openURL(payment.paymentLink).catch(() => {});
            if (clearCart) clearCart();
            if (order?._id) {
              router.push({ pathname: '/(app)/orders/[id]', params: { id: String(order._id) } });
            }
          },
        },
      ]
    );
    return;
  }

  if (clearCart) clearCart();
  if (order?._id) {
    Alert.alert(
      'Order placed',
      payment?.method === 'wallet' ? 'Paid from your wallet.' : 'Your order is confirmed.',
      [{ text: 'OK', onPress: () => router.push({ pathname: '/(app)/orders/[id]', params: { id: String(order._id) } }) }]
    );
  }
}
