/**
 * Note that imageSizes are expected to be sorted ascending order
 */
module.exports = {
	withWebp: true,
	withBase64: true,
	imageFormat: 'jpg',
	imageSizes: [192, 384, 768, 1536],
	imagePath: ({id, size, ext}) => `${id}/${size}/${id}.${ext}`,
	dest: {
		metadata: 'data/photos',
		images: 'static/photos',
		src: 'build/photos',
		data: 'site/content',
	},
};
