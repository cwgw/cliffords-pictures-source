#!/usr/bin/env node

/**
 * To do:
 *  - add 'clean' flag that wipes destination dir before starting
 *  - add flag that allows for skipping files that already exist in dest
 */

const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const PQueue = require('p-queue').default;

const reporter = require('../reporter');
const createMetadata = require('./create-photo-metadata');
const createImages = require('./create-web-ready-images');

module.exports = (args, config) => {
	const nothingToDo = () => {
		reporter.info(`There's nothing to do. Exiting process early...`);
		process.exit();
	};

	const files = args.input.reduce((acc, input) => {
		let inputFiles = glob.sync(input);
		if (inputFiles.length === 0) {
			inputFiles = [input];
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

	if (args.testRun) {
		for (const d in config.dest) {
			if (Object.prototype.hasOwnProperty.call(config.dest, d)) {
				config.dest[d] = path.join('./test', config.dest[d]);
			}
		}
	}

	const tasks = [];

	if (args.createMetadata) {
		tasks.push(createMetadata);
	}

	if (args.createImages) {
		if (config.withWebp && config.imageFormat !== 'webp') {
			config.imageFormat = [config.imageFormat, 'webp'];
		}

		tasks.push(createImages);
	}

	if (tasks.length < 1) {
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
					config,
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
