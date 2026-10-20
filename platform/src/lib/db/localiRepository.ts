import type {
  LocalApprovedEvent,
  LocalRegistryEntry,
} from "@/lib/engine/localiTypes";
import { getSql, isDatabaseConfigured } from "./neon";

export interface LocaliDbState {
  registry: LocalRegistryEntry[];
  events: LocalApprovedEvent[];
  updatedAt: string | null;
}

export async function loadLocaliFromDb(): Promise<LocaliDbState | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT registry, events, updated_at
      FROM fn_locali_state
      WHERE id = 'default'
      LIMIT 1
    `;
    const row = rows[0] as
      | {
          registry: LocalRegistryEntry[];
          events: LocalApprovedEvent[];
          updated_at: Date | string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      registry: Array.isArray(row.registry) ? row.registry : [],
      events: Array.isArray(row.events) ? row.events : [],
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    };
  } catch {
    return null;
  }
}

export async function saveLocaliToDb(
  registry: LocalRegistryEntry[],
  events: LocalApprovedEvent[] = [],
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  try {
    const sql = getSql();
    await sql`
      INSERT INTO fn_locali_state (id, registry, events, updated_at)
      VALUES (
        'default',
        ${JSON.stringify(registry)}::jsonb,
        ${JSON.stringify(events)}::jsonb,
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        registry = EXCLUDED.registry,
        events = EXCLUDED.events,
        updated_at = now()
    `;
    return true;
  } catch {
    return false;
  }
}
