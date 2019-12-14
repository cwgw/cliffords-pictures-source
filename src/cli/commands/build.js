const PQueue = require('p-queue').default;
const path = require('path');

const reporter = require('../reporter');
const doScans = require('../utils/create-photos-from-scans');
const doMeta = require('../utils/create-photo-metadata');
const doImages = require('../utils/create-web-ready-images');

exports.command = 'build'

exports.desc = 'Build assets according to --mode'

exports.handler = async ({files, mode, ...options}) => {
  const queue = new PQueue({concurrency: 8});
  const commandJob = reporter.addJob(
    `Process ${files.length} files [mode: '${mode}']`
  );

  try {
    if (mode === 'all' || mode === 'only-scans') {
      queue.addAll(files.map((scan, i, arr) => async () => {
        const scanName = path.parse(scan).base;
        const parentJob = reporter.addJob(
          `[${i+1}/${arr.length}] process scan: ${scanName}`
        );
        parentJob.start();
        const photos = await doScans(scan, {parentJob, ...options})
        parentJob.finish();

        if (mode === 'all') {
          queue.addAll(photos.map(photo => async () => {
            const photoName = path.parse(photo).base;
            const job = reporter.addJob(
              `process photo ${photoName} from ${scanName}`
            );
            job.start();
            await doMeta(photo, {parentJob: job, ...options});
            await doImages(photo, {parentJob: job, ...options});
            job.finish();
          }), {priority: 10});
        }

      }));
    } else {
      queue.addAll(files.map((photo, i, arr) => async () => {
        const photoName = path.parse(photo).base;
        const parentJob = reporter.addJob(
          `[${i+1}/${arr.length}] process photo: ${photoName}`
        );
        parentJob.start()

        if (mode !== 'only-images') {
          await doMeta(photo, {parentJob, ...options});
        }

        if (mode !== 'only-meta') {
          await doImages(photo, {parentJob, ...options});
        }

        parentJob.finish();
      }))
    }

    await queue.onIdle();
    commandJob.finish();
  } catch (error) {
    reporter.panic(error);
  }
}