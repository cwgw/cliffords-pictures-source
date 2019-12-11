/* eslint-disable no-await-in-loop */

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

const queue = new PQueue({concurrency: 8});

module.exports = async (input, options) => {
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
        ...path.parse(filePath)
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
    queue.addAll(
      files.map((file, i, arr) => async () => {
        const parentJob = reporter.addJob(
          `${i} of ${arr.length}: ${file.name}`
        );
        parentJob.start();
        await parseScans(file, {
          ...options,
          parentJob
        });
        parentJob.finish();
      })
    );

    try {
      await queue.onIdle();
      reporter.success('Done');
    } catch (error) {
      reporter.error(error);
    }

    return;
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

  reporter.info(`Processing ${files.length} files`);

  const pendingTasks = files.map((file, i, arr) => async () => {
    const parentJob = reporter.addJob(
      `${i + 1} of ${arr.length}: ${file.name}`
    );
    parentJob.start();
    for (const task of tasks) {
      await task(file, {...options, parentJob});
    }

    parentJob.finish();
  });

  queue.addAll(pendingTasks);

  try {
    await queue.onIdle();
    reporter.success('Done');
  } catch (error) {
    reporter.error(error);
  }
};
