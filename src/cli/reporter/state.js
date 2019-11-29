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

		case 'MAKE_LOG_STATIC': {
			let log;
			const {id, ...payload} = action.payload;
			const logs = state.logs.filter(o => {
				if (o.id === id) {
					log = o;
					return false;
				}

				return true;
			});
			return {
				logs,
				staticLogs: [
					...state.staticLogs,
					{
						...log,
						...payload,
					},
				],
			};
		}

		case 'ADD_STATIC_LOG': {
			return {
				...state,
				staticLogs: [
					...state.staticLogs,
					{
						...action.payload,
					},
				],
			};
		}

		default:
			return state;
	}
};

const store = Redux.createStore(reducer, {logs: [], staticLogs: []});

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

		let actions = action;
		if (!Array.isArray(actions)) {
			actions = [action];
		}

		actions.forEach(a => {
			store.dispatch(a);
			for (const fn of stateChangeListeners) {
				fn(a);
			}
		});
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
				id: id || _.uniqueId('log'),
				startTime: process.hrtime(),
				...payload,
			},
		};
	},
	createStaticLog: ({id, ...payload}) => {
		return {
			type: 'ADD_STATIC_LOG',
			payload: {
				id: id || _.uniqueId('staticLog'),
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
		return actions.createStaticLog({
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
			type: 'MAKE_LOG_STATIC',
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

		const payload = {
			id,
			current: log.current + n,
		};

		return [
			{
				type: 'ADD_STATIC_LOG',
				payload: {
					...log,
					...payload,
					status: 'static',
				},
			},
			{
				type: 'UPDATE_LOG',
				payload,
			},
		];
	},
};

module.exports = {
	actions: Redux.bindActionCreators(actions, intrface.dispatch),
	...intrface,
};
