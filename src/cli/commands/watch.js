const path = require('path');
const chokidar = require('chokidar');
const PQueue = require('p-queue').default;

const reporter = require('../reporter');
const doScans = require('../utils/create-photos-from-scans');
const doMeta = require('../utils/create-photo-metadata');
const doImages = require('../utils/create-web-ready-images');

exports.command = 'watch';

exports.desc = 'Build assets when files are added to the provided directories';

exports.handler = ({files, mode, ...options}) => {
  const queue = new PQueue({concurrency: 8});
  const watch = reporter.addJob(`Watching '${files[0]}' [mode: '${mode}']`);
  watch.start();

  let newFileHandler;

  if (mode === 'all' || mode === 'only-scans') {
    newFileHandler = scan => {
      if (!isValidImage(scan)) return;
      queue.add(async () => {
        const scanName = path.parse(scan).base;
        const parentJob = reporter.addJob(`Process scan: ${scanName}`);
        parentJob.start();
        const photos = await doScans(scan, {parentJob, ...options});
        parentJob.finish();

        if (mode === 'all') {
          queue.addAll(
            photos.map(photo => async () => {
              const photoName = path.parse(photo).base;
              const job = reporter.addJob(
                `process photo ${photoName} from ${scanName}`
              );
              job.start();
              await doMeta(photo, {parentJob: job, ...options});
              await doImages(photo, {parentJob: job, ...options});
              job.finish();
            }),
            {priority: 10}
          );
        }
      });
    };
  } else {
    newFileHandler = photo => {
      if (!isValidImage(photo)) return;
      queue.add(async () => {
        const photoName = path.parse(photo).base;
        const parentJob = reporter.addJob(`Process photo: ${photoName}`);
        parentJob.start();

        if (mode !== 'only-images') {
          await doMeta(photo, {parentJob, ...options});
        }

        if (mode !== 'only-meta') {
          await doImages(photo, {parentJob, ...options});
        }

        parentJob.finish();
      });
    };
  }

  chokidar
    .watch(files.join(' '), {
      ignored: /(^|[/\\])\../,
      ignoreInitial: true
    })
    .on('add', newFileHandler);
};

function isValidImage(file) {
  const ext = path
    .parse(file)
    .ext.split('.')
    .pop();

  if (['jpg', 'jpeg', 'png', 'tif', 'tiff', 'webp'].includes(ext)) {
    return true;
  }

  return false;
}
