/* eslint-disable import/no-unassigned-import */
/* eslint-disable unicorn/no-process-exit */
const _ = require('lodash');
const {actions} = require('./state');
require('./ui');

const message = (text, status) => actions.createMessage({text, status});

module.exports = {
	log: (...args) => message(args, 'log'),
	info: (...args) => message(args, 'info'),
	success: (...args) => message(args, 'success'),
	warning: (...args) => message(args, 'warning'),
	error: (...args) => message(args, 'error'),
	panic: (...args) => {
		message(args, 'error');
		process.exit(1);
	},
	sequence: payload => {
		const id = _.uniqueId(`sequence-`);
		actions.createSequence({id, ...payload});
		return {
			update: data => {
				if (typeof data === 'string') {
					actions.updateSequence({id, text: data});
				} else {
					actions.updateSequence({id, ...data});
				}
			},
			step: n => {
				actions.tick(id, n);
			},
			succeed: () => {
				actions.completeSequence(id);
			},
		};
	},
	getLog: id => actions.getLog(id),
};
