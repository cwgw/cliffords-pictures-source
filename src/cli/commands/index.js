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
const parseScans = require('./create-photos-from-scans');

module.exports = ({input, options}) => {
	const nothingToDo = () => {
		reporter.exit(`There's nothing to do. Exiting process early...`);
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
		for (const d in options.dest) {
			if (Object.prototype.hasOwnProperty.call(options.dest, d)) {
				options.dest[d] = path.join('./test', options.dest[d]);
			}
		}
	}

	if (options.parseScans) {
		fs.ensureDirSync(path.resolve(options.dest.src));
		return Promise.all(
			files.map((file, i, arr) => {
				const sequence = reporter.sequence({
					prefixText: `${i} of ${arr.length}: ${file.name}`,
					text: 'starting',
				});
				return parseScans({
					file,
					options,
					reporter,
					sequence,
				}).then(() => sequence.succeed());
			})
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

	const pendingTasks = files.map((file, i, arr) => () => {
		const sequence = reporter.sequence({
			prefixText: `${i} of ${arr.length}: ${file.name}`,
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
