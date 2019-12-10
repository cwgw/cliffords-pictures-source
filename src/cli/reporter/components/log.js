import React from 'react';
import PropTypes from 'prop-types';
import {Box, Color} from 'ink';

const propTypes = {
	children: PropTypes.oneOfType([
		PropTypes.node,
		PropTypes.string,
		PropTypes.array,
	]).isRequired,
	color: PropTypes.string,
	strong: PropTypes.bool,
	timestamp: PropTypes.string.isRequired,
	prefix: PropTypes.string,
};

const defaultProps = {
	color: 'gray',
	prefix: null,
	strong: false,
};

const statusColor = {
	success: 'green',
	warning: 'yellow',
	log: 'gray',
	info: 'cyan',
	error: 'red',
	panic: 'red',
};

const Log = ({timestamp, children, color, prefix, strong}) => {
	const colorProps = {inverse: strong};
	if (color) {
		colorProps[statusColor[color] || color] = true;
	}

	return (
		<Box textWrap="wrap" flexDirection="row" alignItems="flex-start">
			<Color {...colorProps}>{[timestamp, '░', prefix].join(' ').trim()}</Color>
			<Box marginX={1}>{children}</Box>
		</Box>
	);
};

Log.propTypes = propTypes;

Log.defaultProps = defaultProps;

export default Log;
