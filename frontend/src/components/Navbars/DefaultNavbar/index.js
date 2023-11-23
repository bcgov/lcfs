import React, { useState, useEffect } from "react";
import Logout from '../../Logout'

// react-router components
import { Link } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @mui material components
import { Icon, AppBar, Divider } from '@mui/material';

// BCGov Dashboard React components
import BCBox from "components/BCBox";
import BCTypography from "components/BCTypography";

// BCGov Dashboard React example components
import DefaultNavbarLink from "components/Navbars/DefaultNavbar/DefaultNavbarLink";
import DefaultNavbarMobile from "components/Navbars/DefaultNavbar/DefaultNavbarMobile";

// BCGov Dashboard React base styles
import breakpoints from "assets/theme/base/breakpoints";

// Images & Icons
import logoDark from 'assets/images/gov3_bc_logo.png'
import logoLight from 'assets/images/BCID_H_rgb_pos.png'

// Nav Links
const links = [
  { icon: "home", name: "Dashboard", route: "/dashboard" },
  { icon: "folder", name: "document", route: "/document" },
  { icon: "account_balance", name: "Transactions", route: "/transactions" },
  { icon: "assessment", name: "Compliance Report", route: "/compliance-report" },
  { icon: "corporate_fare", name: "organization", route: "/organizations" },
];

function DefaultNavbar() {
  const [showBalance, setShowBalance] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const toggleBalanceVisibility = () => {
    setShowBalance(!showBalance); // Toggles the visibility of the balance
  };

  const [mobileNavbar, setMobileNavbar] = useState(false);
  const [mobileView, setMobileView] = useState(false);

  const openMobileNavbar = ({ currentTarget }) => setMobileNavbar(currentTarget.parentNode);
  const closeMobileNavbar = () => setMobileNavbar(false);

  useEffect(() => {
    // A function that sets the display state for the DefaultNavbarMobile.
    function displayMobileNavbar() {
      if (window.innerWidth < breakpoints.values.lg) {
        setMobileView(true);
        setMobileNavbar(false);
      } else {
        setMobileView(false);
        setMobileNavbar(false);
      }
    }
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 0) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    /** 
     The event listener that's calling the displayMobileNavbar function when 
     resizing the window.
    */
    window.addEventListener("resize", displayMobileNavbar);
    window.addEventListener("scroll", handleScroll);
    // Call the displayMobileNavbar function to set the state with the initial value.
    displayMobileNavbar();

    // Remove event listener on cleanup
    return () => {
      window.removeEventListener("resize", displayMobileNavbar);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <AppBar position="sticky" color={isScrolled ? "transparent" : "inherit"} elevation={0} >
        <BCBox flexDirection="column" display="flex" color="transparent" >
          <BCBox
            py={0}
            px={{ xs: 4, sm: 3, lg: 2 }}
            my={0}
            // mx={1}
            width="100%"
            height="80px"
            borderRadius={mobileView ? "sm" : "lg"}
            shadow={"md"}
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            position="relative"
            left={0}
            zIndex={3}
            sx={({
              palette: { transparent: transparentColor, white, background, primary },
              functions: { rgba },
            }) => ({
              backgroundColor: (isScrolled
                ? transparentColor.main
                : (isScrolled ? white.main : rgba(primary.nav, 1))),
              backdropFilter: `saturate(200%) blur(30px)`,
              color: (isScrolled ? primary.main : white.main),
            })}
          >
            <BCBox
              component={Link}
              to="/"
              py={2}
              lineHeight={1}
              pl={{ xs: 0, lg: 1 }}
              display={"flex"}
              alignItems={"center"}
            >
              <img src={isScrolled ? logoLight : logoDark} alt="BC Government" style={{ width: "160px", marginRight: "10px", height: "auto" }} />
              {!mobileView && <BCTypography variant="h3" fontWeight="bold" color={isScrolled ? "primary" : "white"}>
                Low Carbon Fuel Standard
              </BCTypography>}
            </BCBox>
            <BCBox color="inherit" display={{ xs: "none", lg: "flex" }} m={0} py={1} flexDirection="column">
              <BCTypography className="organization_name" variant="body1" color="inherit" align="right">
                Organization Name
              </BCTypography>
              <div className="organization_balance">
                Balance:{" "}
                <div style={{ display: "inline-flex", alignItems: "center" }}>
                  {showBalance && <div className="balance">1000</div>}
                  <Icon style={{ fontSize: 20, cursor: "pointer", margin: "5px" }} onClick={toggleBalanceVisibility}>
                    {showBalance ? "visibility" : "visibility_off"}
                  </Icon>
                </div>
              </div>
            </BCBox>
            <BCBox
              display={{ xs: "inline-block", lg: "none" }}
              lineHeight={0}
              py={1.5}
              pl={1.5}
              color="inherit"
              sx={{ cursor: "pointer" }}
              onClick={openMobileNavbar}
            >
              <Icon fontSize="default">{mobileNavbar ? "close" : "menu"}</Icon>
            </BCBox>
          </BCBox>
          <Divider orientation="vertical" flexItem sx={({ palette: { secondary } }) => ({ backgroundColor: secondary.main, padding: "1px" })} />
          {!mobileView &&
            <BCBox display="flex"
              flexDirection="row"
              alignItems="center"
              py={0}
              px={{ xs: 4, sm: 3, lg: 2 }}
              my={0}
              // mx={1}
              width="100%"
              height="auto"
              borderRadius={mobileView ? "sm" : "lg"}
              shadow={"md"}
              position="relative"
              left={0}
              zIndex={3}
              sx={({
                palette: { transparent: transparentColor, white, background, primary, secondary },
                functions: { rgba },
              }) => ({
                backgroundColor: (isScrolled
                  ? transparentColor.main
                  : (isScrolled ? white.main : rgba(secondary.nav, 1))),
                backdropFilter: `saturate(200%) blur(30px)`,
                color: (isScrolled ? secondary.main : white.main),
              })}
            >
              {links.map((link) => (
                <>
                  <DefaultNavbarLink key={link.name} icon={link.icon} name={link.name} route={link.route} light={isScrolled} />
                  <Divider orientation="vertical" variant="middle" flexItem sx={({ palette: { secondary } }) => ({ backgroundColor: secondary.main })} />
                </>
              ))}
              <Logout/>
            </BCBox>
            }
          {mobileView && <DefaultNavbarMobile open={mobileNavbar} close={closeMobileNavbar} light={true} links={links} />}
        </BCBox>
      </AppBar>
    </>
  );
}

// Setting default values for the props of DefaultNavbar
DefaultNavbar.defaultProps = {
  // light: false,
};

// Typechecking props for the DefaultNavbar
DefaultNavbar.propTypes = {
  // light: PropTypes.bool,
};

export default DefaultNavbar;
