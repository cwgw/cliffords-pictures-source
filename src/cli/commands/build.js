const PQueue = require('p-queue').default;
const path = require('path');

const reporter = require('../reporter');
const doScans = require('../utils/create-photos-from-scans');
const doMeta = require('../utils/create-photo-metadata');
const doImages = require('../utils/create-web-ready-images');

exports.command = 'build'

exports.desc = 'Build assets according to --mode'

exports.handler = ({files, mode, ...options}) => {
  const queue = new PQueue({concurrency: 8});
  const commandJob = reporter.addJob(
    `Process ${files.length} files [mode: '${mode}']`
  );
  
  switch (mode) {
    case 'scans': {
      queue.addAll(files.map((file, i, arr) => async () => {
        const parentJob = reporter.addJob(
          `${i + 1} of ${arr.length}: ${path.parse(file).base}`
        );
        parentJob.start()
        await doScans(file, {parentJob, ...options});
        parentJob.finish()
      }));
      break;
    }
    case 'photos': {
      queue.addAll(files.map(photo => async () => {
        const parentJob = reporter.addJob(
          `process photo: ${path.parse(photo).base}`
        );
        parentJob.start()
        await doMeta(photo, {parentJob, ...options});
        await doImages(photo, {parentJob, ...options});
        parentJob.finish();
      }));
      break;
    }
    case 'meta': {
      queue.addAll(files.map(photo => async () => {
        const parentJob = reporter.addJob(
          `process photo: ${path.parse(photo).base}`
        );
        parentJob.start()
        await doMeta(photo, {parentJob, ...options});
        parentJob.finish();
      }));
      break;
    }
    case 'images': {
      queue.addAll(files.map(photo => async () => {
        const parentJob = reporter.addJob(
          `process photo: ${path.parse(photo).base}`
        );
        parentJob.start()
        await doImages(photo, {parentJob, ...options});
        parentJob.finish();
      }));
      break;
    }
    case 'all':
    default: {
      queue.addAll(files.map((file, i, arr) => async () => {
        const parentJob = reporter.addJob(
          `${i + 1} of ${arr.length}: ${path.parse(file).base}`
        );
        parentJob.start()
        const photos = await doScans(file, {parentJob, ...options});
        parentJob.finish()
        queue.addAll(photos.map(photo => async () => {
          const job = reporter.addJob(
            `process photo ${path.parse(photo).base} from ${path.parse(file).base}`
          );
          job.start()
          await doMeta(photo, {parentJob: job, ...options});
          await doImages(photo, {parentJob: job, ...options});
          job.finish();
        }), {priority: 10})
      }));
    }
  }

  queue.onIdle().then(() => { commandJob.finish(); });
}