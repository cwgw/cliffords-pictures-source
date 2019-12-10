/**
 * Note that imageSizes are expected to be sorted ascending order
 */
module.exports = {
	withBase64: true,
	imageFormats: ['jpg', 'webp'],
	imageSizes: [192, 384, 768, 1536],
	cacheDir: '.cache',
	dest: {
		web: 'site/content',
		src: 'src/photos',
	},
};
