const Redux = require('redux');
const _ = require('lodash');

const reducer = (state, action) => {
	switch (action.type) {
		case 'ADD_LOG': {
			return {
				...state,
				logs: [...state.logs, action.payload],
			};
		}

		case 'UPDATE_LOG': {
			const {id, ...payload} = action.payload;
			return {
				...state,
				logs: state.logs.map(log => {
					if (id !== log.id) {
						return log;
					}

					return {
						...log,
						...payload,
					};
				}),
			};
		}

		default:
			return state;
	}
};

const store = Redux.createStore(reducer, {logs: []});

function getLog(id, state) {
	if (!state) {
		state = store.getState();
	}

	return _.find(state.logs, o => o.id === id);
}

const stateChangeListeners = new Set();

const intrface = {
	getLog,
	getStore: () => store,
	dispatch: action => {
		if (!action) {
			return;
		}

		store.dispatch(action);
		for (const fn of stateChangeListeners) {
			fn(action);
		}
	},
	onStateChange: fn => {
		stateChangeListeners.add(fn);
		return () => {
			stateChangeListeners.delete(fn);
		};
	},
};

const actions = {
	createLog: ({id, ...payload}) => {
		const existingLog = getLog(id);
		if (existingLog) {
			throw new Error(`Can't create log with id "${id}": id already exists`);
		}

		return {
			type: 'ADD_LOG',
			payload: {
				id: id || _.uniqueId('task'),
				startTime: process.hrtime(),
				...payload,
			},
		};
	},
	updateLog: ({id, ...rest}) => {
		const log = getLog(id);
		if (!log) {
			return null;
		}

		return {
			type: 'UPDATE_LOG',
			payload: {
				id,
				...rest,
			},
		};
	},
	createMessage: ({text, status}) => {
		return actions.createLog({
			type: 'message',
			status,
			text,
		});
	},
	createSequence: ({current, ...rest}) => {
		return actions.createLog({
			type: 'sequence',
			status: 'pending',
			current: current || 0,
			...rest,
		});
	},
	updateSequence: ({id, add, ...rest}) => {
		const log = getLog(id);
		if (!log) {
			return null;
		}

		let total = rest.total || log.total || 0;
		if (add) {
			total += add;
		}

		return {
			type: 'UPDATE_LOG',
			payload: {
				id,
				...rest,
				total,
			},
		};
	},
	completeSequence: id => {
		const log = getLog(id);
		if (!log) {
			return null;
		}

		return {
			type: 'UPDATE_LOG',
			payload: {
				id,
				current: log.total,
				status: 'complete',
			},
		};
	},
	tick: (id, n = 1) => {
		const log = getLog(id);
		if (!log) {
			return null;
		}

		return {
			type: 'UPDATE_LOG',
			payload: {
				id,
				current: log.current + n,
			},
		};
	},
};

module.exports = {
	actions: Redux.bindActionCreators(actions, intrface.dispatch),
	...intrface,
};
