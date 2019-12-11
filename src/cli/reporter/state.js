const uuid = require('uuid/v4');
const _ = require('lodash');
const convertHrtime = require('convert-hrtime');
const {createStore, bindActionCreators, applyMiddleware} = require('redux');
const thunk = require('redux-thunk').default;

const ADD_ACTIVE_LOG = 'ADD_ACTIVE_LOG';
const REMOVE_ACTIVE_LOG = 'REMOVE_ACTIVE_LOG';
const UPDATE_ACTIVE_LOG = 'UPDATE_ACTIVE_LOG';
const ADD_STATIC_LOG = 'ADD_STATIC_LOG';
const ADD_JOB = 'ADD_JOB';
const UPDATE_JOB = 'UPDATE_JOB';

const initialState = {
  jobs: {},
  logs: {
    active: [],
    static: []
  }
};

const reducer = (state, action) => {
  switch (action.type) {
    case ADD_ACTIVE_LOG: {
      const {payload} = action;
      return {
        ...state,
        logs: {
          ...state.logs,
          active: [...state.logs.active, payload]
        }
      };
    }

    case REMOVE_ACTIVE_LOG: {
      const {id} = action.payload;
      return {
        ...state,
        logs: {
          ...state.logs,
          active: state.logs.active.filter(o => o.id !== id)
        }
      };
    }

    case UPDATE_ACTIVE_LOG: {
      const {id, ...payload} = action.payload;
      return {
        ...state,
        logs: {
          ...state.logs,
          active: state.logs.active.map(o =>
            o.id === id ? _.merge({}, o, payload) : o
          )
        }
      };
    }

    case ADD_STATIC_LOG: {
      const {payload} = action;
      return {
        ...state,
        logs: {
          ...state.logs,
          static: [...state.logs.static, payload]
        }
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
            ...payload
          }
        }
      };
    }

    case UPDATE_JOB: {
      const {id, ...payload} = action.payload;
      const job = state.jobs[id];
      return {
        ...state,
        jobs: {
          ...state.jobs,
          [id]: _.merge({}, job, payload)
        }
      };
    }

    default:
      return state;
  }
};

const store = createStore(reducer, initialState, applyMiddleware(thunk));

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
  addActiveLog: id => {
    const job = getJob(id);
    return {
      type: ADD_ACTIVE_LOG,
      payload: {
        type: 'job',
        ...denormalizeJob(job)
      }
    };
  },
  updateActiveLog: ({id, ...payload}) => {
    return (dispatch, getState) => {
      const job = getJob(id, getState);
      dispatch({
        type: UPDATE_ACTIVE_LOG,
        payload: denormalizeJob(
          _.merge({}, job, {
            ...payload,
            timestamp: new Date().toLocaleTimeString('en-US')
          }),
          getState
        )
      });
    };
  },
  removeActiveLog: id => {
    if (!getActiveLog(id)) {
      return null;
    }

    return {
      type: REMOVE_ACTIVE_LOG,
      payload: {id}
    };
  },
  addStaticLog: ({id, ...payload}) => {
    // Static logs must be unique
    if (getStaticLog(id)) {
      return actions.createMessage({
        status: 'warning',
        text: 'Attempting to add duplicate static log'
      });
    }

    return {
      type: ADD_STATIC_LOG,
      payload: {
        id: id || uuid(),
        timestamp: new Date().toLocaleTimeString('en-US'),
        ...payload
      }
    };
  },
  createMessage: payload => {
    return actions.addStaticLog({
      type: 'message',
      ...payload
    });
  },
  createJob: ({id, text, parent = null, root = null}) => {
    if (!id) {
      id = uuid();
    }

    const payload = {
      id,
      type: 'job',
      startTime: process.hrtime(),
      timestamp: new Date().toLocaleTimeString('en-US'),
      text,
      parent,
      root,
      status: 'started',
      jobs: [],
      completed: []
    };

    const actionsToEmit = [{type: ADD_JOB, payload}];

    if (parent) {
      const {jobs} = getJob(parent);
      actionsToEmit.push(
        actions.updateJob({
          id: parent,
          jobs: [...jobs, id]
        })
      );
    }

    if (root) {
      const {allJobs} = getJob(root);
      actionsToEmit.push(
        actions.updateJob({
          id: root,
          allJobs: [...(allJobs || []), id]
        })
      );
    }

    return actionsToEmit;
  },
  updateJob: ({id, ...payload}) => {
    const job = getJob(id);

    if (!job) {
      return actions.createMessage({
        status: 'warning',
        text: `Attempting to update a job that doesn't exist`
      });
    }

    const actionsToEmit = [
      {
        type: UPDATE_JOB,
        payload: {id, ...payload}
      }
    ];

    if (getActiveLog(id)) {
      actionsToEmit.push(actions.updateActiveLog({id}));
    }

    return actionsToEmit;
  },
  beginJob: id => actions.addActiveLog(id),
  completeJob: id => {
    const job = getJob(id);

    if (!job) {
      return actions.createMessage({
        status: 'warning',
        text: [`trying to complete non-existent job`, id]
      });
    }

    const payload = {
      ...job,
      status: 'complete',
      duration: getElapsedTime(job)
    };

    if (job.parent) {
      return actions.updateJob(payload);
    }

    return [
      actions.removeActiveLog(id),
      actions.addStaticLog(denormalizeJob(payload))
    ];
  }
};

function getJob(id, getState = store.getState) {
  return id && getState().jobs[id];
}

function getActiveLog(id, getState = store.getState) {
  return id && _.find(getState().logs.active, o => o.id === id);
}

function getStaticLog(id, getState = store.getState) {
  return id && _.find(getState().logs.static, o => o.id === id);
}

function denormalizeJob(job, getState = store.getState) {
  if (typeof job === 'string') {
    job = getJob(job, getState);
  }

  if (!job) {
    return {};
  }

  const clone = {...job};
  const keys = ['jobs', 'allJobs'];

  for (const key of keys) {
    clone[key] = [];
    if (!_.isNil(job[key]) && !_.isEmpty(job[key])) {
      clone[key] = job[key].reduce((arr, o) => {
        return [...arr, denormalizeJob(o)];
      }, []);
    }
  }

  return clone;
}

function getElapsedTime({startTime}) {
  const elapsed = process.hrtime(startTime);
  return _.round(convertHrtime(elapsed).seconds, 2);
}

module.exports = {
  actions: bindActionCreators(actions, dispatch),
  store
};
