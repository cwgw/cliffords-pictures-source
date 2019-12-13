const path = require('path');
const fs = require('fs-extra');
const get = require('lodash/get');
const imagemin = require(`imagemin`);
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const imageminWebp = require('imagemin-webp');
const sharp = require('sharp');

const reporter = require('../reporter');
// Const io = require('./io');

module.exports = async (
  file,
  {cache, parentJob, dest, imageSizes, imageFormats}
) => {
  const job = parentJob
    ? parentJob.add('create web-ready images')
    : reporter.addJob('create web-ready images');
  
  const id = path.parse(file).name;
  const meta = cache.get(['photos', id]).value();
  const rotate = get(meta, 'transform.rotate', 0);
  const imagePipeline = sharp(file).rotate(rotate);
  const imageVariants = imageSizes.reduce(
    (arr, width) => arr.concat(imageFormats.map(format => ({format, width}))),
    []
  );

  const outputDir = path.resolve(dest.web, id);
  fs.ensureDirSync(outputDir);
  
  const pendingImageTasks = imageVariants.map(async ({width, format}) => {
    const outputPath = path.resolve(outputDir, `${width}.${format}`);
    try {
      const buffer = await imagePipeline
        .clone()
        .resize({width})
        .png({
          adaptiveFiltering: false,
          force: format === 'png'
        })
        .webp({
          quality: 90,
          force: format === 'webp'
        })
        .jpeg({
          quality: 100,
          force: format === 'jpg' || format === 'jpeg'
        })
        .toBuffer();

      const image = await compress(buffer, format);
      await fs.writeFile(outputPath, image);
    } catch (error) {
      reporter.panic(
        `Couldn't create ${path.relative('./', outputPath)}`,
        error
      );
    }
  });

  await Promise.all(pendingImageTasks);

  job.note(
    `${imageVariants.length} files saved to ${path.relative('./', outputDir)}`
  );
  job.finish();
};

async function compress(sharpBuffer, format) {
  let plugins;
  switch (format) {
    case 'jpg':
    case 'jpeg':
      plugins = [imageminMozjpeg({quality: 90})];
      break;
    case 'webp':
      plugins = [imageminWebp({quality: 90})];
      break;
    case 'png':
    default:
      plugins = [imageminPngquant({quality: 100})];
      break;
  }

  return imagemin.buffer(sharpBuffer, {plugins});
}
