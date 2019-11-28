#!/usr/bin/env node

const Decimal = require('decimal.js');
const sharp = require('sharp');

const reporter = require('./reporter');

async function pHash(image) {
	try {
		if (!(image instanceof sharp)) {
			image = sharp(image);
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

module.exports = pHash;
