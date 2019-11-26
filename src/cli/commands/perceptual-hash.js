#!/usr/bin/env node

const Decimal = require('decimal.js');
const sharp = require('sharp');

const report = require('./reporter');

function pHash(image) {
	report.info('pHash');

	if (!(image instanceof sharp)) {
		image = sharp(image);
	}

	return image
		.greyscale()
		.normalise()
		.resize(9, 8, {fit: 'fill'})
		.raw()
		.toBuffer()
		.then(data => {
			let hash = '0b';
			for (let col = 0; col < 8; col++) {
				for (let row = 0; row < 8; row++) {
					const left = data[row * 8 + col];
					const right = data[row * 8 + col + 1];
					hash += left < right ? '1' : '0';
				}
			}

			// Convert to hex
			hash = new Decimal(hash).toHexadecimal();
			return hash;
		})
		.catch(error => report.error('pHash failed with error.', error));
}

module.exports = exports = pHash;
