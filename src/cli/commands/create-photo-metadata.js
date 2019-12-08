/* eslint-disable no-await-in-loop */

const axios = require('axios');
const Bottleneck = require('bottleneck');
const round = require('lodash/round');
const sharp = require('sharp');

require('dotenv').config({path: `.env`});

const reporter = require('../reporter');
const io = require('./io');

const faceApi = axios.create({
	baseURL: 'https://westus2.api.cognitive.microsoft.com/face/v1.0/detect',
	headers: {
		'Content-Type': 'application/octet-stream',
		'Ocp-Apim-Subscription-Key': process.env.OCP_APIM_SUBSCRIPTION_KEY,
	},
	params: {
		returnFaceId: 'true',
		returnFaceLandmarks: 'false',
		returnFaceAttributes: 'age,gender',
	},
});

const rateLimiter = new Bottleneck({
	minTime: 3334, // 18 per minute
});

module.exports = async ({file, parentJob, options}) => {
	const job = parentJob.add('create metadata');
	try {
		const imagePipeline = await sharp(file.filePath);
		const aspectRatio = await getAspectRatio({imagePipeline});

		const meta = {
			id: file.name,
			aspectRatio,
			people: null,
			date: null,
			location: null,
		};

		const base64 = job.add('create base64 string');
		meta.base64 = await getBase64({imagePipeline, reporter});
		base64.finish();

		const faceJob = job.add('search for faces');
		const {faces, transform} = await getFaces({
			meta,
			imagePipeline,
			parentJob: faceJob,
		});
		meta.faces = faces;
		meta.transform = transform;
		faceJob.finish();

		const savemeta = job.add('save photo metadata');
		await io.savePhotoMeta(meta, {options, force: true});
		savemeta.finish();

		job.finish();
	} catch (error) {
		reporter.panic('Could not create metadata.', error);
	}
};

async function getAspectRatio({imagePipeline}) {
	const {width, height} = await imagePipeline
		.metadata()
		.catch(error => reporter.panic(error));
	return width / height;
}

async function getBase64({imagePipeline, reporter}) {
	const buffer = await imagePipeline
		.clone()
		.resize({width: 16})
		.blur(1.5)
		.png({force: true})
		.toBuffer()
		.catch(error => reporter.panic(error));
	return `data:image/png;base64,${buffer.toString(`base64`)}`;
}

async function getFaces({meta, imagePipeline, parentJob}) {
	const {id, aspectRatio} = meta;
	let width = 1536;
	let height = Math.round(width / aspectRatio);
	let rotate;
	let faces = [];
	let i = 0;

	do {
		rotate = i * 90;
		const job = parentJob.add(`detect faces: rotation ${rotate}deg`);
		try {
			if (i) {
				// Swap width and height with each (90deg) rotation
				[width, height] = [height, width];
			}

			const stream = await imagePipeline
				.clone()
				.rotate(rotate)
				.resize(width, height)
				.jpeg({quality: 85, force: true})
				.toBuffer();
			faces = await rateLimiter.schedule(async () => {
				try {
					const res = await faceApi.post('', stream);
					return res.data;
				} catch (error) {
					reporter.panic(error);
				}
			});
			job.finish();
		} catch (error) {
			reporter.panic('Could not complete request.', error);
		}
	} while (faces.length < 1 && ++i < 4);

	faces = faces.map(
		({faceId, faceRectangle: r, faceAttributes: attributes}) => {
			const rect = {
				top: round(r.top / height, 8),
				left: round(r.left / width, 8),
				width: round(r.width / width, 8),
				height: round(r.height / height, 8),
			};
			rect.center = {
				x: round(rect.left + rect.width / 2, 8),
				y: round(rect.top + rect.height / 2, 8),
			};
			return {
				id: createFaceID({imageId: id, center: rect.center}),
				faceId,
				attributes,
				rect,
			};
		}
	);

	return {
		faces,
		transform: faces.length > 0 && rotate % 360 ? {rotate} : null,
	};
}

function createFaceID({imageId, center: {x, y}}) {
	const [cx, cy] = [x, y].map(n =>
		round(n * 100)
			.toString()
			.padStart(2, '0')
	);
	return `${imageId}-${cx}-${cy}`;
}
