import React from 'react';
import PropTypes from 'prop-types';

import {getStore, onStateChange} from './state';

const Context = React.createContext(getStore().getState());

const Provider = ({children}) => {
	const [state, setState] = React.useState(getStore().getState());

	React.useLayoutEffect(() => {
		const unsubscribe = onStateChange(() => {
			setState(getStore().getState());
		});
		return unsubscribe;
	}, []);

	return <Context.Provider value={state}>{children}</Context.Provider>;
};

Provider.propTypes = {
	children: PropTypes.node.isRequired,
};

export {Context as default, Provider};
