// functions/utils/index.js
// Backend - Per funzioni generiche

import * as functions from 'firebase-functions';

export const errorHandler = (err) => {
  functions.logger.error('Errore:', err);
  return err;
};
