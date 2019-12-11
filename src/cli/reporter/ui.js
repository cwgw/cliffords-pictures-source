import React from 'react';
import PropTypes from 'prop-types';
import {Provider, connect} from 'react-redux';
import {render, Box, Static} from 'ink';

import {store} from './state';

import Message from './components/message';
import Job from './components/job';

const Logs = ({logs}) => {
  return (
    <Box flexDirection="column" width="100%">
      <Static>
        {logs.static.map(log => {
          switch (log.type) {
            case 'job':
              return <Job.Complete key={log.id} {...log} />;
            case 'message':
            default:
              return <Message key={log.id} {...log} />;
          }
        })}
      </Static>
      {logs.active.length > 0 ? (
        <>
          {`\n`}
          {logs.active.map(log => (
            <Job.Pending key={log.id} {...log} />
          ))}
        </>
      ) : null}
    </Box>
  );
};

Logs.propTypes = {
  logs: PropTypes.shape({
    active: PropTypes.array,
    static: PropTypes.array
  }).isRequired
};

const ConnectedLogs = connect(state => ({logs: state.logs}))(Logs);

class Ui extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return {hasError: true, error};
  }

  render() {
    const {hasError, error} = this.state;

    if (hasError) {
      return (
        <Box flexDirection="row">
          <Message
            timestamp={new Date().toLocaleTimeString('en-US')}
            status="error"
            text={[`Logger encountered an error`, error]}
          />
        </Box>
      );
    }

    return (
      <Provider store={store}>
        <ConnectedLogs />
      </Provider>
    );
  }
}

render(<Ui />);
