import React from 'react';
import BCBadge from 'components/BCBadge';
import BCBox from 'components/BCBox';

export default (props) => {
  const cellValue = props.valueFormatted ? props.valueFormatted : props.value;

  return (
    cellValue === 'Active' ?
      (
        <BCBox ml={2}>
          <BCBadge badgeContent="active" color="success" variant="gradient" size="sm" />
        </BCBox>) :
      (
        <BCBox ml={1.5}>
          <BCBadge badgeContent="inactive" color="dark" variant="gradient" size="sm" />
        </BCBox>
      )
  );
};