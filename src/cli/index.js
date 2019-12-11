#!/usr/bin/env node

const yargs = require('yargs');

const config = require('../config');
const getCache = require('./cache');
const reporter = require('./reporter');
const run = require('./commands');

const cli = yargs();

const {_: input, ...argv} = cli
	.scriptName('cliffs-pics-source')
	.usage('Usage: $0 <command> [options]')
	.option('testRun', {
		alias: 't',
		type: 'boolean',
	})
	.option('no-cache', {
		type: 'boolean',
	})
	.option('create-metadata', {
		alias: 'm',
		type: 'boolean',
	})
	.option('create-images', {
		alias: 'i',
		type: 'boolean',
	})
	.option('parse-scans', {
		alias: 's',
		type: 'boolean',
	})
	.option('initial-rotation', {
		alias: 'r',
		type: 'number',
		nargs: 1,
	})
	.option('resolution', {
		type: 'number',
		default: 600,
	})
	.wrap(cli.terminalWidth())
	.fail((msg, err) => {
		reporter.error(msg, err);
	})
	.parserConfiguration({'boolean-negation': false})
	.parse(process.argv.filter(a => !(a === __dirname || a.endsWith('node'))));

const options = {...config, ...argv};
options.cache = getCache(options);

run(input, options);
