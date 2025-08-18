// src/utils/downloadUtils.js
// Utility unica per ottenere URL firmato per download da Firebase Functions

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../logic/firebase-config.js';
import { isNonEmptyString } from './commonFrontend.js';

/**
 * Ottiene l'URL firmata per il download di un prodotto.
 * @param {string} productId - ID del prodotto.
 * @returns {Promise<string>} URL firmata per download.
 */
export async function getDownloadURLForFile(productId) {
  if (!isNonEmptyString(productId)) throw new Error('ID prodotto non valido.');

  const callable = httpsCallable(functions, 'getDownloadUrl');
  const result = await callable({ productId });
  if (!result.data?.downloadUrl) throw new Error('URL di download non ottenuta.');

  return result.data.downloadUrl;
}
