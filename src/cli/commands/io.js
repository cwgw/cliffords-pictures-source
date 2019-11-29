const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');

const reporter = require('../reporter');

const formatPath = {
	meta: (id, {dest}) => path.resolve(dest.web, id, `data.json`),
	webImage: ({id, width, ext}, {dest}) =>
		path.resolve(dest.web, id, `${width}.${ext}`),
};

const getPhotoMeta = async (id, options) => {
	let meta = {};
	try {
		const filePath = formatPath.meta(id, options);
		if (fs.existsSync(filePath)) {
			meta = await fs.readJson(filePath);
		}
	} catch (error) {
		reporter.error(`Couldn't get photo metadata`, error);
	}

	return meta;
};

const updatePhotoMeta = ({id, ...payload}, options) => {
	const meta = getPhotoMeta(id, options);
	savePhotoMeta(_.merge({...meta, ...payload}), {options, force: true});
};

// Consider creating a queue for read/write operations.
// May not be a problem, but it could create hard-to-trace errors
const savePhotoMeta = async (meta, {options, force = false} = {}) => {
	const filePath = formatPath.meta(meta.id, options);
	if (fs.existsSync(filePath) && !force) {
		reporter.warning(
			`Cannot save metadata file`,
			`${filePath} already exists`,
			`To force overwrite, call with truthy second argument`
		);
		return;
	}

	await fs.ensureDir(path.parse(filePath).dir);
	await fs.writeJSON(filePath, meta, {spaces: 2});
};

module.exports = {
	formatPath,
	getPhotoMeta,
	savePhotoMeta,
	updatePhotoMeta,
};
