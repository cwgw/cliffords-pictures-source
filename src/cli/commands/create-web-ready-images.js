const path = require('path');
const fs = require('fs-extra');
const get = require('lodash/get');
const imagemin = require(`imagemin`);
const imageminMozjpeg = require(`imagemin-mozjpeg`);
const imageminPngquant = require(`imagemin-pngquant`);
const imageminWebp = require(`imagemin-webp`);
const sharp = require('sharp');

const io = require('./io');

module.exports = async ({file, reporter, sequence, config}) => {
	const id = file.name;
	const meta = await io.getPhotoMeta(id, config);
	const rotate = get(meta, 'transform.rotate', 0);
	const formats = Array.isArray(config.imageFormat) ? config.imageFormat : [config.imageFormat];
	const imagePipeline = sharp(file.filePath).rotate(rotate);
	const imageVariants = config.imageSizes.reduce(
		(arr, width) => arr.concat(formats.map(format => ({format, width}))),
		[]
	);

	sequence.update({
		text: `creating image variants`,
		add: imageVariants.length,
	});

	const pendingImageTasks = imageVariants.map(({width, format}) => {
		const outputPath = io.formatPath.webImage(
			{
				id,
				width,
				ext: format,
			},
			config
		);
		fs.ensureDirSync(path.parse(outputPath).dir);
		return imagePipeline
			.clone()
			.resize({width})
			.png({
				adaptiveFiltering: false,
				force: format === 'png',
			})
			.webp({
				quality: 90,
				force: format === 'webp',
			})
			.jpeg({
				quality: 100,
				force: format === 'jpg' || format === 'jpeg',
			})
			.toBuffer()
			.then(buffer => {
				sequence.update(`creating ${outputPath}`);
				switch (format) {
					case 'jpg':
					case 'jpeg':
						return compressJpg(buffer, outputPath);
					case 'png':
						return compressPng(buffer, outputPath);
					case 'webp':
						return compressWebP(buffer, outputPath);
					default:
						reporter.warn(`format "${format}" is invalid`);
						return null;
				}
			})
			.then(() => {
				sequence.step();
			})
			.catch(error => {
				reporter.panic(`Couldn't create ${outputPath}`, error);
			});
	});

	return Promise.all(pendingImageTasks);
};

function compressPng(sharpBuffer, outputPath) {
	return imagemin
		.buffer(sharpBuffer, {
			plugins: [
				imageminPngquant({
					quality: 100,
				}),
			],
		})
		.then(imageminBuffer => fs.writeFile(outputPath, imageminBuffer));
}

function compressJpg(sharpBuffer, outputPath) {
	return imagemin
		.buffer(sharpBuffer, {
			plugins: [imageminMozjpeg({quality: 90})],
		})
		.then(imageminBuffer => fs.writeFile(outputPath, imageminBuffer));
}

function compressWebP(sharpBuffer, outputPath) {
	return imagemin
		.buffer(sharpBuffer, {
			plugins: [imageminWebp({quality: 90})],
		})
		.then(imageminBuffer => fs.writeFile(outputPath, imageminBuffer));
}
