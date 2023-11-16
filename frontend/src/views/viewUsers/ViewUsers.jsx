import { Breadcrumbs } from '@mui/material';
import DefaultNavbar from 'components/Navbars/DefaultNavbar';
import { Breadcrumb } from 'react-bootstrap';
import { useMatches } from 'react-router-dom';
// import { useParams } from 'react-router-dom';

export const ViewUsers = () => {
  //   const { userID } = useParams();
  const matches = useMatches();
  console.log(matches);

  return <div>asdf</div>;
};
