// Import the styled API and the components from MUI
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import CardContent from '@mui/material/CardContent';

// Create the component slots
const Root = styled(Card, {
  name: 'BCWidgetCard',
  slot: 'Root',
})(({ theme }) => ({
  border: '1px solid #8c8c8c',
  '&:hover': {
    transform: 'scale(1.02)',
  },
}));

const Header = styled(Box, {
  name: 'BCWidgetCard',
  slot: 'Header',
})(({ theme, ownerState }) => ({
  display: 'flex',
  justifyContent: 'center',
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(2),
}));

const HeaderBox = styled(Box, {
  name: 'BCWidgetCard',
  slot: 'HeaderBox',
})(({ theme, ownerState }) => ({
  variant: 'contained',
  backgroundColor: ownerState.color,
  color: ownerState.color === 'light' ? 'dark' : 'white',
  boxShadow: `0 3px 5px 2px ${ownerState.color}`,
  borderRadius: theme.shape.borderRadius,
  display: 'flex',
  justifyContent: 'left',
  alignItems: 'center',
  padding: theme.spacing(2),
  width: '90%',
  height: '40px',
  marginTop: theme.spacing(-3),
}));

const Title = styled(Typography, {
  name: 'BCWidgetCard',
  slot: 'Title',
})(({ theme, ownerState }) => ({
  variant: 'subtitle1',
  fontWeight: 'light',
  color: 'inherit',
}));

const ContentDivider = styled(Divider, {
  name: 'BCWidgetCard',
  slot: 'ContentDivider',
})(({ theme }) => ({
  borderBottom: '1px solid #c0c0c0',
}));

// Create the component
const BCWidgetCard = ({ color, title, content, ...props }) => {
  return (
    <Root {...props}>
      <Header ownerState={{ color }}>
        <HeaderBox ownerState={{ color }}>
          <Title ownerState={{ color }}>{title}</Title>
        </HeaderBox>
      </Header>
      <ContentDivider />
      <CardContent>{content}</CardContent>
    </Root>
  );
};

export default BCWidgetCard;
