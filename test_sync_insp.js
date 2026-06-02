const { Client } = require('basic-ftp');
const https = require('https');
const { PassThrough } = require('stream');
require('dotenv').config();

const files = [
  {
    "name": "2020-_06-01_INSP_Henry_Wadsworth_Longfellow_FR.jpg",
    "url": "https://yazsjqezzousrychcfhf.supabase.co/storage/v1/object/public/newsletter-images/inspirational/1773685478296-2020-_06-01_INSP_Henry_Wadsworth_Longfellow_FR.jpg"
  },
  {
    "name": "2020-_06-01_INSP_Jim_Rohn_FR.jpg",
    "url": "https://yazsjqezzousrychcfhf.supabase.co/storage/v1/object/public/newsletter-images/inspirational/1776699563952-2020-_06-01_INSP_Jim_Rohn_FR.jpg"
  },
  {
    "name": "2020-_15-01_INSP_Eleanor_Roosevelt__FR.jpg",
    "url": "https://yazsjqezzousrychcfhf.supabase.co/storage/v1/object/public/newsletter-images/inspirational/1777921832673-2020-_15-01_INSP_Eleanor_Roosevelt__FR.jpg"
  }
];

async function syncToFtp() {
    const client = new Client();
    client.ftp.verbose = false;
    try {
        await client.access({
            host: process.env.GODADDY_FTP_HOST,
            user: process.env.GODADDY_FTP_USER,
            password: process.env.GODADDY_FTP_PASS,
            secure: false
        });
        
        await client.ensureDir('inspiration1');
        
        for (const file of files) {
            console.log("Downloading " + file.name + " from Supabase...");
            const buffer = await new Promise((resolve, reject) => {
                https.get(file.url, (res) => {
                    const data = [];
                    res.on('data', chunk => data.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(data)));
                }).on('error', reject);
            });
            
            const stream = new PassThrough();
            stream.end(buffer);
            console.log("Uploading " + file.name + " to FTP...");
            await client.uploadFrom(stream, file.name);
        }
        console.log("Done syncing inspirational images.");
    } catch (err) {
        console.error(err);
    }
    client.close();
}
syncToFtp();
