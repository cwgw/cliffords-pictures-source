const path = require('path');
const fs = require('fs-extra');
const get = require('lodash/get');
const imagemin = require(`imagemin`);
const imageminMozjpeg = require(`imagemin-mozjpeg`);
const imageminPngquant = require(`imagemin-pngquant`);
const imageminWebp = require(`imagemin-webp`);
const sharp = require('sharp');

const reporter = require('../reporter');
const io = require('./io');

async function compressJpg(sharpBuffer, outputPath) {
	const imageminBuffer = await imagemin.buffer(sharpBuffer, {
		plugins: [imageminMozjpeg({quality: 90})],
	});
	await fs.writeFile(outputPath, imageminBuffer);
}

async function compressPng(sharpBuffer, outputPath) {
	const imageminBuffer = await imagemin.buffer(sharpBuffer, {
		plugins: [
			imageminPngquant({
				quality: 100,
			}),
		],
	});
	await fs.writeFile(outputPath, imageminBuffer);
}

async function compressWebP(sharpBuffer, outputPath) {
	const imageminBuffer = await imagemin.buffer(sharpBuffer, {
		plugins: [imageminWebp({quality: 90})],
	});
	await fs.writeFile(outputPath, imageminBuffer);
}

const save = {
	jpg: compressJpg,
	jpeg: compressJpg,
	png: compressPng,
	webp: compressWebP,
};

module.exports = async ({file, options, parentJob}) => {
	const id = file.name;
	const meta = await io.getPhotoMeta(id, options);
	const rotate = get(meta, 'transform.rotate', 0);
	const imagePipeline = sharp(file.filePath).rotate(rotate);
	const imageVariants = options.imageSizes.reduce(
		(arr, width) =>
			arr.concat(options.imageFormats.map(format => ({format, width}))),
		[]
	);

	const job = parentJob.add(`create image variants`);

	const pendingImageTasks = imageVariants.map(({width, format}) => {
		return (async () => {
			const outputPath = io.formatPath.webImage(
				{
					id,
					width,
					ext: format,
				},
				options
			);
			fs.ensureDirSync(path.parse(outputPath).dir);

			try {
				const imageJob = job.add(`create ${path.relative('./', outputPath)}`);
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

				await save[format](buffer, outputPath);
				imageJob.finish();
			} catch (error) {
				reporter.panic(`Couldn't create ${outputPath}`, error);
			}
		})();
	});

	await Promise.all(pendingImageTasks);
	job.finish();
};
