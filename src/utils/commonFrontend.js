// src/utils/commonFrontend.js
// Funzioni di utilità leggere per validazione frontend

/**
 * Controlla se una stringa è un'email valida (regex base)
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return EMAIL_REGEX.test(email);
}

/**
 * Controlla se una stringa è non vuota (utile per id, nomi, altri campi)
 * @param {string} val 
 * @returns {boolean}
 */
export function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}
