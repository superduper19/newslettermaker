require('dotenv').config();

process.env.GODADDY_FTP_WEB_ROOT = '.';
process.env.GODADDY_NEWSLETTER_IMAGES_FTP_PATH = '.';
process.env.GODADDY_INSPIRATIONAL_FTP_PATH = 'inspiration1';
process.env.GODADDY_STATE_FTP_PATH = 'states';

const { getFtpRemoteDir, getInspirationalSubfolder, getStatesSubfolder } = require('./lib/purablis-public-url');

console.log("Inspirational:", getFtpRemoteDir(getInspirationalSubfolder()));
console.log("States:", getFtpRemoteDir(getStatesSubfolder()));
