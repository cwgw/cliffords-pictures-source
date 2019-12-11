import React from 'react';
import PropTypes from 'prop-types';
import {Box} from 'ink';

import Color from './color';

const propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.string,
    PropTypes.array
  ]).isRequired,
  color: PropTypes.string,
  strong: PropTypes.bool,
  timestamp: PropTypes.string.isRequired,
  prefix: PropTypes.string
};

const defaultProps = {
  color: 'gray',
  prefix: null,
  strong: false
};

const Log = ({timestamp, children, color, prefix, strong}) => {
  return (
    <Box textWrap="wrap" flexDirection="row" alignItems="flex-start">
      <Color color={color} inverse={strong}>
        {[timestamp, '░', prefix].join(' ').trim()}
      </Color>
      <Box marginX={1}>{children}</Box>
    </Box>
  );
};

Log.propTypes = propTypes;

Log.defaultProps = defaultProps;

export default Log;
