import React from 'react';
import {Box, Color} from 'ink';
import Spinner from 'ink-spinner';
import _isNil from 'lodash/isNil';

/**

<filename> <job> [<step>/<total>] <task text>: [<step>/<total>] <childTask text>

<startTime> <filename> <job>
<startTime>   [<step>/<total>] <duration>s <task text>
<startTime>   [<step>/<total>] <duration>s <task text>
<startTime>     [<step>/<total>] <duration>s <childTask text>
<startTime>     [<step>/<total>] <duration>s <childTask text>

*/

const formatDuration = duration => {
	if (_isNil(duration)) {
		return '';
	}

	let [int, dec] = duration.toString().split('.');
	dec = dec || '0';
	return `${int.padStart(2, '0')}.${dec.padEnd(2, '0')}s`;
};

const CompletedJobFragment = ({
	timestamp,
	duration,
	index,
	total,
	text,
	jobs,
	depth = 0,
}) => {
	const step = !_isNil(index) && !_isNil(total) ? `[${index}/${total}]` : null;
	return (
		<>
			<Box>
				<Box marginRight={depth * 3 + 1}>
					<Color gray bgKeyword={depth ? null : 'white'}>
						{` ${timestamp} `}
					</Color>{' '}
					{formatDuration(duration)}
				</Box>
				{step && (
					<Box marginRight={1}>
						<Color gray>{step}</Color>
					</Box>
				)}
				{text}
			</Box>
			{jobs &&
				jobs.map(({id, ...job}, i) => (
					<CompletedJobFragment
						key={id}
						depth={depth + 1}
						index={i + 1}
						total={jobs.length}
						{...job}
					/>
				))}
		</>
	);
};

const Job = job => {
	if (job.status === 'complete') {
		return (
			<Box flexDirection="column">
				<CompletedJobFragment {...job} />
			</Box>
		);
	}

	return (
		<Box>
			<Box marginRight={1}>
				<Spinner type="dots" />
			</Box>
			<Box marginRight={1}>{job.name}</Box>
			<Box textWrap="truncate-start">{job.text}</Box>
		</Box>
	);
};

export default Job;
