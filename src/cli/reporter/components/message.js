import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'ink';

import Log from './log';

const Message = ({text, timestamp, status}) => {
	return (
		<Log color={status} prefix={status} timestamp={timestamp}>
			<Box
				textWrap="truncate-middle"
				flexDirection="column"
				justifyContent="flex-start"
			>
				{text}
			</Box>
		</Log>
	);
};

Message.propTypes = {
	status: PropTypes.string.isRequired,
	text: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
	timestamp: PropTypes.string.isRequired,
};

export default Message;
