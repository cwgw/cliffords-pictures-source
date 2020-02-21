const imagemin = require(`imagemin`);
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const imageminWebp = require('imagemin-webp');

module.exports = async function(imageBuffer, format) {
  let plugins;
  switch (format) {
    case 'jpg':
    case 'jpeg':
      plugins = [imageminMozjpeg({strip: true, quality: 90})];
      break;
    case 'webp':
      plugins = [imageminWebp({strip: true, quality: 90})];
      break;
    case 'png':
    default:
      plugins = [imageminPngquant({strip: true, quality: [98, 100]})];
      break;
  }

  return imagemin.buffer(imageBuffer, {plugins});
};
