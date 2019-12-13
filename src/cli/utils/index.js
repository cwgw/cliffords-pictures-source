/* eslint-disable no-await-in-loop */

/**
 * To do:
 *  - add 'clean' flag that wipes destination dir before starting
 *  - add flag that allows for skipping files that already exist in dest
 */

const path = require('path');
const fs = require('fs-extra');
const PQueue = require('p-queue').default;

const reporter = require('../reporter');
const createMetadata = require('./create-photo-metadata');
const createImages = require('./create-web-ready-images');
const parseScans = require('./create-photos-from-scans');

const queue = new PQueue({concurrency: 8});

module.exports = async ({files, ...options}) => {
  if (files && files.length > 0) {
    reporter.info(`Processing ${files.length} files`);
  } else {
    reporter.exit(`There's nothing to do. Exiting process early...`);
  }

  if (options.parseScans) {
    try {
      fs.ensureDirSync(path.resolve(options.dest.srcScan));
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
    } catch (error) {
      reporter.error(error);
    }
  }

  const tasks = [];

  if (options.createMetadata) {
    tasks.push(createMetadata);
  }

  if (options.createImages) {
    tasks.push(createImages);
  }

  if (tasks.length > 0) {
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
  }

  try {
    await queue.onIdle();
    reporter.success('Done');
  } catch (error) {
    reporter.error(error);
  }
};
