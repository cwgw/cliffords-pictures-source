/* eslint-disable import/no-unassigned-import */
/* eslint-disable unicorn/no-process-exit */

const uuid = require('uuid/v4');
const {actions} = require('./state');
require('./ui');

const message = status => (...args) =>
	actions.createMessage({text: args, status});

function Job(text, parent, root) {
	const id = uuid();
	actions.createJob({id, text, parent, root});

	return {
		add: text => new Job(text, id, root || id),
		start: () => {
			actions.beginJob(id);
		},
		update: payload => {
			if (typeof payload === 'string') {
				actions.updateJob({id, text: `${text} ==> ${payload}`});
			} else {
				actions.updateJob(payload);
			}
		},
		finish: () => {
			actions.completeJob(id);
		},
	};
}

module.exports = {
	log: message('log'),
	info: message('info'),
	success: message('success'),
	warning: message('warning'),
	error: message('error'),
	panic: (...args) => {
		message('error')(...args);
		process.exit(1);
	},
	exit: (...args) => {
		message('info')(...args);
		process.exit();
	},
	addJob: text => new Job(text),
};
