// functions/downloadLinkGenerator.js

import * as functions from 'firebase-functions';
import { storage, db } from './firebaseAdmin.js';

export const generateDownloadLink = async (req, res) => {
  try {
    const { downloadToken, filename } = req.query;

    if (!downloadToken || !filename) {
      return res.status(400).json({ error: 'Parametri downloadToken e filename richiesti.' });
    }

    const tokenSnap = await db.collection('downloads').doc(downloadToken).get();

    if (!tokenSnap.exists) {
      functions.logger.warn('Token download non valido:', downloadToken);
      return res.status(403).json({ error: 'Token non valido' });
    }

    const tokenData = tokenSnap.data();

    if (tokenData.used) {
      functions.logger.warn('Token download già utilizzato:', downloadToken);
      return res.status(403).json({ error: 'Token già utilizzato' });
    }

    const file = storage.bucket().file(`protected_files/${filename}`);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minuti
    });

    await db.collection('downloads').doc(downloadToken).update({ used: true });

    functions.logger.info('Link download generato per token:', downloadToken);

    return res.json({ downloadUrl: url });
  } catch (error) {
    functions.logger.error('Errore generazione link download:', error);
    return res.status(500).json({ error: 'Errore nella generazione link download' });
  }
};
