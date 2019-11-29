import React from 'react';
import {render, Box, Static} from 'ink';

import Context, {Provider} from './context';
import Message from './components/message';
import Sequence from './components/sequence';

const Ui = () => {
	const {logs, staticLogs} = React.useContext(Context);

	return (
		<Box flexDirection="column" width="100%">
			<Static>
				{staticLogs.map(({id, type, ...log}) => {
					switch (type) {
						case 'sequence':
							return <Sequence key={id} {...log} />;
						case 'message':
						default:
							return <Message key={id} {...log} />;
					}
				})}
			</Static>
			----------------
			{logs.map(({id, type, ...log}) => {
				switch (type) {
					case 'sequence':
						return <Sequence key={id} {...log} />;
					case 'message':
					default:
						return <Message key={id} {...log} />;
				}
			})}
		</Box>
	);
};

render(
	<Provider>
		<Ui />
	</Provider>
);
