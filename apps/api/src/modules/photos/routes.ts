/**
 * Envoi et service des photos.
 *
 * Le corps est reçu en binaire brut (`application/octet-stream` n'est pas
 * utilisé : le type réel est dans `content-type`). Pas de multipart : une seule
 * photo par requête, déjà compressée par le client — un analyseur multipart
 * serait une dépendance et une surface d'attaque pour rien.
 */

import { Router, raw, type NextFunction, type Request, type Response } from 'express';

import { attacherPhotoCSD, attacherPhotoSDCR, lireFicheCSD } from '../../db/requetes/csd.js';
import { exigeAuthentification, exigeRole } from '../../middlewares/auth-jwt.js';
import { erreurIntrouvable, erreurRequete } from '../../middlewares/erreurs.js';
import { TAILLE_MAX_OCTETS, TYPES_ACCEPTES, deposer, lire, supprimer } from './depot.js';

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

const corpsBinaire = raw({
  type: [...TYPES_ACCEPTES],
  limit: TAILLE_MAX_OCTETS,
});

function typeAccepte(req: Request): string {
  const type = (req.header('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!TYPES_ACCEPTES.includes(type as (typeof TYPES_ACCEPTES)[number])) {
    throw erreurRequete(
      `Format non accepté : ${type || 'inconnu'}. La photo doit être compressée en WebP ou JPEG par l’application.`,
    );
  }
  return type;
}

function corpsNonVide(req: Request): Buffer {
  const contenu = req.body as unknown;
  if (!Buffer.isBuffer(contenu) || contenu.byteLength === 0) {
    throw erreurRequete('Photo vide ou illisible.');
  }
  return contenu;
}

export const routesPhotos = Router();

/**
 * GET /api/v1/photos/:nom
 *
 * Authentifié : les photos montrent l'intérieur des machines de l'usine, elles
 * ne sont pas publiques. Mise en cache longue côté client — le nom de fichier
 * est un UUID, une photo ne change jamais de contenu.
 */
routesPhotos.get(
  '/:nom',
  exigeAuthentification,
  asynchrone(async (req, res) => {
    const fichier = await lire(req.params['nom'] ?? '');
    if (!fichier) throw erreurIntrouvable('Photo introuvable.');

    res.setHeader('content-type', fichier.typeMime);
    res.setHeader('cache-control', 'private, max-age=31536000, immutable');
    res.status(200).send(fichier.contenu);
  }),
);

/**
 * POST /api/v1/photos/sdcr/:idSdcr — photo d'une fiche SDCR (A6, A10).
 * Le technicien envoie depuis sa file de photos, indépendante de celle du texte.
 */
routesPhotos.post(
  '/sdcr/:idSdcr',
  exigeAuthentification,
  corpsBinaire,
  asynchrone(async (req, res) => {
    const idSdcr = Number.parseInt(req.params['idSdcr'] ?? '', 10);
    if (!Number.isInteger(idSdcr) || idSdcr <= 0) throw erreurRequete('Identifiant de fiche invalide.');

    const type = typeAccepte(req);
    const contenu = corpsNonVide(req);

    const depot = await deposer(contenu, type);
    const attachee = await attacherPhotoSDCR(idSdcr, depot.chemin);

    if (!attachee) {
      // La fiche n'existe pas : on ne laisse pas un fichier orphelin derrière soi.
      await supprimer(depot.chemin);
      throw erreurIntrouvable('Cette fiche n’existe pas.');
    }

    res.status(201).json({ photo_url: depot.chemin, taille_octets: depot.taille_octets });
  }),
);

/**
 * POST /api/v1/photos/csd/:idEquipement — photo de référence d'une fiche CSD (B6).
 * L'ancienne photo est supprimée du dépôt : plus référencée par rien, la garder
 * n'apporterait aucune traçabilité.
 */
routesPhotos.post(
  '/csd/:idEquipement',
  exigeAuthentification,
  exigeRole('responsable'),
  corpsBinaire,
  asynchrone(async (req, res) => {
    const idEquipement = Number.parseInt(req.params['idEquipement'] ?? '', 10);
    if (!Number.isInteger(idEquipement) || idEquipement <= 0) {
      throw erreurRequete('Identifiant d’équipement invalide.');
    }

    const type = typeAccepte(req);
    const contenu = corpsNonVide(req);

    // La fiche doit exister : sa description est obligatoire et ne peut pas
    // être devinée depuis un envoi de photo. L'interface enregistre le texte
    // avant de proposer la photo.
    const fiche = await lireFicheCSD(idEquipement);
    if (!fiche) {
      throw erreurRequete('Enregistrez d’abord la description de la fiche CSD, puis ajoutez la photo.');
    }

    const depot = await deposer(contenu, type);
    await attacherPhotoCSD(idEquipement, depot.chemin);

    // L'ancienne photo n'est plus référencée par rien : la garder n'apporterait
    // aucune traçabilité, seulement du stockage occupé.
    if (fiche.photo_url) await supprimer(fiche.photo_url);

    res.status(201).json({ photo_url: depot.chemin, taille_octets: depot.taille_octets });
  }),
);
