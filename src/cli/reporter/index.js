/* eslint-disable import/no-unassigned-import */
/* eslint-disable unicorn/no-process-exit */

const util = require('util');
const {v4: uuid} = require('uuid');
const PrettyError = require('pretty-error');
const {actions} = require('./state');

require('./ui');

const message = (status) => (...args) =>
  actions.createMessage({text: args, status});

function Job(text, parent, root) {
  const id = uuid();
  actions.createJob({id, text, parent, root});

  return {
    add: (text) => new Job(text, id, root || id),
    start: () => {
      actions.beginJob(id);
      return this;
    },
    note: (text, status) => {
      actions.updateJob({id, notes: [[text, status]]});
    },
    finish: () => {
      actions.completeJob(id);
    }
  };
}

const prettyError = new PrettyError();

const formatError = (error) => {
  if (Array.isArray(error)) {
    return error.map((error) => formatError(error));
  }

  if (
    util.types.isNativeError(error) ||
    error instanceof Error ||
    (error && error.message && error.stack)
  ) {
    return prettyError.render(error);
  }

  if (typeof error === 'object') {
    return error.toString();
  }

  return error;
};

module.exports = {
  log: message('log'),
  info: message('info'),
  success: message('success'),
  warn: message('warning'),
  error: (...args) => {
    message('error')(...formatError(args));
  },
  panic: (...args) => {
    message('error')(...formatError(args));
    process.exit(1);
  },
  exit: (...args) => {
    message('info')(...args);
    process.exit();
  },
  addJob: (text) => new Job(text)
};
