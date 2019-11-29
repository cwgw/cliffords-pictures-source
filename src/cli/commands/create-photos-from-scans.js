const path = require('path');
const cv = require('opencv');
const Decimal = require('decimal.js');
const sharp = require('sharp');

module.exports = async ({file, options, reporter, sequence}) => {
	// Load image
	let image;

	sequence.update({
		add: 2,
		text: 'reading image',
	});

	try {
		image = await cvReadImage(file.filePath, {reporter});
	} catch {
		reporter.panic(`Couldn't read file with opencv`, file);
	}

	sequence.step();

	// Find photos
	if (options.initialRotation > 0) {
		image.rotate(options.initialRotation);
	}

	// Drop alpha channel if it exists
	// some opencv methods expect exactly 3 channels
	if (image.channels() > 3) {
		const channels = image.split();
		image.merge(channels.slice(0, 3));
	}

	const isRightSized = getPolaroidSizeTest(options.resolution);

	let contourData = [];
	try {
		// Find contours
		sequence.update('finding contours');
		contourData = await getContours(image, isRightSized);
		sequence.step();
	} catch (error) {
		reporter.panic(`Couldn't get contour data`, error);
	}

	if (contourData.length < 4) {
		reporter.warn(`found fewer than 4 contours in file ${file.name}`);
	}

	sequence.update({add: contourData.length * 3});

	// Process each	image
	const pendingImages = contourData.map(async data => {
		try {
			sequence.update('refining contour');
			const croppedImage = await rotateAndCrop({image, inset: -30, ...data});
			const secondPassData = await getContours(croppedImage, isRightSized);
			const finalImage = await rotateAndCrop({
				image: croppedImage,
				inset: 10,
				...secondPassData[0],
			});
			sequence.step();

			sequence.update(`creating perceptual hash`);
			const id = await pHash(finalImage, reporter);
			sequence.step();

			sequence.update(`saving photo ${id}`);
			const filePath = path.resolve(options.dest.src, `${id}.png`);
			return Promise.resolve(finalImage.save(filePath));
		} catch (error) {
			reporter.error(`Couldn't process image`, error);
		}
	});

	return Promise.all(pendingImages);
};

function cvReadImage(filePath, {reporter}) {
	return new Promise((resolve, reject) => {
		cv.readImage(filePath, (err, image) => {
			if (err) {
				reporter.panic(`failed to readImage.`, err);
				reject(err);
			} else {
				resolve(image);
			}
		});
	});
}

// Given image resolution (dpi) this returns a function to test if
// rects are shaped like polaroids
function getPolaroidSizeTest(resolution) {
	const polaroidSizes = [
		{
			width: 4,
			height: 4.1,
			area: 16.4,
		},
		{
			width: 3.5,
			height: 4.2,
			area: 14.7,
		},
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

	return datum => {
		for (const size of polaroidSizes) {
			if (isRightSized(datum, size)) {
				return true;
			}
		}

		return false;
	};
}

function getContours(image, filter = () => true) {
	const scale = 0.5;
	return new Promise(resolve => {
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
		const mask = blueInverted.threshold(180, 255);

		// Add mask to original
		img.bitwiseAnd(img, mask);

		// Blur, erode, and threshold
		img.gaussianBlur([7, 7]);
		img.erode(2);
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
					y: Math.round((bounds.y + bounds.height / 2) / scale),
				},
				area: (width * height) / scale ** 2,
			};

			// Remove any rects that fail the polaroid size test
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

		resolve([...contourRectData.values()]);
	});
}

function rotateAndCrop({
	image,
	angle,
	center: {x, y},
	width,
	height,
	inset = 0,
}) {
	return new Promise(resolve => {
		const img = image.copy();
		img.rotate(angle, x, y);
		const left = Math.round(x - width / 2);
		const top = Math.round(y - height / 2);
		const croppedImage = img.crop(
			left + inset,
			top + inset,
			width - inset * 2,
			height - inset * 2
		);
		resolve(croppedImage);
	});
}

async function pHash(image, reporter) {
	try {
		if (!(image instanceof sharp)) {
			image = sharp(image.copy().toBuffer());
		}

		const buffer = await image
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

		return new Decimal(hash).toHexadecimal();
	} catch (error) {
		reporter.error(`Couldn't create perceptual hash`, error);
	}
}
