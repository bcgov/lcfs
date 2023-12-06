export const numberFormatter = (params) => {
  if (params.value != null) {
    return params.value.toLocaleString(); // Use toLocaleString() to format numbers with commas
  }
  return params.value;
};