// functions/utils/common.js

import * as functions from 'firebase-functions';
import { https } from 'firebase-functions';

// --- Logging centralizzato ---

/**
 * Log informazioni generiche
 * @param {string} message 
 * @param {object} data Opzionale, dati aggiuntivi da loggare
 */
export const logInfo = (message, data = {}) => {
  functions.logger.info(message, data);
};

/**
 * Log warning
 * @param {string} message 
 * @param {object} data Opzionale
 */
export const logWarn = (message, data = {}) => {
  functions.logger.warn(message, data);
};

/**
 * Log error
 * @param {string} message 
 * @param {object} data Opzionale
 */
export const logError = (message, data = {}) => {
  functions.logger.error(message, data);
};

// --- Validazioni comuni ---

/**
 * Valida formato email con regex base
 * @param {string} email 
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_REGEX.test(email);
};

/**
 * Valida id semplice: deve essere stringa non vuota
 * @param {string} id 
 * @returns {boolean}
 */
export const isValidId = (id) => {
  return typeof id === 'string' && id.trim().length > 0;
};

/**
 * Valida stringa non vuota
 * @param {string} val 
 * @returns {boolean}
 */
export const isNonEmptyString = (val) => {
  return typeof val === 'string' && val.trim().length > 0;
};

// --- Gestione errori uniformi ---

/**
 * Lancia un HttpsError coerente
 * @param {string} code Codice errore (invalid-argument, unauthenticated, not-found, internal, ecc.)
 * @param {string} message Messaggio errore
 */
export const throwHttpsError = (code, message) => {
  throw new https.HttpsError(code, message);
};

/**
 * Verifica email e lancia errore in caso di formato non valido
 * @param {string} email 
 */
export const validateEmailOrThrow = (email) => {
  if (!isValidEmail(email)) {
    logWarn('Email non valida', { email });
    throwHttpsError('invalid-argument', 'Email non valida');
  }
};

/**
 * Verifica id e lancia errore in caso di formato non valido
 * @param {string} id 
 */
export const validateIdOrThrow = (id) => {
  if (!isValidId(id)) {
    logWarn('ID non valida o mancante', { id });
    throwHttpsError('invalid-argument', 'ID non valido o mancante');
  }
};

/**
 * Verifica stringa non vuota e lancia errore se non valido
 * @param {string} str 
 */
export const validateNonEmptyStringOrThrow = (str, fieldName = 'Campo') => {
  if (!isNonEmptyString(str)) {
    logWarn(`${fieldName} non valido o vuoto`, { str });
    throwHttpsError('invalid-argument', `${fieldName} non valido o vuoto`);
  }
};
