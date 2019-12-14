const path = require('path');
const fs = require('fs-extra');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const Memory = require('lowdb/adapters/Memory');

module.exports = config => {
  const {cacheDir, noCache} = config;
  fs.ensureDirSync(cacheDir);
  const dbPath = path.join(cacheDir, 'db.json');
  const adapter = noCache ? new Memory() : new FileSync(dbPath);
  return low(adapter);
};
