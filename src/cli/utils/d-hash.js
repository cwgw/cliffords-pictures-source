const Decimal = require('decimal.js');
const sharp = require('sharp');
const cv = require('opencv');

const reporter = require('../reporter');

/**
 * Generates a 64-bit-as-binary-string image fingerprint
 * Taken from sharp's tests - https://github.com/lovell/sharp/blob/master/test/fixtures/index.js#L14
 * ...which is based on Neal Krawetz's dHash - https://www.hackerfactor.com/blog/index.php?/archives/529-Kind-of-Like-That.html
 */

module.exports = async function(image, {parentJob} = {}) {
  try {
    const job = parentJob && parentJob.add('create perceptual hash');
    let imageSharp;

    if (image instanceof sharp) {
      imageSharp = await image.clone();
    } else if (image instanceof cv.Matrix) {
      imageSharp = await sharp(image.copy().toBuffer());
    } else {
      imageSharp = await sharp(image);
    }

    const buffer = await imageSharp
      .greyscale()
      .normalise()
      .resize(9, 8, {fit: 'fill'})
      .raw()
      .toBuffer();

    let hash = '0b';
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        const left = buffer[row * 8 + col];
        const right = buffer[row * 8 + col + 1];
        hash += left < right ? '1' : '0';
      }
    }

    if (job) {
      job.finish();
    }
    return new Decimal(hash).toHexadecimal();
  } catch (error) {
    reporter.panic(`Couldn't create perceptual hash`, error);
  }
};
