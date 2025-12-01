import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  const host = process.env.RDS_HOST;
  const port = process.env.RDS_PORT || '3306';
  const database = process.env.RDS_DATABASE;
  const username = process.env.RDS_USERNAME;
  const password = process.env.RDS_PASSWORD;

  if (!host || !database || !username || !password) {
    console.error('Missing RDS configuration. Please check your environment variables:');
    console.error('- RDS_HOST');
    console.error('- RDS_DATABASE');
    console.error('- RDS_USERNAME');
    console.error('- RDS_PASSWORD');
    console.error('- RDS_PORT (optional, defaults to 3306)');
    process.exit(1);
  }

  const connectionString = `mysql://${username}:${password}@${host}:${port}/${database}`;
  
  console.log(`Connecting to RDS Aurora MySQL...`);
  console.log(`Host: ${host}`);
  console.log(`Database: ${database}`);
  
  try {
    const connection = await mysql.createConnection(connectionString);
    const db = drizzle(connection);

    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('✅ Migrations completed successfully!');
    
    await connection.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };