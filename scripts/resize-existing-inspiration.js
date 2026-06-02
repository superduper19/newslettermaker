const { Client } = require('basic-ftp');
const sharp = require('sharp');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function run() {
    const client = new Client();
    try {
        await client.access({
            host: process.env.GODADDY_FTP_HOST,
            user: process.env.GODADDY_FTP_USER,
            password: process.env.GODADDY_FTP_PASS,
            port: 21,
            secure: true,
            secureOptions: { rejectUnauthorized: false }
        });
        const files = await client.list('./inspiration1');
        console.log(`Found ${files.length} files`);
        for (const file of files) {
            if (file.type !== 1) continue; // Not a file
            const ext = path.extname(file.name).toLowerCase();
            if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) continue;
            
            console.log(`Processing ${file.name}...`);
            const localPath = path.join(__dirname, file.name);
            await client.downloadTo(localPath, `./inspiration1/${file.name}`);
            
            const buffer = fs.readFileSync(localPath);
            const meta = await sharp(buffer).metadata();
            
            if (meta.width <= 300 && meta.height <= 300) {
                console.log(' Already small enough, skipping.');
                fs.unlinkSync(localPath);
                continue;
            }
            
            const resized = await sharp(buffer)
                .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
                .toBuffer();
                
            fs.writeFileSync(localPath, resized);
            await client.uploadFrom(localPath, `./inspiration1/${file.name}`);
            console.log(' Resized and uploaded.');
            fs.unlinkSync(localPath);
        }
        console.log('Done!');
    } catch(e) {
        console.error(e);
    }
    client.close();
}

run();
