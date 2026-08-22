/**
 * Tests du socle d'authentification — hachage et jetons.
 * Ne touchent pas la base : ce sont les briques cryptographiques qui doivent
 * être justes, indépendamment de PostgreSQL.
 */

import { beforeAll, describe, expect, it } from 'vitest';

// L'environnement doit exister avant l'import des modules qui lisent env.
process.env['DATABASE_URL'] ??= 'postgresql://test:test@127.0.0.1:5432/test';
process.env['JWT_SECRET'] ??= 'secret-de-test-suffisamment-long-pour-passer-la-validation';

const { hacherMotDePasse, verifierMotDePasse } = await import('./mots-de-passe.js');
const { emettreJetonAcces, emettreJetonRafraichissement, verifierJeton, ErreurJeton } =
  await import('./jetons.js');

const SUJET = { id_utilisateur: 42, matricule: 'TC-2841', role: 'technicien' } as const;

describe('hachage argon2id', () => {
  let empreinte: string;

  beforeAll(async () => {
    empreinte = await hacherMotDePasse('MotDePasseTerrain2026');
  });

  it('ne stocke jamais le mot de passe en clair', () => {
    expect(empreinte).not.toContain('MotDePasseTerrain2026');
    expect(empreinte.startsWith('$argon2id$')).toBe(true);
  });

  it('accepte le bon mot de passe', async () => {
    expect(await verifierMotDePasse(empreinte, 'MotDePasseTerrain2026')).toBe(true);
  });

  it('refuse un mot de passe faux, y compris à une casse près', async () => {
    expect(await verifierMotDePasse(empreinte, 'motdepasseterrain2026')).toBe(false);
    expect(await verifierMotDePasse(empreinte, '')).toBe(false);
  });

  it('produit une empreinte différente à chaque appel — le sel est aléatoire', async () => {
    const autre = await hacherMotDePasse('MotDePasseTerrain2026');
    expect(autre).not.toBe(empreinte);
    expect(await verifierMotDePasse(autre, 'MotDePasseTerrain2026')).toBe(true);
  });

  it('renvoie faux plutôt que de lever sur une empreinte corrompue', async () => {
    expect(await verifierMotDePasse('pas-une-empreinte', 'peu importe')).toBe(false);
  });
});

describe('jetons JWT', () => {
  it('émet un jeton d’accès vérifiable qui porte le sujet', async () => {
    const { jeton } = await emettreJetonAcces(SUJET);
    const charge = await verifierJeton(jeton, 'acces');

    expect(charge.sub).toBe(42);
    expect(charge.matricule).toBe('TC-2841');
    expect(charge.role).toBe('technicien');
    expect(charge.type).toBe('acces');
  });

  it('refuse un jeton de rafraîchissement présenté comme jeton d’accès', async () => {
    const { jeton } = await emettreJetonRafraichissement(SUJET);
    await expect(verifierJeton(jeton, 'acces')).rejects.toBeInstanceOf(ErreurJeton);
  });

  it('refuse un jeton d’accès présenté comme jeton de rafraîchissement', async () => {
    const { jeton } = await emettreJetonAcces(SUJET);
    await expect(verifierJeton(jeton, 'rafraichissement')).rejects.toBeInstanceOf(ErreurJeton);
  });

  it('refuse un jeton dont la signature a été altérée', async () => {
    const { jeton } = await emettreJetonAcces(SUJET);
    const [entete, charge] = jeton.split('.');
    const falsifie = `${entete}.${charge}.signatureBidon`;

    await expect(verifierJeton(falsifie, 'acces')).rejects.toBeInstanceOf(ErreurJeton);
  });

  it('refuse une chaîne qui n’est pas un jeton', async () => {
    await expect(verifierJeton('n-importe-quoi', 'acces')).rejects.toBeInstanceOf(ErreurJeton);
    await expect(verifierJeton('', 'acces')).rejects.toBeInstanceOf(ErreurJeton);
  });

  it('ne divulgue jamais le détail cryptographique dans le message', async () => {
    await expect(verifierJeton('n-importe-quoi', 'acces')).rejects.toThrow(/Reconnectez-vous/);
  });

  it('donne au jeton de rafraîchissement une durée plus longue qu’au jeton d’accès', async () => {
    const acces = await emettreJetonAcces(SUJET);
    const rafraichissement = await emettreJetonRafraichissement(SUJET);

    expect(new Date(rafraichissement.expire_le).getTime()).toBeGreaterThan(
      new Date(acces.expire_le).getTime(),
    );
  });
});
