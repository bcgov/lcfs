import { forwardRef } from "react";
import PropTypes from "prop-types";
import BCButtonRoot from "./BCButtonRoot";

const BCButton = forwardRef(
  ({ color, variant, size, circular, iconOnly, children, ...rest }, ref) => {

    return (
      <BCButtonRoot
        {...rest}
        ref={ref}
        color="primary"
        variant={variant === "gradient" ? "contained" : variant}
        size={size}
        ownerState={{ color, variant, size, circular, iconOnly }}
      >
        {children}
      </BCButtonRoot>
    );
  }
);

// Setting default values for the props of BCButton
BCButton.defaultProps = {
  size: "medium",
  variant: "contained",
  color: "white",
  circular: false,
  iconOnly: false,
  darkMode: "light",
};

// Typechecking props for the BCButton
BCButton.propTypes = {
  size: PropTypes.oneOf(["small", "medium", "large"]),
  variant: PropTypes.oneOf(["text", "contained", "outlined", "gradient"]),
  color: PropTypes.oneOf([
    "white",
    "primary",
    "secondary",
    "info",
    "success",
    "warning",
    "error",
    "light",
    "dark",
  ]),
  circular: PropTypes.bool,
  iconOnly: PropTypes.bool,
  children: PropTypes.node.isRequired,
  darkMode: PropTypes.oneOf(["light", "dark"]),
};

export default BCButton;
