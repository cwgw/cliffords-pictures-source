const PQueue = require('p-queue').default;
const uuid = require('uuid/v4');
const _ = require('lodash');
const reporter = require('../reporter');

const queue = new PQueue({concurrency: 8});

function Job(text, pendingWork, parent) {
	const id = uuid();
	reporter.createJob({id, text, parent});

	if (!_.isNil(pendingWork)) {
		queue.add(async () => {
			reporter.beginJob(id);
			await pendingWork;
			reporter.completeJob(id);
		});
	}

	return {
		add: (text, pendingWork) => {
			return new Job(text, pendingWork, id);
		},
		finish: () => {
			reporter.closeJob(id);
		},
	};
}

module.exports = {
	add: (text, pendingWork) => new Job(text, pendingWork),
};
