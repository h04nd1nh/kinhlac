import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load config
dotenv.config({ path: path.join(__dirname, '../.env') });

const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '16359', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    synchronize: true, // This will create the new tables
    entities: [
        path.join(__dirname, '../src/models/*.ts')
    ],
});

async function migrate() {
    try {
        console.log('Connecting to database...');
        await AppDataSource.initialize();
        console.log('Connected.');

        const queryRunner = AppDataSource.createQueryRunner();
        
        // Let's manually check if the tables are there (synchronize:true should do it, but let's be safe)
        // Check for old data
        const oldData = await queryRunner.query('SELECT * FROM phac_do_dieu_tri');
        console.log(`Found ${oldData.length} old phac_do records.`);

        if (oldData.length === 0) {
            console.log('No data to migrate.');
            return;
        }

        // Group by disease ID
        const byBenh = {};
        oldData.forEach(row => {
            const benhId = row.id_benh;
            if (!byBenh[benhId]) byBenh[benhId] = [];
            byBenh[benhId].push(row);
        });

        for (const benhId of Object.keys(byBenh)) {
            console.log(`Migrating disease #${benhId}...`);
            
            // 1. Create root "the_benh" for this disease
            const [tb] = await queryRunner.query(
                `INSERT INTO the_benh (id_benh, ten_the_benh, mo_ta, thu_tu) 
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [benhId, 'Phương huyệt chung', 'Dữ liệu chuyển từ phác đồ cũ', 0]
            );
            const theBenhId = tb.id;

            // 2. Create phuong_huyet records
            for (let i = 0; i < byBenh[benhId].length; i++) {
                const row = byBenh[benhId][i];
                await queryRunner.query(
                    `INSERT INTO the_benh_phuong_huyet (id_the_benh, id_huyet, phuong_phap, vai_tro, ghi_chu, thu_tu) 
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [theBenhId, row.id_huyet, row.phuong_phap_tac_dong, row.vai_tro_huyet, row.ghi_chu_ky_thuat, i]
                );
            }
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await AppDataSource.destroy();
    }
}

migrate();
