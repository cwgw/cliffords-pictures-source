const cv = require('opencv4nodejs');
const reporter = require('../reporter');

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

module.exports = async ({file, config}) => {
	// Load image
	try {
		const image = await cv.imreadAsync(file);
	} catch {
		reporter.panic(`Couldn't read file with opencv`, file);
	}

	// Find photos
	// find contours
	// rotate and crop

	// Save image
};
