const uuid = require('uuid/v4');
const _ = require('lodash');
const convertHrtime = require('convert-hrtime');
const {createStore, bindActionCreators} = require('redux');

const ADD_ACTIVE_LOG = 'ADD_ACTIVE_LOG';
const REMOVE_ACTIVE_LOG = 'REMOVE_ACTIVE_LOG';
const ADD_STATIC_LOG = 'ADD_STATIC_LOG';
const ADD_JOB = 'ADD_JOB';
const REMOVE_JOB = 'REMOVE_JOB';
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
			// Console.log(payload)
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

		case REMOVE_JOB: {
			const {id} = action.payload;
			const jobs = {...state.jobs};
			delete jobs[id];
			return {
				...state,
				jobs,
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
		if (getStaticLog(id)) {
			return {
				type: ADD_STATIC_LOG,
				payload: {
					id: uuid(),
					timestamp: new Date().toLocaleTimeString('en-US'),
					type: 'message',
					status: 'warning',
					text: 'Attempting to add duplicate static logs',
				},
			};
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
			actionsToEmit.push({
				type: UPDATE_JOB,
				payload: {
					id: parent,
					jobs: [...jobs, id],
				},
			});
		}

		return actionsToEmit;
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
			return {
				type: ADD_STATIC_LOG,
				payload: {
					id: uuid(),
					type: 'message',
					status: 'warning',
					text: [`trying to complete non-existent job`, id],
				},
			};
		}

		const payload = {
			...job,
			status: 'complete',
			duration: getElapsedTime(job),
		};

		if (job.parent) {
			return {type: UPDATE_JOB, payload};
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
	return store.getState().jobs[id];
}

function getActiveLog(id) {
	return _.find(store.getState().logs.active, o => o.id === id);
}

function getStaticLog(id) {
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
