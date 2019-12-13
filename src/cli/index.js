#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs');
const glob = require('glob');
const fs = require('fs-extra');

const getCache = require('./cache');
const reporter = require('./reporter');

process.on('uncaughtException', (error, origin) => {
  reporter.panic(origin, error);
});

process.on('unhandledRejection', (reason, promise) => {
  reporter.panic(promise, reason);
});

const middleware = argv => {
  // Collect files
  argv.files = argv._
    .reduce((acc, i) => {
      let files = glob.sync(i);
      if (files.length === 0) {
        files = [i];
      }

      return acc.concat(files
        .map(file => {
          const filePath = path.resolve(file);

          if (!fs.existsSync(filePath)) {
            return false;
          }

          if (fs.lstatSync(filePath).isFile()) {
            let ext = path.parse(filePath).ext.split('.').pop();
            if (!['jpg','jpeg','png','tif','tiff','webp'].includes(ext)) {
              return false;
            }
          }

          return filePath;
        })
      )
    }, [])
    .filter(o => o);

  // Modify destination if testRun
  for (const dest in argv.dest) {
    if (
      argv.testRun &&
      Object.prototype.hasOwnProperty.call(argv.dest, dest)
    ) {
      argv.dest[dest] = path.join('./test', argv.dest[dest]);
    }
    fs.ensureDirSync(argv.dest[dest]);
  }

  // Init cache
  argv.cache = getCache(argv);
};

/**
```
# build photos from scans then metadata and images
cli build <path/to/scans>

# watch for scans then build photos, metadata and images
cli watch <path/to/scans>

# common command flags
  # build photos from scans
  --only-scans
  # build metadata and images
  --only-photos
  # build metadata
  --only-photo-meta
  # build images
  --only-photo-images

```
*/

// const cli = yargs();

// cli
yargs()
  .scriptName('cliffs-pics-source')
  .usage('Usage: $0 <command> [options]')
  .pkgConf('config')
  .options({
    'test-run': {
      alias: 't',
      type: 'boolean',
      global: true,
    },
    'no-cache': {
      type: 'boolean',
      global: true,
    },
    'initial-rotation': {
      alias: 'r',
      type: 'number',
      nargs: 1,
      default: 180,
      global: true,
    },
    'resolution': {
      type: 'number',
      default: 600,
      global: true,
    },
    'mode': {
      alias: 'm',
      type: 'string',
      choices: ['all','only-scans','only-photos','only-meta','only-images'],
      default: 'all',
      global: 'true',
      nargs: 1
    },
  })
  .wrap(yargs.terminalWidth())
  .fail((msg, err) => {
    reporter.panic(msg, err);
  })
  .parserConfiguration({'boolean-negation': false})
  .middleware(middleware)
  .commandDir('./commands')
  .parse(process.argv.filter(a => !(a === __dirname || a.endsWith('node'))));
