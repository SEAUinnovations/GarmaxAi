import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { logger } from '../src/utils/winston-logger';

async function migrateProfileFields() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'garmax_ai',
  });

  try {
    logger.info('Starting profile fields migration...', 'Migration');
    
    // Check if columns already exist to avoid duplicate column errors
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [process.env.DB_NAME || 'garmax_ai']);
    
    const existingColumns = (columns as any[]).map((row: any) => row.COLUMN_NAME);
    
    // Add new columns to users table if they don't exist
    const columnsToAdd = [
      { name: 'height_feet', definition: 'INT' },
      { name: 'height_inches', definition: 'INT' },
      { name: 'height_centimeters', definition: 'INT' },
      { name: 'age_range', definition: "VARCHAR(20)" },
      { name: 'gender', definition: "VARCHAR(20)" },
      { name: 'body_type', definition: "VARCHAR(20)" },
      { name: 'ethnicity', definition: 'TEXT' },
      { name: 'profile_completed', definition: 'BOOLEAN DEFAULT FALSE' },
      { name: 'profile_completed_at', definition: 'TIMESTAMP NULL' },
      { name: 'style_preferences', definition: 'JSON' },
      { name: 'measurement_system', definition: "VARCHAR(10) DEFAULT 'imperial'" }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        await connection.execute(`
          ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}
        `);
        logger.info(`Added column ${column.name} to users table`, 'Migration');
      } else {
        logger.info(`Column ${column.name} already exists, skipping`, 'Migration');
      }
    }
    
    // Create indexes for better query performance
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed)',
      'CREATE INDEX IF NOT EXISTS idx_users_age_range ON users(age_range)',
      'CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender)',
      'CREATE INDEX IF NOT EXISTS idx_users_body_type ON users(body_type)',
      'CREATE INDEX IF NOT EXISTS idx_users_measurement_system ON users(measurement_system)'
    ];
    
    for (const indexQuery of indexQueries) {
      try {
        await connection.execute(indexQuery);
        logger.info(`Created index: ${indexQuery.split(' ON ')[0].split(' ')[-1]}`, 'Migration');
      } catch (error) {
        // Index might already exist, log warning but continue
        logger.warn(`Index creation skipped (might exist): ${error}`, 'Migration');
      }
    }
    
    // Create profile analytics table for tracking completion metrics
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS profile_analytics (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        user_id VARCHAR(36) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        event_data JSON,
        ab_variant VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_profile_analytics_user_id (user_id),
        INDEX idx_profile_analytics_event_type (event_type),
        INDEX idx_profile_analytics_ab_variant (ab_variant),
        INDEX idx_profile_analytics_created_at (created_at)
      )
    `);
    logger.info('Created profile_analytics table', 'Migration');
    
    // Create profile completion cache table for quick lookups
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS profile_completion_stats (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        date DATE NOT NULL UNIQUE,
        total_users INT DEFAULT 0,
        completed_profiles INT DEFAULT 0,
        completion_rate DECIMAL(5,2) DEFAULT 0.00,
        avg_completion_time_hours DECIMAL(6,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_profile_stats_date (date)
      )
    `);
    logger.info('Created profile_completion_stats table', 'Migration');
    
    logger.info('Profile fields migration completed successfully', 'Migration');
    
    // Run initial data population
    await populateInitialAnalytics(connection);
    
  } catch (error) {
    logger.error(`Migration failed: ${error}`, 'Migration');
    throw error;
  } finally {
    await connection.end();
  }
}

async function populateInitialAnalytics(connection: mysql.Connection) {
  try {
    logger.info('Populating initial analytics data...', 'Migration');
    
    // Get current stats
    const [userCount] = await connection.execute(
      'SELECT COUNT(*) as total FROM users'
    );
    const totalUsers = (userCount as any[])[0].total;
    
    const [completedCount] = await connection.execute(
      'SELECT COUNT(*) as completed FROM users WHERE profile_completed = TRUE'
    );
    const completedProfiles = (completedCount as any[])[0].completed;
    
    const completionRate = totalUsers > 0 ? (completedProfiles / totalUsers) * 100 : 0;
    
    // Insert today's stats
    await connection.execute(`
      INSERT INTO profile_completion_stats (date, total_users, completed_profiles, completion_rate)
      VALUES (CURDATE(), ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_users = VALUES(total_users),
        completed_profiles = VALUES(completed_profiles),
        completion_rate = VALUES(completion_rate),
        updated_at = CURRENT_TIMESTAMP
    `, [totalUsers, completedProfiles, completionRate]);
    
    logger.info(`Initial analytics populated: ${completedProfiles}/${totalUsers} profiles completed (${completionRate.toFixed(1)}%)`, 'Migration');
    
  } catch (error) {
    logger.warn(`Initial analytics population failed: ${error}`, 'Migration');
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateProfileFields().catch(console.error);
}

export { migrateProfileFields };