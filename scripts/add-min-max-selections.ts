import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.');
}

const sql = postgres(connectionString);

async function addColumns() {
  try {
    console.log('Adding min_selections and max_selections columns...');

    await sql`
      ALTER TABLE "questions" 
      ADD COLUMN IF NOT EXISTS "min_selections" integer;
    `;

    await sql`
      ALTER TABLE "questions" 
      ADD COLUMN IF NOT EXISTS "max_selections" integer;
    `;

    console.log('✅ Columns added successfully!');
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

addColumns();

