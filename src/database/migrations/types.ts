import type { DatabaseAdapter } from '../schema';
import type { ReconcileResult } from '../schemaControl';

export interface DatabaseMigration {
  version: number;
  name: string;
  apply(database: DatabaseAdapter): Promise<ReconcileResult>;
}

