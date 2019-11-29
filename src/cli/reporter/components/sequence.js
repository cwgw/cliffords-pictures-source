import React from 'react';
import PropTypes from 'prop-types';
import {Box, Color} from 'ink';
import Spinner from 'ink-spinner';

const Sequence = ({text, prefixText, current, total, status}) => {
	const steps = <Color gray>[{total ? current + '/' + total : ''}]</Color>;
	const spinner =
		status === 'complete' ? (
			<Color green>✓</Color>
		) : status === 'static' ? (
			<Color gray>✓</Color>
		) : (
			<Color gray>
				<Spinner type="dots" />
			</Color>
		);
	const label = <Box textWrap="truncate-start">{text}</Box>;
	const prefix =
		status === 'static' ? <Color gray>{prefixText}</Color> : prefixText;

	return (
		<Box>
			{prefix} {spinner} {steps} {label}
		</Box>
	);
};

Sequence.propTypes = {
	current: PropTypes.number.isRequired,
	prefixText: PropTypes.string.isRequired,
	status: PropTypes.string.isRequired,
	text: PropTypes.string.isRequired,
	total: PropTypes.number,
};

Sequence.defaultProps = {
	total: null,
};

export default Sequence;
