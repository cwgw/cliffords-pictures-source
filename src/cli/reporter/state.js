const uuid = require('uuid/v4');
const _ = require('lodash');
const convertHrtime = require('convert-hrtime');
const {createStore, bindActionCreators} = require('redux');

const ADD_ACTIVE_LOG = 'ADD_ACTIVE_LOG';
const REMOVE_ACTIVE_LOG = 'REMOVE_ACTIVE_LOG';
const ADD_STATIC_LOG = 'ADD_STATIC_LOG';
const ADD_JOB = 'ADD_JOB';
const UPDATE_JOB = 'UPDATE_JOB';

const initialState = {
	jobs: {},
	logs: {
		active: [],
		static: [],
	},
};

const reducer = (state, action) => {
	switch (action.type) {
		case ADD_ACTIVE_LOG: {
			const {payload} = action;
			return {
				...state,
				logs: {
					...state.logs,
					active: [...state.logs.active, payload],
				},
			};
		}

		case REMOVE_ACTIVE_LOG: {
			const {id} = action.payload;
			return {
				...state,
				logs: {
					...state.logs,
					active: state.logs.active.filter(o => o.id !== id),
				},
			};
		}

		case ADD_STATIC_LOG: {
			const {payload} = action;
			return {
				...state,
				logs: {
					...state.logs,
					static: [...state.logs.static, payload],
				},
			};
		}

		case ADD_JOB: {
			const {id, ...payload} = action.payload;
			return {
				...state,
				jobs: {
					...state.jobs,
					[id]: {
						id,
						...payload,
					},
				},
			};
		}

		case UPDATE_JOB: {
			const {id, ...payload} = action.payload;
			const job = state.jobs[id];
			return {
				...state,
				jobs: {
					...state.jobs,
					[id]: {
						...job,
						...payload,
					},
				},
			};
		}

		default:
			return state;
	}
};

const store = createStore(reducer, initialState);

function dispatch(action) {
	if (!action) {
		return;
	}

	if (Array.isArray(action)) {
		action.forEach(item => dispatch(item));
		return;
	}

	store.dispatch(action);
}

const actions = {
	removeActiveLog: id => {
		if (!getActiveLog(id)) {
			return null;
		}

		return {
			type: REMOVE_ACTIVE_LOG,
			payload: {id},
		};
	},
	addStaticLog: ({id, ...payload}) => {
		// Static logs must be unique
		if (getStaticLog(id)) {
			return actions.createMessage({
				status: 'warning',
				text: 'Attempting to add duplicate static log',
			});
		}

		return {
			type: ADD_STATIC_LOG,
			payload: {
				id: id || uuid(),
				timestamp: new Date().toLocaleTimeString('en-US'),
				...payload,
			},
		};
	},
	createMessage: payload => {
		return actions.addStaticLog({
			type: 'message',
			...payload,
		});
	},
	createJob: ({id, text, parent = null}) => {
		if (!id) {
			id = uuid();
		}

		const actionsToEmit = [
			{
				type: ADD_JOB,
				payload: {
					id,
					type: 'job',
					startTime: process.hrtime(),
					timestamp: new Date().toLocaleTimeString('en-US'),
					text,
					parent,
					status: 'started',
					jobs: [],
					completed: [],
				},
			},
		];

		if (parent) {
			const {jobs} = getJob(parent);
			actionsToEmit.push(
				actions.updateJob({
					id: parent,
					jobs: [...jobs, id],
				})
			);
		}

		return actionsToEmit;
	},
	updateJob: ({id, ...payload}) => {
		if (!getJob(id)) {
			return actions.createMessage({
				status: 'warning',
				text: `Attempting to update a job that doesn't exist`,
			});
		}

		return {
			type: UPDATE_JOB,
			payload: {id, ...payload},
		};
	},
	beginJob: id => {
		const job = getJob(id);
		return {
			type: ADD_ACTIVE_LOG,
			payload: {
				type: 'job',
				...job,
			},
		};
	},
	completeJob: id => {
		const job = getJob(id);

		if (!job) {
			return actions.createMessage({
				status: 'warning',
				text: [`trying to complete non-existent job`, id],
			});
		}

		const payload = {
			...job,
			status: 'complete',
			duration: getElapsedTime(job),
		};

		if (job.parent) {
			return actions.updateJob(payload);
		}

		return [
			{
				type: REMOVE_ACTIVE_LOG,
				payload: {id},
			},
			actions.addStaticLog(denormalizeJob(payload)),
		];
	},
};

function getJob(id) {
	if (!id) {
		return;
	}

	return store.getState().jobs[id];
}

function getActiveLog(id) {
	if (!id) {
		return;
	}

	return _.find(store.getState().logs.active, o => o.id === id);
}

function getStaticLog(id) {
	if (!id) {
		return;
	}

	return _.find(store.getState().logs.static, o => o.id === id);
}

function denormalizeJob(job) {
	if (typeof job === 'string') {
		job = getJob(job);
	}

	if (_.isEmpty(job.jobs)) {
		return {
			...job,
			jobs: [],
		};
	}

	return {
		...job,
		jobs: job.jobs.reduce((arr, jobId) => {
			return [...arr, denormalizeJob(jobId)];
		}, []),
	};
}

function getElapsedTime({startTime}) {
	const elapsed = process.hrtime(startTime);
	return _.round(convertHrtime(elapsed).seconds, 2);
}

module.exports = {
	actions: bindActionCreators(actions, dispatch),
	store,
};
