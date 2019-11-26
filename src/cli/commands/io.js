const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');

const reporter = require('../reporter');

const formatPath = {
	meta: (id, {dest}) => 
		path.resolve(dest.data, id, `data.json`),
	webImage: ({id, width, ext}, {dest}) =>
		path.resolve(dest.data, id, `${width}.${ext}`),
};

const getPhotoMeta = async (id, config) => {
	let meta = {};
	try {
		const filePath = formatPath.meta(id, config);
		if (fs.existsSync(filePath)) {
			meta = await fs.readJson(filePath);
		}
	} catch (error) {
		reporter.error(`Couldn't get photo metadata`, error);
	}

	return meta;
};

const updatePhotoMeta = ({id, ...payload}, config) => {
	const meta = getPhotoMeta(id, config);
	savePhotoMeta(_.merge({...meta, ...payload}), {config, force: true});
};

// Consider creating a queue for read/write operations.
// May not be a problem, but it could create hard-to-trace errors
const savePhotoMeta = async (meta, {config, force = false} = {}) => {
	const filePath = formatPath.meta(meta.id, config);
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
