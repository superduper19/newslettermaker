require('dotenv').config();
const { getFtpRemoteDir, getArticleSubfolder } = require('./lib/purablis-public-url');

console.log("Article subfolder:", getArticleSubfolder());
console.log("FTP Remote Dir for article:", getFtpRemoteDir(getArticleSubfolder(), 'images'));
