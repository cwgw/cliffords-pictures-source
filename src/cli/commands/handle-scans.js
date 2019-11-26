#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const program = require('commander');
const sharp = require('sharp');

const {getContourData, readImage, rotateAndCrop} = require('./image-detection');

const {getFaces, createFaceID} = require('./face-detection');

const pHash = require('./perceptual-hash');
const report = require('./reporter');

program
	.option('-d, --destination <dirname>', 'output directory', './data')
	.option('-f, --output-image-format <type>', 'output image format', '.png')
	.option(
		'-r, --initial-rotation <number>',
		'rotation of scanned image before processing',
		0
	)
	.parse(process.argv);

const destination = {
	images: path.resolve(program.destination, 'images'),
	faces: path.resolve(program.destination, 'faces'),
	imageMeta: path.resolve(program.destination, 'image-meta'),
};

const imageTarget = {
	width: 4, // Inches
	height: 4.0625, // Inches
	resolution: 600, // Pixels per inch
};

imageTarget.area =
	imageTarget.width * imageTarget.height * imageTarget.resolution ** 2;
imageTarget.aspectRatio = imageTarget.width / imageTarget.height;

// Checks if n is within ±(threshold * target) of target
const isAround = (n, target, threshold = 0.1) => {
	return target * (1 - threshold) < n && n < target * (1 + threshold);
};

const isRightSized = ({area, width, height, target = imageTarget}) =>
	isAround(area, target.area) && isAround(width / height, target.aspectRatio);

function saveImage(imagePath, image) {
	if (image instanceof sharp) {
		image
			.toFile(imagePath)
			.catch(error =>
				report.error(
					`Failed to save image to destination '${imagePath}'.`,
					error
				)
			);
	}

	image.save(imagePath);
}

function saveImageMeta(id, data) {
	const file = path.join(destination.imageMeta, `${id}.json`);
	fs.writeJson(file, data, {spaces: 2});
}

function saveFace(id, data) {
	const file = path.join(destination.faces, `${id}.json`);
	fs.writeJson(file, data, {spaces: 2});
}

async function parseImage(pendingImage) {
	report.info('parseImage');
	try {
		const image = await pendingImage;
		const imageSharp = await sharp(image.toBuffer());

		const id = await pHash(imageSharp);
		const imagePath = path.join(
			destination.images,
			id + program.outputImageFormat
		);

		// Watch out for dHash id collisions
		const imageAlreadyExists = await fs.pathExists(imagePath);
		if (imageAlreadyExists) {
			report.error(
				`Possible id collision. Image '${id +
					program.outputImageFormat}' already exists in ${destination.images}`
			);
		}

		const {faces, transform} = await getFaces(imageSharp);

		const imageMeta = {
			id,
			image: path.relative(destination.imageMeta, imagePath),
			transform,
			people: [],
			date: null,
			location: null,
		};

		saveImageMeta(id, imageMeta);
		saveImage(imagePath, image);
		faces.forEach(face => {
			const faceID = createFaceID({imageID: id, center: face.rect.center});
			saveFace(faceID, {id: faceID, image: id, ...face});
		});
	} catch (error) {
		report(`parseImage failed with error.`, error);
	}
}

async function getImages(filePath) {
	report.info('getImages');
	if (!/\.(jpeg|jpg|png|tiff|tif)/.test(path.extname(filePath))) return;

	const originalImage = await readImage(path.resolve(filePath));

	if (parseInt(program.initialRotation) > 0) {
		originalImage.rotate(parseInt(program.initialRotation));
	}

	// Drop alpha channel if it exists
	// some opencv methods expect exactly 3 channels
	if (originalImage.channels() > 3) {
		const channels = await originalImage.split();
		await originalImage.merge(channels.slice(0, 3));
	}

	// Const contours = await cvGetContours(originalImage);
	const contours = await getContourData(originalImage, isRightSized);

	report.info(`contour count first pass == ${contours.length}`);

	// Loop through array of contours
	// for each contour, rotate and crop, then get contours again and repeat once
	// return array of promises
	return contours.reduce(
		(acc, data) =>
			acc.concat(
				rotateAndCrop({image: originalImage, inset: -30, ...data}).then(
					croppedImage =>
						getContourData(croppedImage, isRightSized).then(contours2 => {
							report.info(`contour count second pass == ${contours2.length}`);
							return rotateAndCrop({
								image: croppedImage,
								inset: 10,
								...contours2[0],
							});
						})
				)
			),
		[]
	);
}

async function parseScannedImage(filePath) {
	report.info('parseScannedImage');
	try {
		// Split scan into individual images
		const images = await getImages(filePath);
		// Await Promise.all(images.map(parseImage));

		// we almost always expect 4 photos from each scan
		// if we don't get exactly 4, there's a good chance something went wrong
		if (images.length !== 4) {
			report.warning(
				`${images.length > 4 ? 'More' : 'Fewer'} than 4 photos detected`,
				`\t${images.length} photos were pulled from '${newFileName}'`
			);
		}

		const file = path.parse(filePath);
		const dest = path.resolve(program.destination, 'scans');
		await fs.ensureDir(dest);

		const countExisting = glob.sync(path.join(dest, '*' + file.ext)).length;
		const fileName = `cp-${countExisting.toString().padStart(5, '0')}${
			file.ext
		}`;

		// Move the scan from its original location to destination/scans dir
		await fs.move(filePath, path.join(dest, fileName), {overwrite: false});
	} catch (error) {
		report.error(`parseScannedImage failed with error.`, error);
	}
}

(function() {
	return "Here's a return value";
	// Report.info(path.resolve(process.env.NODE_PATH));
	// report.info(path.resolve('.'));
})();

// (function run() {
//   const filePaths = program.args.reduce((acc, input) => {
//     let files = glob.sync(input);
//     if (!files.length) files = [input];
//     return acc.concat(files);
//   }, []);

//   (async () => {
//     // ensure output paths exist
//     await Promise.all(Object.values(destination).map(dir => fs.ensureDir(dir)));
//     for (let i = 0; i < filePaths.length; i++) {
//       report.info(`Processing '${filePaths[i]}'...`);
//       await parseScannedImage(filePaths[i]);
//     }
//   })();
// })();
