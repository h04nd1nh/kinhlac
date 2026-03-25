const { Client } = require('pg');
require('dotenv').config({ path: './.env' });

async function migrate() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '16359', 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false },
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected.');

        // 1. Check current diseases
        const diseasesRes = await client.query('SELECT id, tieuket, phuyet_chamcuu FROM benh_dong_y');
        const diseases = diseasesRes.rows;
        console.log(`Found ${diseases.length} diseases.`);

        for (const d of diseases) {
            const benhId = d.id;
            const oldValue = d.phuyet_chamcuu || '';

            // Skip if already has multi-level data
            const check = await client.query('SELECT id FROM the_benh WHERE id_benh = $1 LIMIT 1', [benhId]);
            if (check.rows.length > 0) continue;

            if (oldValue.trim()) {
                console.log(`Migrating disease #${benhId} (${d.tieuket})...`);
                
                // Create one root pattern
                const tbRes = await client.query(
                    `INSERT INTO the_benh (id_benh, ten_the_benh, mo_ta) 
                     VALUES ($1, $2, $3) RETURNING id`,
                    [benhId, 'Phương huyệt (Dữ liệu cũ)', 'Dữ liệu chuyển từ cột phuyet_chamcuu']
                );
                const theBenhId = tbRes.rows[0].id;

                // Insert the old text as a single "note" point (id_huyet = null)
                await client.query(
                    `INSERT INTO the_benh_phuong_huyet (id_the_benh, ghi_chu) 
                     VALUES ($1, $2)`,
                    [theBenhId, oldValue]
                );
            }
        }

        console.log('Migration from benh_dong_y.phuyet_chamcuu completed.');
    } catch (err) {
        console.error('Migration failed:', err.stack);
    } finally {
        await client.end();
    }
}

migrate();
