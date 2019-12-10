import React from 'react';
import {Provider, connect} from 'react-redux';
import {render, Box, Static} from 'ink';

import _ from 'lodash';
import {store} from './state';

import Message from './components/message';
import Job from './components/job';

const renderLog = ({type, ...log}) => {
	switch (type) {
		case 'job':
			if (log.status === 'complete') {
				return <Job.Complete key={type + log.status + log.id} {...log} />;
			}

			return <Job.Pending key={type + log.status + log.id} {...log} />;
		case 'message':
		default:
			return <Message key={type + log.status + log.id} {...log} />;
	}
};

const Logs = ({logs}) => {
	return (
		<Box flexDirection="column" width="100%">
			<Static>{logs.static.map(renderLog)}</Static>
			{logs.active.length > 0 ? (
				<>
					{`\n`}
					{logs.active.map(renderLog)}
				</>
			) : null}
		</Box>
	);
};

const ConnectedLogs = connect(state => ({logs: state.logs}))(Logs);

class Ui extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
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
