const path = require('path');
const fs = require('fs-extra');
const get = require('lodash/get');
const imagemin = require(`imagemin`);
const imageminMozjpeg = require(`imagemin-mozjpeg`);
const imageminPngquant = require(`imagemin-pngquant`);
const imageminWebp = require(`imagemin-webp`);
const sharp = require('sharp');

const reporter = require('../reporter');
// Const io = require('./io');

module.exports = async (file, {cache, parentJob, dest, imageSizes, imageFormats}) => {
	const job = parentJob.add(`create web-ready images`);
	const id = file.name;
	const meta = cache.get(['photos', id]).value();
	const rotate = get(meta, 'transform.rotate', 0);
	const imagePipeline = sharp(file.filePath).rotate(rotate);
	const imageVariants = imageSizes.reduce(
		(arr, width) =>
			arr.concat(imageFormats.map(format => ({format, width}))),
		[]
	);

	const outputDir = path.resolve(dest.web, id);
	fs.ensureDirSync(outputDir);

	const pendingImageTasks = imageVariants.map(async ({width, format}) => {
		try {
			const outputPath = path.resolve(outputDir, `${width}.${format}`);
			const buffer = await imagePipeline
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
				.toBuffer();

			const image = await compress(buffer, format);
			await fs.writeFile(outputPath, image);
		} catch (error) {
			reporter.panic(`Couldn't create ${outputPath}`, error);
		}
	});

	await Promise.all(pendingImageTasks);

	const note = [
		['sizes', imageSizes],
		['formats', imageFormats],
		['total', imageVariants.length],
	]
		.map(([key, val]) => `${key}: ${val}`)
		.join(', ');

	job.update(note);
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
