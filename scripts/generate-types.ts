import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
async function main() {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;`,
  );
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  const { rows } = await db.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
  );
  const tables = new Map<string, string[]>();
  for (const r of rows) {
    const type =
      r.data_type === 'boolean'
        ? 'boolean'
        : r.data_type.includes('int') || r.data_type === 'numeric'
          ? 'number'
          : r.data_type === 'jsonb'
            ? 'Json'
            : 'string';
    const fields = tables.get(r.table_name) ?? [];
    fields.push(`    ${r.column_name}: ${type}${r.is_nullable === 'YES' ? ' | null' : ''};`);
    tables.set(r.table_name, fields);
  }
  const body = [
    '// Generated from the migration with npm run types:db. Do not edit by hand.',
    "import type { Json } from './database.types';",
    'type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };',
    'export type Tables = {',
  ];
  for (const [name, fields] of tables) body.push(`  ${name}: Table<{`, ...fields, '  }>;');
  body.push('}');
  writeFileSync('src/data/tables.generated.ts', body.join('\n') + '\n');
  await db.close();
  console.log(`Generated matching row types for ${tables.size} RLS tables.`);
}
void main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
