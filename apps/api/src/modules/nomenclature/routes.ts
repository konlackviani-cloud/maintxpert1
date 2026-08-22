/** B2 — gestion de la nomenclature. Réservée au responsable maintenance. */

import {
  schemaCreerTerme,
  schemaFusionnerTermes,
  schemaRenommerTerme,
} from '@maintxpert/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import {
  archiverTerme,
  creerTerme,
  fusionnerTermes,
  lireTerme,
  listerTermesGeres,
  renommerTerme,
  termeExiste,
} from '../../db/requetes/nomenclature.js';
import { exigeAuthentification, exigeRole } from '../../middlewares/auth-jwt.js';
import { erreurConflit, erreurIntrouvable, erreurRequete } from '../../middlewares/erreurs.js';

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

function idTerme(req: Request): number {
  const id = Number.parseInt(req.params['id'] ?? '', 10);
  if (!Number.isInteger(id) || id <= 0) throw erreurRequete('Identifiant de terme invalide.');
  return id;
}

export const routesNomenclature = Router();

routesNomenclature.use(exigeAuthentification, exigeRole('responsable'));

/** GET /api/v1/nomenclature?id_equipement=… — tous statuts, avec le nombre de fiches. */
routesNomenclature.get(
  '/',
  asynchrone(async (req, res) => {
    const idEquipement = Number.parseInt(String(req.query['id_equipement'] ?? ''), 10);
    if (!Number.isInteger(idEquipement) || idEquipement <= 0) {
      throw erreurRequete('Paramètre « id_equipement » requis.');
    }

    res.status(200).json({ termes: await listerTermesGeres(idEquipement) });
  }),
);

/** POST /api/v1/nomenclature — ajout d'un terme. */
routesNomenclature.post(
  '/',
  asynchrone(async (req, res) => {
    const analyse = schemaCreerTerme.safeParse(req.body);
    if (!analyse.success) {
      throw erreurRequete(
        'Terme invalide.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    const { libelle, type, id_equipement, categorie_afnor } = analyse.data;

    if (await termeExiste(id_equipement, type, libelle)) {
      throw erreurConflit(`Le terme « ${libelle} » existe déjà pour cet équipement.`);
    }

    res.status(201).json(await creerTerme(libelle, type, id_equipement, categorie_afnor ?? null));
  }),
);

/**
 * PATCH /api/v1/nomenclature/:id — renommage.
 * Répercuté sur les fiches qui référencent le terme, faute de quoi FP1, qui
 * compare des libellés, cesserait de les apparier.
 */
routesNomenclature.patch(
  '/:id',
  asynchrone(async (req, res) => {
    const id = idTerme(req);
    const analyse = schemaRenommerTerme.safeParse(req.body);
    if (!analyse.success) throw erreurRequete('Libellé invalide.');

    const terme = await lireTerme(id);
    if (!terme) throw erreurIntrouvable('Ce terme n’existe pas.');

    if (
      terme.libelle !== analyse.data.libelle &&
      (await termeExiste(terme.id_equipement, terme.type, analyse.data.libelle))
    ) {
      throw erreurConflit(`Le terme « ${analyse.data.libelle} » existe déjà pour cet équipement.`);
    }

    await renommerTerme(id, analyse.data.libelle);
    res.status(204).send();
  }),
);

/** POST /api/v1/nomenclature/:id/archiver — jamais de suppression physique. */
routesNomenclature.post(
  '/:id/archiver',
  asynchrone(async (req, res) => {
    const id = idTerme(req);
    if (!(await lireTerme(id))) throw erreurIntrouvable('Ce terme n’existe pas.');

    await archiverTerme(id);
    res.status(204).send();
  }),
);

/** POST /api/v1/nomenclature/:id/fusionner — le terme est absorbé par la cible. */
routesNomenclature.post(
  '/:id/fusionner',
  asynchrone(async (req, res) => {
    const analyse = schemaFusionnerTermes.safeParse(req.body);
    if (!analyse.success) throw erreurRequete('Terme cible invalide.');

    const applique = await fusionnerTermes(idTerme(req), analyse.data.id_terme_cible);
    if (!applique) {
      throw erreurRequete(
        'Fusion impossible : les deux termes doivent appartenir au même équipement et au même niveau SDCR.',
      );
    }

    res.status(204).send();
  }),
);
