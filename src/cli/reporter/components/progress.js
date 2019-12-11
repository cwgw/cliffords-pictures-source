import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'ink';

/** Taken right from gatsby-cli */

const maxWidth = 30;
const minWidth = 10;

const getLength = prop => String(prop).length;

const ProgressBar = ({message, current, total}) => {
	const percentage = total ? Math.round((current / total) * 100) : 0;
	const terminalWidth = process.stdout.columns || 80;
	const availableWidth =
		terminalWidth -
		getLength(message) -
		getLength(current) -
		getLength(total) -
		getLength(percentage) -
		11; // Margins + extra characters

	const progressBarWidth = Math.max(
		minWidth,
		Math.min(maxWidth, availableWidth)
	);

	return (
		<Box flexDirection="row">
			<Box marginRight={3} width={progressBarWidth}>
				[
				<Box width={progressBarWidth - 2}>
					{`=`.repeat(((progressBarWidth - 2) * percentage) / 100)}
				</Box>
				]
			</Box>
			<Box marginRight={1}>
				{current}/{total}
			</Box>
			<Box marginRight={1}>{String(percentage)}%</Box>
			<Box textWrap="truncate">{message}</Box>
		</Box>
	);
};

ProgressBar.propTypes = {
	message: PropTypes.string.isRequired,
	current: PropTypes.number.isRequired,
	total: PropTypes.number.isRequired,
};

export default ProgressBar;
