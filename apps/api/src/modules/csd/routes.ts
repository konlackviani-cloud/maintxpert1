/**
 * B6 — création et mise à jour des fiches CSD.
 *
 * La consultation (A7) ne passe PAS par ici : les fiches CSD descendent dans
 * l'instantané de synchronisation et le technicien les lit depuis son cache,
 * y compris sans réseau. Ces routes ne servent qu'à l'écriture du responsable.
 */

import { z } from 'zod';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { enregistrerFicheCSD, lireFicheCSD } from '../../db/requetes/csd.js';
import { exigeAuthentification, exigeRole } from '../../middlewares/auth-jwt.js';
import { erreurIntrouvable, erreurRequete } from '../../middlewares/erreurs.js';

const schemaFicheCSD = z.object({
  description: z
    .string()
    .trim()
    .min(10, 'Décrivez l’état de référence attendu (10 caractères minimum).')
    .max(4000, 'Description trop longue.'),
});

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

function idEquipement(req: Request): number {
  const id = Number.parseInt(req.params['idEquipement'] ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) throw erreurRequete('Identifiant d’équipement invalide.');
  return id;
}

export const routesCSD = Router();

routesCSD.use(exigeAuthentification);

/** GET /api/v1/csd/:idEquipement — lecture directe, pour l'écran d'édition du responsable. */
routesCSD.get(
  '/:idEquipement',
  asynchrone(async (req, res) => {
    const fiche = await lireFicheCSD(idEquipement(req));
    if (!fiche) throw erreurIntrouvable('Aucune fiche CSD pour cet équipement.');
    res.status(200).json(fiche);
  }),
);

/** PUT /api/v1/csd/:idEquipement — création ou mise à jour (B6). */
routesCSD.put(
  '/:idEquipement',
  exigeRole('responsable'),
  asynchrone(async (req, res) => {
    const analyse = schemaFicheCSD.safeParse(req.body);
    if (!analyse.success) {
      throw erreurRequete(
        'Fiche CSD invalide.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    // `photo_url` à null : l'écriture du texte ne doit jamais effacer la photo
    // de référence existante (voir `enregistrerFicheCSD`).
    const fiche = await enregistrerFicheCSD(idEquipement(req), analyse.data.description, null);
    res.status(200).json(fiche);
  }),
);
