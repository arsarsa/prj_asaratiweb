const categories = { ebook: 'eBook', audiobook: 'audioBook', boxbook: 'boxBook', file: 'genericFiles' };
const versionIdIsValid = id => /^v[1-9]\d{0,8}$/.test(id || '');
function productBase(product, id) {
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(id) || !categories[product.type]) return null;
  return `${product.accessMode === 'free' ? 'public_file' : 'protected_file'}/${categories[product.type]}/${id}`;
}
function validStoragePath(product, id, legacy = false) {
  const base = productBase(product, id);
  if (!base || !product.storageFileName || /[\\/\r\n]/.test(product.storageFileName)) return false;
  if (product.storagePath === base || (legacy && product.storagePath === `${product.accessMode === 'free' ? 'public_file' : 'protected_file'}/${categories[product.type]}`)) return true;
  return product.type === 'ebook' && product.accessMode === 'paid' && product.versioningEnabled === true && versionIdIsValid(product.currentVersionId) && /^\d+$/.test(product.originalGeneration || '')
    && product.storagePath === `${base}/versions/${product.currentVersionId}/original`;
}
module.exports = { productBase, validStoragePath, versionIdIsValid };
