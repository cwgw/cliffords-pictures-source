import React from 'react';
import PropTypes from 'prop-types';
import {Box, Color} from 'ink';
import Spinner from 'ink-spinner';
import _isNil from 'lodash/isNil';

import Log from './log';

function formatDuration(duration) {
	if (_isNil(duration)) {
		return '';
	}

	let [int, dec] = duration.toString().split('.');
	dec = dec || '0';
	return `${int.padStart(2, '0')}.${dec.padEnd(2, '0')}s`;
}

const Complete = ({
	duration,
	indent,
	isChild,
	isLast,
	jobs,
	status,
	text,
	timestamp,
}) => {
	const isParent = jobs && jobs.length > 0;
	const pipe = isChild ? (
		<Color gray>
			{indent}
			{isLast ? '└' : '├'}─{isParent ? '┬' : '─'}
		</Color>
	) : (
		<Color gray>╤</Color>
	);
	const elapsedTime = <Color gray>{formatDuration(duration)}</Color>;
	const success =
		status === 'complete' ? <Color green>✔</Color> : <Color yellow>✘</Color>;

	return (
		<>
			<Log timestamp={timestamp} color={isChild ? undefined : 'whiteBright'}>
				{pipe} {success} {elapsedTime} {text}
			</Log>
			{jobs &&
				jobs.map(({id, ...job}, i, arr) => (
					<Complete
						key={id}
						isChild
						indent={isChild ? indent + (isLast ? '  ' : '│ ') : ''}
						isLast={i + 1 === arr.length}
						{...job}
					/>
				))}
		</>
	);
};

Complete.propTypes = {
	duration: PropTypes.number.isRequired,
	indent: PropTypes.string,
	isChild: PropTypes.bool,
	isLast: PropTypes.bool,
	jobs: PropTypes.array.isRequired,
	status: PropTypes.string.isRequired,
	text: PropTypes.string.isRequired,
	timestamp: PropTypes.string.isRequired,
};

Complete.defaultProps = {
	indent: '',
	isChild: false,
	isLast: false,
};

const Pending = ({text}) => {
	return (
		<Log timestamp={new Date().toLocaleTimeString('en-US')}>
			<Spinner type="dots" /> <Box textWrap="truncate-start">{text}</Box>
		</Log>
	);
};

Pending.propTypes = {
	text: PropTypes.string.isRequired,
};

export default {
	Complete,
	Pending,
};
