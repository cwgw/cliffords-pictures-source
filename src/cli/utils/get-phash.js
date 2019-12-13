const path = require('path');
const sharp = require('sharp');
const fs = require('fs-extra');
const PQueue = require('p-queue').default;
const imagemin = require(`imagemin`);
const imageminPngquant = require('imagemin-pngquant');

const reporter = require('../reporter');
const pHash = require('./perceptual-hash.js');

const queue = new PQueue({concurrency: 7});

module.exports = async ({files, initialRotation, dest}) => {
  const pending = files.map(({filePath}) => async () => {
    if (!fs.existsSync(path.resolve(filePath))) {
      reporter.warning(`${path.resolve(filePath)} does not exist`);
      return;
    }

    try {
      const parentJob = reporter.addJob('re-save scan');
      parentJob.start();
      const image = await sharp(filePath).rotate(initialRotation || 0);
      const id = await pHash(image, {parentJob});
      // const finalImage = await compressPng(image, {parentJob});

       const buffer = await image
        .png({
          adaptiveFiltering: false,
          force: true
        })
        .toBuffer();

      await saveImage(
        path.resolve(dest.srcScan, `${id}.png`),
        buffer,
        {parentJob}
      )
      parentJob.finish();
    } catch (error) {
      console.log(error);
    }
  })
  
  queue.addAll(pending);
};

async function compressPng(image, {parentJob}) {
  try {
    const job = parentJob.add('compress');
    const buffer = await image
    .png({
      adaptiveFiltering: false,
      force: true
    })
    .toBuffer();
        
    const compressed = await imagemin
    .buffer(buffer, {
      plugins: [
        imageminPngquant({
          speed: 1,
          quality: [0.75, 1],
          strip: true
        })
      ]
    })
    
    job.finish();
    return compressed;
  }  catch (error) {
    reporter.panic(error);
  }
}

async function saveImage (destination, image, {parentJob}) {
  try {
    const job = parentJob.add('save')  
    await fs.writeFile(destination, image);
    job.finish();
  } catch (error) {
    reporter.panic(error);
  }
}
