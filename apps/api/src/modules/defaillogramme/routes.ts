/**
 * B8 / UC3 — construction et consultation des défaillogrammes.
 *
 * Règle cardinale du cahier des charges : l'ouverture est TOUJOURS une décision
 * manuelle du responsable. Aucune route de ce module n'est appelée par un
 * déclencheur automatique ; il n'existe pas de « créer si récurrent ». La
 * suggestion s'affiche au tableau de bord, la création se fait ici, sur clic.
 */

import {
  branchesDistinctes,
  schemaDefaillogramme,
  type Defaillogramme,
} from '@maintxpert/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';

import { requete } from '../../db/client.js';
import { exigeAuthentification, exigeRole } from '../../middlewares/auth-jwt.js';
import { erreurConflit, erreurIntrouvable, erreurRequete } from '../../middlewares/erreurs.js';

const COLONNES = `id_defaillogramme, id_equipement, id_sdcr, id_responsable,
                  branche1_objet, branche1_defaut, branche2_objet, branche2_defaut,
                  symptome_convergence, cause_intermediaire, cause_premiere, date_creation`;

function asynchrone(
  gestionnaire: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    gestionnaire(req, res).catch(next);
  };
}

export const routesDefaillogramme = Router();

routesDefaillogramme.use(exigeAuthentification);

/** GET /api/v1/defaillogrammes — consultation, ouverte aux deux rôles. */
routesDefaillogramme.get(
  '/',
  asynchrone(async (_req, res) => {
    const defaillogrammes = await requete<Defaillogramme>(
      `select ${COLONNES} from defaillogramme order by date_creation desc`,
    );
    res.status(200).json({ defaillogrammes });
  }),
);

/**
 * POST /api/v1/defaillogrammes — construction (B8).
 *
 * Le symptôme de convergence et l'équipement ne sont pas fournis par le client :
 * ils sont lus sur la fiche SDCR. Les laisser saisir permettrait de créer un
 * défaillogramme qui ne correspond pas à la récurrence qu'il prétend analyser.
 */
routesDefaillogramme.post(
  '/',
  exigeRole('responsable'),
  asynchrone(async (req, res) => {
    const analyse = schemaDefaillogramme.safeParse(req.body);
    if (!analyse.success) {
      throw erreurRequete(
        'Défaillogramme incomplet.',
        analyse.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
      );
    }

    const saisie = analyse.data;

    if (!branchesDistinctes(saisie)) {
      throw erreurRequete(
        'Les deux branches contributives sont identiques. Un défaillogramme montre la rencontre de deux causes indépendantes — sans quoi il n’y a rien à faire converger.',
      );
    }

    const fiches = await requete<{ id_equipement: number; symptome: string; statut: string }>(
      'select id_equipement, symptome, statut from entree_sdcr where id_sdcr = $1',
      [saisie.id_sdcr],
    );
    const fiche = fiches[0];
    if (!fiche) throw erreurIntrouvable('Cette fiche SDCR n’existe pas.');
    if (fiche.statut !== 'validee') {
      throw erreurRequete(
        'Seule une fiche validée peut faire l’objet d’un défaillogramme : une contribution non relue ne constitue pas une récurrence établie.',
      );
    }

    const existants = await requete<{ id_defaillogramme: number }>(
      'select id_defaillogramme from defaillogramme where id_sdcr = $1',
      [saisie.id_sdcr],
    );
    if (existants.length > 0) {
      throw erreurConflit(
        'Un défaillogramme existe déjà pour cette récurrence. Deux analyses de la même panne produiraient deux vérités concurrentes.',
      );
    }

    const lignes = await requete<Defaillogramme>(
      `insert into defaillogramme (
         id_equipement, id_sdcr, id_responsable,
         branche1_objet, branche1_defaut, branche2_objet, branche2_defaut,
         symptome_convergence, cause_intermediaire, cause_premiere)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning ${COLONNES}`,
      [
        fiche.id_equipement,
        saisie.id_sdcr,
        req.utilisateur!.id_utilisateur,
        saisie.branche1_objet,
        saisie.branche1_defaut,
        saisie.branche2_objet,
        saisie.branche2_defaut,
        // Figé au moment de l'analyse : un renommage ultérieur du terme (B2) ne
        // doit pas réécrire ce qui a été analysé.
        fiche.symptome,
        saisie.cause_intermediaire,
        saisie.cause_premiere,
      ],
    );

    res.status(201).json(lignes[0]);
  }),
);

/** PATCH /api/v1/defaillogrammes/:id — révision de l'analyse. */
routesDefaillogramme.patch(
  '/:id',
  exigeRole('responsable'),
  asynchrone(async (req, res) => {
    const id = Number.parseInt(req.params['id'] ?? '', 10);
    if (!Number.isInteger(id) || id <= 0) throw erreurRequete('Identifiant invalide.');

    const analyse = schemaDefaillogramme.safeParse(req.body);
    if (!analyse.success) throw erreurRequete('Défaillogramme incomplet.');
    if (!branchesDistinctes(analyse.data)) {
      throw erreurRequete('Les deux branches contributives sont identiques.');
    }

    const saisie = analyse.data;
    const lignes = await requete<Defaillogramme>(
      `update defaillogramme
          set branche1_objet = $1, branche1_defaut = $2,
              branche2_objet = $3, branche2_defaut = $4,
              cause_intermediaire = $5, cause_premiere = $6
        where id_defaillogramme = $7
        returning ${COLONNES}`,
      [
        saisie.branche1_objet,
        saisie.branche1_defaut,
        saisie.branche2_objet,
        saisie.branche2_defaut,
        saisie.cause_intermediaire,
        saisie.cause_premiere,
        id,
      ],
    );

    if (lignes.length === 0) throw erreurIntrouvable('Ce défaillogramme n’existe pas.');
    res.status(200).json(lignes[0]);
  }),
);
