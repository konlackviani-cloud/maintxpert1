/**
 * B7 — import manuel initial des données DimoMaint.
 *
 * L'API reçoit des lignes DÉJÀ analysées : le fichier est lu et rattaché dans
 * le navigateur, ce qui permet au responsable de voir l'aperçu et de corriger
 * le rattachement des colonnes avant que quoi que ce soit n'atteigne la base.
 * Un import mal rattaché créerait des centaines d'équipements erronés.
 *
 * L'insertion est idempotente : `on conflict (chaine, nom) do nothing`. Rejouer
 * le même fichier ne crée pas de doublons — un import initial se relance
 * souvent après correction.
 */

import { z } from 'zod';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { requete } from '../../db/client.js';
import { exigeAuthentification, exigeRole } from '../../middlewares/auth-jwt.js';
import { erreurRequete } from '../../middlewares/erreurs.js';

const schemaImport = z.object({
  equipements: z
    .array(
      z.object({
        nom: z.string().trim().min(1).max(100),
        famille: z.string().trim().min(1).max(100),
        chaine: z.string().trim().min(1).max(20),
      }),
    )
    .min(1, 'Aucun équipement à importer.')
    .max(2000, 'Import limité à 2000 équipements par envoi.'),
});

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

export const routesImport = Router();

routesImport.use(exigeAuthentification, exigeRole('responsable'));

/** POST /api/v1/import/equipements */
routesImport.post(
  '/equipements',
  asynchrone(async (req, res) => {
    const analyse = schemaImport.safeParse(req.body);
    if (!analyse.success) {
      throw erreurRequete(
        'Import invalide.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    const { equipements } = analyse.data;

    // Insertion ligne à ligne plutôt qu'en une requête à 2000 valeurs : le
    // décompte exact des créations doit être rendu au responsable, et une
    // ligne fautive ne doit pas faire échouer l'import entier.
    let crees = 0;
    let existants = 0;

    for (const equipement of equipements) {
      const lignes = await requete<{ id_equipement: number }>(
        `insert into equipement (nom, famille, chaine)
         values ($1, $2, $3)
         on conflict (chaine, nom) do nothing
         returning id_equipement`,
        [equipement.nom, equipement.famille, equipement.chaine],
      );

      if (lignes.length > 0) crees += 1;
      else existants += 1;
    }

    res.status(200).json({
      crees,
      existants,
      total: equipements.length,
    });
  }),
);
