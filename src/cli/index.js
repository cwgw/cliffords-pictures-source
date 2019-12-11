#!/usr/bin/env node

const yargs = require('yargs');
const path = require('path');
const glob = require('glob');

const getCache = require('./cache');
const reporter = require('./reporter');
const run = require('./commands');

const middleware = argv => {
  console.log('running middleware')
  // collect files
  argv.files = argv._.reduce((acc, i) => {
    let inputFiles = glob.sync(i);
    if (inputFiles.length === 0) {
      inputFiles = [i];
    }

    return acc.concat(
      inputFiles.map(filePath => ({
        filePath,
        ...path.parse(filePath)
      }))
    );
  }, []);

  // modify destination if testRun
  if (argv.testRun) {
    for (const d in argv.dest) {
      if (Object.prototype.hasOwnProperty.call(argv.dest, d)) {
        argv.dest[d] = path.join('./test', argv.dest[d]);
      }
    }  
  }

  // init cache
  argv.cache = getCache(argv);
}

const cli = yargs();

cli
  .scriptName('cliffs-pics-source')
  .usage('Usage: $0 <command> [options]')
  .pkgConf('config')
  .option('testRun', {
    alias: 't',
    type: 'boolean'
  })
  .option('no-cache', {
    type: 'boolean'
  })
  .option('create-metadata', {
    alias: 'm',
    type: 'boolean'
  })
  .option('create-images', {
    alias: 'i',
    type: 'boolean'
  })
  .option('parse-scans', {
    alias: 's',
    type: 'boolean'
  })
  .option('initial-rotation', {
    alias: 'r',
    type: 'number',
    nargs: 1
  })
  .option('resolution', {
    type: 'number',
    default: 600
  })
  .wrap(cli.terminalWidth())
  .fail((msg, err) => {
    reporter.error(msg, err);
  })
  .parserConfiguration({'boolean-negation': false})
  .middleware(middleware)
  .command('$0', 'build', () => {}, argv => run(argv))
  .parse(process.argv.filter(a => !(a === __dirname || a.endsWith('node'))));
