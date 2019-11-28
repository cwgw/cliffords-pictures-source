#!/usr/bin/env node

/**
 * To do:
 *  - add 'clean' flag that wipes destination dir before starting
 *  - add flag that allows for skipping files that already exist in dest
 */

const path = require('path');
const glob = require('glob');
const PQueue = require('p-queue').default;

const reporter = require('../reporter');
const createMetadata = require('./create-photo-metadata');
const createImages = require('./create-web-ready-images');
const parseScans = require('./create-photos-from-scans');

module.exports = ({input, options}) => {
	const nothingToDo = () => {
		reporter.info(`There's nothing to do. Exiting process early...`);
		process.exit();
	};

	const files = input.reduce((acc, i) => {
		let inputFiles = glob.sync(i);
		if (inputFiles.length === 0) {
			inputFiles = [i];
		}

		return acc.concat(
			inputFiles.map(filePath => ({
				filePath,
				...path.parse(filePath),
			}))
		);
	}, []);

	if (files.length === 0) {
		reporter.warn('no files enqueued');
		nothingToDo();
	}

	if (options.testRun) {
		options.dest = path.join('./test', options.dest);
	}

	if (options.parseScans) {
		return Promise.all(
			files.map(file =>
				parseScans({
					file,
					options,
					reporter,
				})
			)
		);
	}

	const tasks = [];

	if (options.createMetadata) {
		tasks.push(createMetadata);
	}

	if (options.createImages) {
		tasks.push(createImages);
	}

	if (tasks.length === 0) {
		reporter.warn('no tasks specified');
		nothingToDo();
	}

	const queue = new PQueue({concurrency: 8});

	reporter.info(`Processing ${files.length} files`);

	const pendingTasks = files.map(file => () => {
		const sequence = reporter.sequence({
			prefixText: file.name,
			text: 'starting',
		});
		return Promise.all(
			tasks.map(func => {
				return func({
					file,
					options,
					reporter,
					sequence,
				});
			})
		).then(() => sequence.succeed());
	});

	queue.addAll(pendingTasks);

	queue.onIdle().then(() => {
		reporter.success('done');
	});
};
