// functions/index.js
// Backend - Firebase Cloud Functions centralizzate

export { testRegion } from "./test.js";

export { createPaymentIntent } from "./payment/createPaymentIntent.js";
export { stripeWebhook } from "./payment/stripeWebhook.js";

export { updateDownloadCount } from "./updateDownloadCount.js"; // fuori da downloads/
export { getDownloadCount } from "./downloads/getDownloadCount.js"; // callable
export { verifyTokenFunction } from "./auth/verifyTokenFunction.js";
export { sendConfirmationEmail } from "./sendConfirmationEmail.js";
export { subscribeToNewsletter } from "./subscribeToNewsletter.js";
