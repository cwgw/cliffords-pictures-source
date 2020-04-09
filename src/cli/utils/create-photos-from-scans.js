const path = require('path');
const fs = require('fs-extra');
const cv = require('opencv');
const _ = require('lodash');

const reporter = require('../reporter');
const dHash = require('./d-hash');
const compress = require('./compress');

module.exports = async (
  file,
  {parentJob, initialRotation, resolution, cache, dest}
) => {
  const job = parentJob
    ? parentJob.add('search scan')
    : reporter.addJob('search scan');

  let photos;

  try {
    const image = await cvReadImage(file);

    if (initialRotation > 0) {
      image.rotate(initialRotation);
    }

    let id = path.parse(file).name;
    if (!id.startsWith('0x')) {
      id = await dHash(image);
    }

    const imagePath = path.join(dest.srcScan, `${id}.png`);
    if (!fs.existsSync(imagePath)) {
      const compressedImage = await compress(image.copy().toBuffer());
      fs.writeFile(imagePath, compressedImage);
    }

    const cachedData = cache.get(['scans', id]).value();
    if (cachedData) {
      let returnEarly = true;
      for (const photo of cachedData.photos) {
        if (!fs.existsSync(photo)) {
          returnEarly = false;
          break;
        }
      }

      if (returnEarly) {
        job.note('using cached data', 'success');
        return cachedData.photos;
      }
    }

    // Drop alpha channel if it exists
    // some opencv methods expect exactly 3 channels
    if (image.channels() > 3) {
      const channels = image.split();
      image.merge(channels.slice(0, 3));
    }

    const filter = getPolaroidSizeTest(resolution);
    const contourData = await getContours(image, {filter});

    if (contourData.length < 4) {
      reporter.warn(`Found fewer than 4 photos in scan:`, file);
    }

    job.note(`found ${contourData.length} photos`);

    // Process each	image
    photos = await Promise.all(
      contourData.map(async (data, i) => {
        const childJob = job.add(`image ${i + 1}`);
        let filePath;
        try {
          const croppedImage = await rotateAndCrop(image, {
            inset: -50,
            ...data
          });
          const secondPassData = await getContours(croppedImage, {filter});
          const finalImage = await rotateAndCrop(croppedImage, {
            inset: 10,
            ...secondPassData[0]
          });

          const photoId = await dHash(finalImage);
          childJob.note(photoId);
          filePath = path.join(dest.srcPhoto, `${photoId}.png`);
          await cvSaveImage(filePath, finalImage);
          childJob.finish();
          return filePath;
        } catch (error) {
          reporter.error(`Couldn’t process image`, error);
        }
      })
    );
    cache.set(['scans', id], {photos}).write();
    job.finish();
    return photos;
  } catch (error) {
    reporter.panic(error);
  }
};

async function cvReadImage(filePath, {parentJob} = {}) {
  const job = parentJob && parentJob.add('read image');
  let image;
  try {
    image = await new Promise((resolve, reject) => {
      cv.readImage(filePath, (err, image) => {
        if (err) {
          reporter.panic('failed to readImage.', err);
          reject(err);
        } else {
          resolve(image);
        }
      });
    });
    if (job) job.finish();
    return image;
  } catch (error) {
    reporter.panic(error);
  }
}

async function cvSaveImage(filePath, image, {parentJob} = {}) {
  if (fs.existsSync(filePath)) {
    reporter.warn(`Photo already exists.`, filePath);
    filePath += _.snakeCase(new Date().toLocaleTimeString('en-US')) + '.png';
  }

  const job =
    parentJob && parentJob.add(`save photo ${path.relative('./', filePath)}`);
  try {
    await image.save(filePath);
    if (job) job.finish();
  } catch (error) {
    reporter.panic(error);
  }
}

// Given image resolution (dpi) this returns a function to test if
// rects are polaroid-sized
function getPolaroidSizeTest(resolution) {
  const polaroidSizes = [
    {
      width: 4,
      height: 4.1,
      area: 16.4
    },
    {
      width: 3.5,
      height: 4.2,
      area: 14.7
    }
  ];

  const isAround = (n, target, threshold = 0.1) => {
    return target * (1 - threshold) < n && n < target * (1 + threshold);
  };

  const isRightSized = ({area, width, height}, target) => {
    const targetArea = target.area * resolution ** 2;
    const targetAspectRatio = target.width / target.height;
    return (
      isAround(area, targetArea) && isAround(width / height, targetAspectRatio)
    );
  };

  return (datum) => {
    for (const size of polaroidSizes) {
      if (isRightSized(datum, size)) {
        return true;
      }
    }

    return false;
  };
}

async function getContours(image, {filter}) {
  const scale = 0.5;
  const img = image.copy();
  const [h, w] = img.size();

  // Scale down for faster operations
  img.resize(w * scale, h * scale);

  // Split channels
  const channels = img.split();

  // Save blue channel
  const blueChannel = channels[0];

  // Discard alpha channel if it exists
  if (img.channels() > 3) {
    img.merge(channels.slice(0, 3));
  }

  // Grayscale
  img.convertGrayscale();

  // Create mask from inverted blue channel
  const blackMat = new cv.Matrix.Zeros(h * scale, w * scale);
  blueChannel.bitwiseNot(blackMat);
  const blueInverted = img.add(blackMat);
  // Const mask = blueInverted.threshold(180, 255);
  const mask = blueInverted.threshold(200, 255);

  // Add mask to original
  img.bitwiseAnd(img, mask);

  // Blur, erode, and threshold
  // img.gaussianBlur([7, 7]);
  // img.erode(2);
  img.gaussianBlur([3, 3]);
  img.erode(4);

  img.bilateralFilter(30, 30, 100);
  const imgThreshold = img.threshold(70, 255);

  const contours = imgThreshold.findContours();
  const contourRectData = new Map([]);

  for (let i = 0; i < contours.size(); i++) {
    const rect = contours.minAreaRect(i);
    const bounds = contours.boundingRect(i);

    let {width} = rect.size;
    let {height} = rect.size;
    let {angle} = rect;

    if (angle <= -45) {
      angle += 90;
      width = rect.size.height;
      height = rect.size.width;
    }

    const data = {
      angle,
      width: Math.round(width / scale),
      height: Math.round(height / scale),
      center: {
        x: Math.round((bounds.x + bounds.width / 2) / scale),
        y: Math.round((bounds.y + bounds.height / 2) / scale)
      },
      area: (width * height) / scale ** 2
    };

    // Skip any rects that fail the polaroid size test
    if (!filter(data)) {
      continue;
    }

    // Sometimes we end up with contours that are nearly identical,
    // so we use a Map to quickly check for duplicates
    const keyX = Math.floor(data.center.x / 100) * 100;
    const keyY = Math.floor(data.center.y / 100) * 100;
    const key = `_${keyX}${keyY}`;

    if (contourRectData.has(key)) {
      continue;
    }

    contourRectData.set(key, data);
  }

  return [...contourRectData.values()];
}

async function rotateAndCrop(
  image,
  {angle, center: {x, y}, width, height, inset = 0}
) {
  const img = image.copy();
  img.rotate(angle, x, y);
  const [imgH, imgW] = img.size();
  const left = Math.max(0, Math.round(x - width / 2) + inset);
  const top = Math.max(0, Math.round(y - height / 2) + inset);
  const w = Math.min(imgW - left, width - inset * 2);
  const h = Math.min(imgH - top, height - inset * 2);
  const croppedImage = img.crop(left, top, w, h);
  return croppedImage;
}
