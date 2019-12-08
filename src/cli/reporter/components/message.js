import React from 'react';
import PropTypes from 'prop-types';
import {Box, Color} from 'ink';

const createLabel = (text, color) => (...props) => (
	<Color {...{[color]: true, ...props}}>{text.padEnd(8)}</Color>
);

const getLabel = status => {
	switch (status) {
		case 'success':
			return createLabel(`success`, `green`);
		case 'warning':
			return createLabel(`warning`, `yellow`);
		case 'log':
			return createLabel(`log`, `gray`);
		case 'info':
			return createLabel(`info`, `cyan`);
		case 'error':
		case 'panic':
			return createLabel(`error`, `red`);
		default:
			return createLabel('', `blue`);
	}
};

const Message = ({text, timestamp, status}) => {
	const TextLabel = getLabel(status);
	return (
		<Box textWrap="wrap" flexDirection="row" alignItems="flex-start">
			<Box marginRight={1}>
				<Color gray> {timestamp} </Color>
			</Box>
			<Box marginRight={1}>
				<TextLabel />
			</Box>
			<Box flexDirection="column" justifyContent="flex-start">
				{Array.isArray(text) ? text.join('\n') : text}
			</Box>
		</Box>
	);
};

Message.propTypes = {
	status: PropTypes.string.isRequired,
	text: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
};

export default Message;
