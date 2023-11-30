import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';
import { AppBar, Tabs, Tab, Icon, Button} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BCTypography from 'components/BCTypography';
import BCBox from 'components/BCBox';
import UserGrid from 'components/Table/DataGrid/UserGrid';
import breakpoints from "assets/theme/base/breakpoints";
import { CREATE_USER } from '../../constants/routes';
import AddIcon from '@mui/icons-material/Add';

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`full-width-tabpanel-${index}`}
      aria-labelledby={`full-width-tab-${index}`}
      {...other}
    >
      {value === index && (
        <BCBox sx={{ p: 3 }}>
          <BCTypography>{children}</BCTypography>
        </BCBox>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `full-width-tab-${index}`,
    'aria-controls': `full-width-tabpanel-${index}`,
  };
}

export default function UserTabPanel() {
  const demoData = [
    { name: 'John', role: 'Admin', email: 'john@example.com', phone: '555-1234', status: 'Active' },
    { name: 'Jane', role: 'Manager', email: 'jane@example.com', phone: '555-5678', status: 'Inactive' },
    { name: 'Bob', role: 'Employee', email: 'bob@example.com', phone: '555-9012', status: 'Active' },
    { name: 'Alice', role: 'Employee', email: 'alice@example.com', phone: '555-3456', status: 'Active' },
    { name: 'David', role: 'Employee', email: 'david@example.com', phone: '555-7890', status: 'Inactive' },
    { name: 'Emily', role: 'Employee', email: 'emily@example.com', phone: '555-2345', status: 'Active' },
    { name: 'Frank', role: 'Employee', email: 'frank@example.com', phone: '555-6789', status: 'Active' },
    { name: 'Grace', role: 'Employee', email: 'grace@example.com', phone: '555-0123', status: 'Inactive' },
    { name: 'Henry', role: 'Employee', email: 'henry@example.com', phone: '555-4567', status: 'Active' },
    { name: 'Isabel', role: 'Employee', email: 'isabel@example.com', phone: '555-8901', status: 'Active' },
    { name: 'Jack', role: 'Employee', email: 'jack@example.com', phone: '555-2346', status: 'Active' },
  ];
  const navigate = useNavigate();
  const handleNewUserClick = () => {
    navigate('/users/create'); // Navigate to the 'New User' route
  };

  const [tabsOrientation, setTabsOrientation] = useState("horizontal");
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    // A function that sets the orientation state of the tabs.
    function handleTabsOrientation() {
      return window.innerWidth < breakpoints.values.sm
        ? setTabsOrientation("vertical")
        : setTabsOrientation("horizontal");
    }

    /** 
     The event listener that's calling the handleTabsOrientation function when resizing the window.
    */
    window.addEventListener("resize", handleTabsOrientation);

    // Call the handleTabsOrientation function to set the state with the initial value.
    handleTabsOrientation();

    // Remove event listener on cleanup
    return () => window.removeEventListener("resize", handleTabsOrientation);
  }, [tabsOrientation]);

  const handleSetTabValue = (event, newValue) => setTabValue(newValue);

  const [value, setValue] = useState(0);
  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    // <BCBox sx={{ bgcolor: 'background.paper' }}>
    //   <AppBar position="static">
    //     <Tabs
    //       value={value}
    //       onChange={handleChange}
    //       indicatorColor="secondary"
    //       textColor="inherit"
    //       variant="scrollable"
    //       aria-label="full width tabs"
    //     >
    //       <Tab label="Users" {...a11yProps(0)} />
    //       <Tab label="Item Two" {...a11yProps(1)} />
    //       <Tab label="Item Three" {...a11yProps(2)} />
    //     </Tabs>
    //   </AppBar>
    //   <TabPanel value={value} index={0} dir={theme.direction}>
    //     <BCTypography variant="d6">Users</BCTypography>
    //     <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
    //       <UserGrid rows={demoData} />
    //     </div>
    //   </TabPanel>
    // </BCBox>
    <BCBox sx={{ bgcolor: 'background.paper' }}>
      <AppBar position="static" >
        <BCBox sx={{ p: 2 }}>
          <Button variant="contained" onClick={handleNewUserClick}>
            <AddIcon contained/> New User
          </Button>
        </BCBox>
        <Tabs
          sx={{ background: 'rgb(0, 0, 0, 0.08)', width: '50%' }}
          orientation={tabsOrientation}
          value={tabValue}
          onChange={handleSetTabValue}>
          <Tab
            label="Users"
            icon={
              <Icon fontSize="small" sx={{ mt: -0.25 }}>
                people
              </Icon>
            }
            {...a11yProps(0)}
          />
          <Tab
            label="Item 2"
            icon={
              <Icon fontSize="small" sx={{ mt: -0.25 }}>
                email
              </Icon>
            }
            {...a11yProps(1)}
          />
          <Tab
            label="Item 3"
            icon={
              <Icon fontSize="small" sx={{ mt: -0.25 }}>
                settings
              </Icon>
            }
            {...a11yProps(2)}
          />
        </Tabs>
      </AppBar>
      <TabPanel value={tabValue} index={0}>
        <BCTypography variant="h3">Users</BCTypography>
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <UserGrid rows={demoData} />
        </div>
      </TabPanel>
    </BCBox>
  );
}