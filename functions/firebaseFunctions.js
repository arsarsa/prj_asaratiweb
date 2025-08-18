// functions/firebaseFunctions.js
// Backend - Firebase Cloud Functions centralizzate

// export { testRegion } from "./test.js";

export { createPaymentIntent } from './payment/createPaymentIntent.js';
export { stripeWebhook } from './payment/stripeWebhook.js';
export { getStripePublicKey } from './payment/getStripePublicKey.js';
export { updateDownloadCount } from './updateDownloadCount.js';
export { getDownloadCount } from './downloads/getDownloadCount.js';
export { verifyTokenFunction } from './auth/verifyTokenFunction.js';
export { sendConfirmationEmail } from './sendConfirmationEmail.js';
export { subscribeToNewsletter } from './subscribeToNewsletter.js';
