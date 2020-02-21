const path = require('path');
const fs = require('fs-extra');
const get = require('lodash/get');
const sharp = require('sharp');

const reporter = require('../reporter');
const compress = require('./compress');

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

  const outputDir = path.join(dest.web, id);
  fs.ensureDirSync(outputDir);

  const pendingImageTasks = imageVariants.map(async ({width, format}) => {
    const outputPath = path.join(outputDir, `${width}.${format}`);
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
