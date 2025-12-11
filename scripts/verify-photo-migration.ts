#!/usr/bin/env tsx
/**
 * Verify database migration for user_photos table
 */

import mysql from 'mysql2/promise';
import 'dotenv/config';

async function verifyMigration() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  
  try {
    console.log('\n=== Checking user_photos table ===');
    const [columns] = await connection.query<any[]>('DESCRIBE user_photos');
    console.log('✅ user_photos table exists');
    console.log('Columns:', columns.map(c => c.Field).join(', '));
    
    console.log('\n=== Checking tryon_sessions for photo_id column ===');
    const [sessionCols] = await connection.query<any[]>('DESCRIBE tryon_sessions');
    const photoIdCol = sessionCols.find(c => c.Field === 'photo_id');
    const avatarIdCol = sessionCols.find(c => c.Field === 'avatar_id');
    
    if (photoIdCol) {
      console.log('✅ photo_id column exists');
      console.log('   Type:', photoIdCol.Type);
      console.log('   Null:', photoIdCol.Null);
    } else {
      console.log('❌ photo_id column NOT FOUND');
    }
    
    if (avatarIdCol) {
      console.log('✅ avatar_id column exists (should be nullable now)');
      console.log('   Null:', avatarIdCol.Null);
    }
    
    console.log('\n=== Checking foreign keys ===');
    const [fks] = await connection.query<any[]>(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_photos' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    
    if (fks.length > 0) {
      console.log('✅ Foreign keys on user_photos:');
      fks.forEach(fk => {
        console.log(`   ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    } else {
      console.log('⚠️  No foreign keys found on user_photos');
    }
    
    console.log('\n=== Checking indexes ===');
    const [indexes] = await connection.query<any[]>(`
      SHOW INDEX FROM user_photos
    `);
    console.log('✅ Indexes on user_photos:');
    const uniqueIndexes = [...new Set(indexes.map(i => i.Key_name))];
    uniqueIndexes.forEach(idx => {
      const cols = indexes.filter(i => i.Key_name === idx).map(i => i.Column_name);
      console.log(`   ${idx}: ${cols.join(', ')}`);
    });
    
    console.log('\n✅ Migration verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

verifyMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
