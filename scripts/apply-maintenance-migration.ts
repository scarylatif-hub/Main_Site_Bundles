import { createAdminClient } from "../src/lib/supabase/admin";
import { readFileSync } from "fs";
import { join } from "path";

async function applyMigration() {
  const admin = createAdminClient();

  const migrationPath = join(__dirname, "../src/lib/database/migrations/006_maintenance_mode.sql");
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  try {
    console.log("Applying maintenance_mode table migration...");
    
    // Execute the migration SQL
    const { error } = await admin.rpc("exec_sql", { sql: migrationSQL });
    
    if (error) {
      // If RPC doesn't work, we'll need to use direct SQL execution
      console.error("RPC failed, trying direct SQL execution...");
      console.error("Please run this SQL manually in Supabase SQL Editor:");
      console.log(migrationSQL);
    } else {
      console.log("Migration applied successfully!");
    }
  } catch (err) {
    console.error("Error applying migration:", err);
    console.log("\nPlease run this SQL manually in Supabase SQL Editor:");
    console.log(migrationSQL);
  }
}

applyMigration();
