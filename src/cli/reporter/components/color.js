import React from 'react';
import PropTypes from 'prop-types';
import {Color as InkColor} from 'ink';

const statusColor = {
  success: 'green',
  warning: 'yellow',
  log: 'gray',
  info: 'cyan',
  error: 'red',
  panic: 'red'
};

const Color = ({color, children, ...props}) => {
  const colorProps = {...props};
  if (color) {
    colorProps[statusColor[color] || color] = true;
  }

  return <InkColor {...colorProps}>{children}</InkColor>;
};

Color.propTypes = {
  color: PropTypes.string,
  children: PropTypes.oneOfType([
    PropTypes.node,
    PropTypes.array,
    PropTypes.string
  ]).isRequired
};

Color.defaultProps = {
  color: null
};

export default Color;
