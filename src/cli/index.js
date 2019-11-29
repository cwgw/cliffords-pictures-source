#!/usr/bin/env node

const yargs = require('yargs');

const config = require('../config');
const report = require('./reporter');
const run = require('./commands');

const cli = yargs();

const {_: input, ...argv} = cli
	.scriptName('cliffs-pics-source')
	.usage('Usage: $0 <command> [options]')
	.option('testRun', {
		alias: 't',
		type: 'boolean',
	})
	.option('createMetadata', {
		alias: 'm',
		type: 'boolean',
	})
	.option('createImages', {
		alias: 'i',
		type: 'boolean',
	})
	.option('parseScans', {
		alias: 's',
		type: 'boolean',
	})
	.option('initialRotation', {
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
		report.error(msg, err);
	})
	.parse(process.argv.filter(a => !(a === __dirname || a.endsWith('node'))));

run({input, options: {...config, ...argv}});
