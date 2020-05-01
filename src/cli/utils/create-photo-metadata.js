/* eslint-disable no-await-in-loop */

const path = require('path');
const axios = require('axios');
const Bottleneck = require('bottleneck');
const round = require('lodash/round');
const sharp = require('sharp');
const fs = require('fs-extra');

require('dotenv').config({path: `.env`});

const reporter = require('../reporter');

const faceApi = axios.create({
  baseURL: 'https://westus2.api.cognitive.microsoft.com/face/v1.0/detect',
  headers: {
    'Content-Type': 'application/octet-stream',
    'Ocp-Apim-Subscription-Key': process.env.OCP_APIM_SUBSCRIPTION_KEY
  },
  params: {
    returnFaceId: 'true',
    returnFaceLandmarks: 'false',
    returnFaceAttributes: 'age,gender'
  }
});

const rateLimiter = new Bottleneck({
  minTime: 3334 // ~18 per minute
});

module.exports = async (file, {parentJob, dest, cache}) => {
  const job = parentJob
    ? parentJob.add('create metadata')
    : reporter.addJob('create metadata');

  try {
    const id = path.parse(file).name;
    const cachedData = cache.get(['photos', id]).value();
    if (cachedData) {
      job.note('using cached data', 'success');
      await savePhotoMeta(cachedData, {dir: dest.web, parentJob: job}, true);
      return;
    }

    const imagePipeline = await sharp(file);
    const {faces, transform, aspectRatio} = await getFaces(imagePipeline, {
      id,
      parentJob: job
    });
    const base64 = await getBase64(imagePipeline, {transform, parentJob: job});

    const data = {
      id,
      base64,
      aspectRatio,
      transform,
      faces,
      people: null,
      date: null,
      location: null
    };

    cache.set(['photos', id], data).write();

    await savePhotoMeta(data, {dir: dest.web, parentJob: job}, true);
  } catch (error) {
    reporter.panic('Could not create metadata.', error);
  } finally {
    job.finish();
  }
};

async function getBase64(imagePipeline, {transform, parentJob}) {
  const job = parentJob.add('create base64 string');
  const buffer = await imagePipeline
    .clone()
    .resize({width: 16})
    .rotate(transform ? transform.rotate : 0)
    .blur(1.5)
    .png({force: true})
    .toBuffer()
    .catch((error) => reporter.panic(error));

  job.finish();
  return `data:image/png;base64,${buffer.toString(`base64`)}`;
}

async function getFaces(imagePipeline, {id, parentJob}) {
  const job = parentJob.add('find faces');
  let aspectRatio;

  try {
    const imageMetadata = await imagePipeline.metadata();
    aspectRatio = imageMetadata.width / imageMetadata.height;
  } catch (error) {
    reporter.panic(error);
  }

  let width = 2000;
  let height = Math.round(width / aspectRatio);
  let rotate;
  let faces = [];
  let i = 0;

  do {
    rotate = i * 90;
    try {
      if (i) {
        // Swap width and height with each (90deg) rotation
        [width, height] = [height, width];
      }

      const stream = await imagePipeline
        .clone()
        .rotate(rotate)
        .resize(width, height)
        .jpeg({quality: 85, force: true})
        .toBuffer();
      faces = await rateLimiter.schedule(async () => {
        try {
          const result = await faceApi.post('', stream);
          return result.data;
        } catch (error) {
          reporter.panic(error);
        }
      });
    } catch (error) {
      reporter.panic('Could not complete request.', error);
    }
  } while (faces.length < 1 && ++i < 4);

  let message = 'found none';
  if (faces.length > 0) {
    message = `found ${faces.length}, with ${
      rotate > 0 ? rotate + 'deg' : 'no'
    } rotation`;
  }

  job.note(message, 'gray');

  faces = faces.map(
    ({faceId, faceRectangle: r, faceAttributes: attributes}) => {
      const rect = {
        top: round(r.top / height, 8),
        left: round(r.left / width, 8),
        width: round(r.width / width, 8),
        height: round(r.height / height, 8)
      };
      rect.center = {
        x: round(rect.left + rect.width / 2, 8),
        y: round(rect.top + rect.height / 2, 8)
      };
      return {
        id: createFaceID({imageId: id, center: rect.center}),
        faceId,
        attributes,
        rect
      };
    }
  );

  job.finish();

  return {
    faces,
    transform: faces.length > 0 && rotate % 360 ? {rotate} : null,
    aspectRatio
  };
}

function createFaceID({imageId, center: {x, y}}) {
  const [cx, cy] = [x, y].map((n) =>
    round(n * 100)
      .toString()
      .padStart(2, '0')
  );
  return `${imageId}-${cx}-${cy}`;
}

async function savePhotoMeta(data, {dir, parentJob}, force = false) {
  const job = parentJob.add(`save data file`);
  const filePath = path.join(dir, data.id, `data.json`);
  job.note(path.relative('./', filePath));

  if (fs.existsSync(filePath) && !force) {
    reporter.warn(
      `Cannot save metadata file`,
      `${path.relative('./', filePath)} already exists`,
      `To force overwrite, call with truthy second argument`
    );
    return;
  }

  await fs.ensureDir(path.parse(filePath).dir);
  await fs.writeJSON(filePath, data, {spaces: 2});
  job.finish();
}
