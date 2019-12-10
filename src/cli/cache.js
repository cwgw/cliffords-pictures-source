const path = require('path');
const fs = require('fs-extra');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

module.exports = config => {
	const {cacheDir} = config;
	fs.ensureDirSync(cacheDir);
	const dbPath = path.resolve(cacheDir, 'db.json');
	const adapter = new FileSync(dbPath);
	return low(adapter);
};
