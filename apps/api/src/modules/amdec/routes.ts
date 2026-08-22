/**
 * B4 — analyse AMDEC et suivi de l'IPR.
 *
 * L'IPR est une colonne calculée en base (`gravite * frequence * detection`) :
 * il ne peut pas diverger de ses facteurs. `calculerIPR()` du paquet partagé
 * sert ici à VALIDER les cotations avant écriture — un IPR faux fausserait tout
 * le classement de criticité du tableau de bord.
 */

import { COTATION_AMDEC_MAX, COTATION_AMDEC_MIN, calculerIPR } from '@maintxpert/shared';
import { z } from 'zod';
import { Router, type NextFunction, type Request, type Response } from 'express';

import {
  creerMode,
  listerModes,
  modeExiste,
  recoterMode,
  supprimerMode,
} from '../../db/requetes/amdec.js';
import { exigeAuthentification, exigeRole } from '../../middlewares/auth-jwt.js';
import { erreurConflit, erreurIntrouvable, erreurRequete } from '../../middlewares/erreurs.js';

const cotation = z
  .number()
  .int()
  .min(COTATION_AMDEC_MIN, `Cotation minimale : ${COTATION_AMDEC_MIN}.`)
  .max(COTATION_AMDEC_MAX, `Cotation maximale : ${COTATION_AMDEC_MAX}.`);

const libelle = z.string().trim().min(2, 'Libellé trop court.').max(150, 'Libellé trop long.');

const schemaCreerMode = z.object({
  id_equipement: z.number().int().positive(),
  composant: libelle,
  mode_defaillance: libelle,
  cause: libelle,
  effet: libelle,
  gravite: cotation,
  frequence: cotation,
  detection: cotation,
});

const schemaRecoter = z.object({
  gravite: cotation,
  frequence: cotation,
  detection: cotation,
});

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

function idMode(req: Request): number {
  const id = Number.parseInt(req.params['id'] ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) throw erreurRequete('Identifiant de mode invalide.');
  return id;
}

export const routesAmdec = Router();

routesAmdec.use(exigeAuthentification, exigeRole('responsable'));

/** GET /api/v1/amdec?id_equipement=&chaine= — les plus critiques en tête. */
routesAmdec.get(
  '/',
  asynchrone(async (req, res) => {
    const brutEquipement = req.query['id_equipement'];
    const brutChaine = req.query['chaine'];

    const idEquipement =
      brutEquipement === undefined ? undefined : Number.parseInt(String(brutEquipement), 10);
    if (idEquipement !== undefined && !Number.isInteger(idEquipement)) {
      throw erreurRequete('Paramètre « id_equipement » invalide.');
    }

    const modes = await listerModes(
      idEquipement,
      brutChaine === undefined ? undefined : String(brutChaine),
    );

    const critiques = modes.filter((m) => calculerIPR(m.gravite, m.frequence, m.detection).critique);

    res.status(200).json({
      modes,
      nb_total: modes.length,
      nb_critiques: critiques.length,
      ipr_maximal: modes[0]?.ipr ?? 0,
    });
  }),
);

/** POST /api/v1/amdec */
routesAmdec.post(
  '/',
  asynchrone(async (req, res) => {
    const analyse = schemaCreerMode.safeParse(req.body);
    if (!analyse.success) {
      throw erreurRequete(
        'Mode de défaillance invalide.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    const saisie = analyse.data;

    // Double garde : le schéma borne les cotations, `calculerIPR` lève si l'une
    // d'elles sort quand même des bornes. La règle partagée reste l'autorité.
    calculerIPR(saisie.gravite, saisie.frequence, saisie.detection);

    if (await modeExiste(saisie.id_equipement, saisie.composant, saisie.mode_defaillance)) {
      throw erreurConflit(
        `Le mode « ${saisie.mode_defaillance} » est déjà décrit pour le composant « ${saisie.composant} ».`,
      );
    }

    res.status(201).json(await creerMode(saisie));
  }),
);

/** PATCH /api/v1/amdec/:id — recotation. */
routesAmdec.patch(
  '/:id',
  asynchrone(async (req, res) => {
    const analyse = schemaRecoter.safeParse(req.body);
    if (!analyse.success) {
      throw erreurRequete(
        'Cotations invalides : chacune doit être un entier de 1 à 4.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    const { gravite, frequence, detection } = analyse.data;
    calculerIPR(gravite, frequence, detection);

    const mode = await recoterMode(idMode(req), gravite, frequence, detection);
    if (!mode) throw erreurIntrouvable('Ce mode de défaillance n’existe pas.');

    res.status(200).json(mode);
  }),
);

/** DELETE /api/v1/amdec/:id — voir le commentaire de `supprimerMode`. */
routesAmdec.delete(
  '/:id',
  asynchrone(async (req, res) => {
    if (!(await supprimerMode(idMode(req)))) {
      throw erreurIntrouvable('Ce mode de défaillance n’existe pas.');
    }
    res.status(204).send();
  }),
);
