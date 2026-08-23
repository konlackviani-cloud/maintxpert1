/**
 * Applique les migrations SQL dans l'ordre, contre la base désignée par
 * DATABASE_URL.
 *
 * Écrit ici plutôt que de compter sur la CLI Supabase : celle-ci exige Docker
 * pour la stack locale, et le poste de développement n'en dispose pas. Ce
 * script fonctionne contre n'importe quelle instance PostgreSQL joignable,
 * locale ou distante.
 *
 *   npm run migrer            applique ce qui manque
 *   npm run migrer -- --etat  liste sans rien appliquer
 *
 * Chaque migration est jouée DANS UNE TRANSACTION et inscrite dans
 * `schema_migrations`. Une migration qui échoue est intégralement annulée : on
 * ne laisse jamais la base à moitié migrée.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DOSSIER = join(RACINE, 'supabase', 'migrations');
const SEED = join(RACINE, 'supabase', 'seed.sql');

const etatSeulement = process.argv.includes('--etat');
const avecSeed = process.argv.includes('--seed');

if (!process.env.DATABASE_URL) {
  console.error(
    '\n  ✖ DATABASE_URL absent.\n' +
      '    Renseignez-le dans apps/api/.env — voir apps/api/.env.example.\n',
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  // Supabase impose TLS ; le certificat est signé par une autorité que Node ne
  // connaît pas d'office, d'où la tolérance. Acceptable pour un prototype,
  // à durcir avec le certificat racine pour une mise en service.
  ssl: process.env.DATABASE_URL.includes('supabase.') ? { rejectUnauthorized: false } : undefined,
});

async function principal() {
  await client.connect();

  await client.query(`
    create table if not exists schema_migrations (
      version     varchar(255) primary key,
      applique_le timestamptz not null default now()
    )`);

  const { rows } = await client.query('select version from schema_migrations');
  const dejaAppliquees = new Set(rows.map((r) => r.version));

  const fichiers = readdirSync(DOSSIER)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const aFaire = fichiers.filter((f) => !dejaAppliquees.has(f));

  console.log(`\n  Base   : ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':••••@')}`);
  console.log(`  Trouvé : ${fichiers.length} migration(s), ${dejaAppliquees.size} déjà appliquée(s)\n`);

  if (etatSeulement) {
    for (const f of fichiers) {
      console.log(`  ${dejaAppliquees.has(f) ? '✔' : '·'} ${f}`);
    }
    console.log('');
    return;
  }

  if (aFaire.length === 0) {
    console.log('  La base est à jour.\n');
  }

  for (const fichier of aFaire) {
    const sql = readFileSync(join(DOSSIER, fichier), 'utf8');
    process.stdout.write(`  … ${fichier}`);

    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (version) values ($1)', [fichier]);
      await client.query('commit');
      process.stdout.write(`\r  ✔ ${fichier}\n`);
    } catch (erreur) {
      await client.query('rollback');
      process.stdout.write(`\r  ✖ ${fichier}\n`);
      console.error(`\n    ${erreur.message}\n`);
      console.error('    Migration annulée. La base est restée dans son état précédent.\n');
      process.exitCode = 1;
      return;
    }
  }

  if (avecSeed) {
    process.stdout.write('  … seed.sql');
    try {
      await client.query(readFileSync(SEED, 'utf8'));
      process.stdout.write('\r  ✔ seed.sql\n');
    } catch (erreur) {
      process.stdout.write('\r  ✖ seed.sql\n');
      console.error(`\n    ${erreur.message}\n`);
      process.exitCode = 1;
      return;
    }
  }

  console.log('\n  Terminé.\n');
}

principal()
  .catch((erreur) => {
    console.error(`\n  ✖ ${erreur.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.end());
