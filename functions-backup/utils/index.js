// functions/utils/index.js
// Backend - Per funzioni generiche

exports.errorHandler = (err) => {
  console.error('Errore:', err);
  return err;
};
