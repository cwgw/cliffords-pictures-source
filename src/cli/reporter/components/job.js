import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'ink';
import Spinner from 'ink-spinner';
import _isNil from 'lodash/isNil';
import _partition from 'lodash/partition';

import Log from './log';
import ProgressBar from './progress';
import Color from './color';

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
  notes,
  status,
  text,
  timestamp
}) => {
  const isParent = jobs && jobs.length > 0;
  const pipe = isChild ? (
    <Color gray>
      {indent}
      {isLast ? '└' : '├'}─{isParent ? '┬' : '─'}
    </Color>
  ) : (
    <Color gray>{isParent ? '╤' : '═'}</Color>
  );
  const elapsedTime = <Color gray>{formatDuration(duration)}</Color>;
  const success =
    status === 'complete' ? <Color green>✔</Color> : <Color yellow>✘</Color>;

  let suffix = null;
  if (notes && notes.length > 0) {
    suffix = notes.map(([text, color = 'gray']) => (
      <React.Fragment key={text + color}>
        <Box marginRight={1}>
          <Color color="gray">──</Color>
        </Box>
        <Color color={color}>{text}</Color>
      </React.Fragment>
    ));
  }

  return (
    <>
      <Log timestamp={timestamp} color={isChild ? undefined : 'whiteBright'}>
        {pipe} {success} {elapsedTime} {text} {suffix}
      </Log>
      {jobs &&
        jobs.map(({id, ...job}, i, array) => (
          <Complete
            key={id}
            isChild
            indent={isChild ? indent + (isLast ? '  ' : '│ ') : ''}
            isLast={i + 1 === array.length}
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
  notes: PropTypes.array,
  status: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  timestamp: PropTypes.string.isRequired
};

Complete.defaultProps = {
  indent: '',
  isChild: false,
  isLast: false,
  notes: []
};

const Pending = ({timestamp, text, allJobs}) => {
  let progress = null;
  if (allJobs.length > 0) {
    const [complete, pending] = _partition(
      allJobs,
      (o) => o.status === 'complete'
    );
    const message = pending.length > 0 ? pending[pending.length - 1].text : '';
    progress = (
      <ProgressBar
        current={complete.length}
        total={allJobs.length}
        message={message}
      />
    );
  }

  return (
    <Log timestamp={timestamp}>
      <Box marginRight={1}>
        <Spinner type="dots" />
      </Box>
      <Box marginRight={1}>{text}</Box>
      {progress}
    </Log>
  );
};

Pending.propTypes = {
  allJobs: PropTypes.array,
  text: PropTypes.string.isRequired,
  timestamp: PropTypes.string.isRequired
};

Pending.defaultProps = {
  allJobs: []
};

export default {
  Complete,
  Pending
};
