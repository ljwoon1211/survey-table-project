import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.');
}

const sql = postgres(connectionString);

async function addPlaceholderColumn() {
  try {
    console.log('Adding placeholder column to questions table...');

    await sql`
      ALTER TABLE "questions" 
      ADD COLUMN IF NOT EXISTS "placeholder" text;
    `;

    console.log('✅ Placeholder column added successfully!');
  } catch (error) {
    console.error('❌ Error adding column:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

addPlaceholderColumn();


