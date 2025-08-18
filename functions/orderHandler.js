// functions/orderHandler.js

import { db } from './firebaseAdmin.js'; // Istanza Firebase Admin SDK Firestore
import functions from 'firebase-functions';

export const createOrder = async (req, res) => {
  try {
    const { productId, paymentMethod, quantity, anonUid, email } = req.body;

    // Validazione base
    if (
      typeof productId !== 'string' ||
      typeof paymentMethod !== 'string' ||
      typeof quantity !== 'number' || quantity < 1 ||
      typeof anonUid !== 'string' ||
      typeof email !== 'string' || !email.includes('@')
    ) {
      return res.status(400).json({ error: 'Dati ordine non validi' });
    }

    // Verifica esistenza prodotto
    const productSnap = await db.collection('products').doc(productId).get();
    if (!productSnap.exists) {
      return res.status(404).json({ error: 'Prodotto non trovato' });
    }

    const productData = productSnap.data();

    // Crea ordine nel DB
    const orderData = {
      productId,
      paymentMethod,
      quantity,
      anonUid,
      email,
      status: 'pending',
      createdAt: new Date().toISOString(),
      productDetails: {
        name: productData.name,
        price: productData.price,
      }
    };

    const orderRef = await db.collection('orders').add(orderData);

    // Inserire qui eventuale chiamata a creazione PaymentIntent (o farla frontend se preferisci)

    return res.status(201).json({ orderId: orderRef.id, message: 'Ordine creato' });

  } catch (error) {
    functions.logger.error('Errore createOrder', error);
    return res.status(500).json({ error: 'Errore server interno' });
  }
};
