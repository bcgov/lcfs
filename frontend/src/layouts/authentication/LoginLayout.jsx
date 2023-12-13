import PropTypes from 'prop-types'
// @mui material components
import Grid from '@mui/material/Grid'
import BCBox from '@/components/BCBox'
import Snowfall from 'react-snowfall'

// Images
import bgSummerImage from '@/assets/images/bg_summer.jpg'
import bgWinterImage from '@/assets/images/bg_winter2.jpg'
import bgAutumnImage from '@/assets/images/bg_autumn.jpg'
// Droplet images
import autumn1 from '@/assets/images/autumn-fall-leaves.png'
import autumn2 from '@/assets/images/autumn-fall-leaves2.png'
import snowflake1 from '@/assets/images/snowflake.png'
import snowflake2 from '@/assets/images/snowflake2.png'
import waterdrop from '@/assets/images/water-drop.png'

const seasonImages = {
  winter: {
    count: 150,
    radius: [2, 6],
    wind: [-0.5, 2.0],
    image: bgWinterImage
  },
  spring: {
    count: 100,
    radius: [0.4, 2],
    wind: [-0.5, 0],
    image: bgSummerImage
  },
  summer: {
    count: 0,
    radius: [0, 0],
    wind: [0, 0],
    image: bgSummerImage
  },
  autumn: {
    count: 5,
    radius: [12, 24],
    wind: [-0.5, 2.0],
    image: bgAutumnImage
  }
}

function getDroplets(season) {
  const elm1 = document.createElement('img')
  const elm2 = document.createElement('img')
  switch (season) {
    case 'autumn':
      elm1.src = autumn1
      elm2.src = autumn2
      break
    case 'winter':
      elm1.src = snowflake1
      elm2.src = snowflake2
      break
    case 'spring':
      elm1.src = waterdrop
      elm2.src = waterdrop
      break
    case 'summer':
      return []
    default:
      break
  }
  return [elm1, elm2]
}

const LoginLayout = ({ season, children }) => {
  const droplets = getDroplets(season)
  const image = seasonImages[season].image

  return (
    <BCBox
      position="absolute"
      width="100%"
      minHeight="100vh"
      sx={{
        backgroundImage: ({
          functions: { linearGradient, rgba },
          palette: { gradients }
        }) =>
          image &&
          `${linearGradient(
            rgba(gradients.dark.main, 0.1),
            rgba(gradients.dark.state, 0.1)
          )}, url(${image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <Snowfall
        wind={seasonImages[season].wind}
        snowflakeCount={seasonImages[season].count}
        radius={seasonImages[season].radius}
        images={droplets}
      />
      <BCBox px={1} width="100%" height="100vh" mx="auto">
        <Grid
          container
          spacing={1}
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <Grid item xs={11} sm={9} md={5} lg={4} xl={3}>
            {children}
          </Grid>
        </Grid>
      </BCBox>
    </BCBox>
  )
}

LoginLayout.defaultProps = {
  season: 'winter'
}

// Typechecking props for the LoginLayout
LoginLayout.propTypes = {
  season: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
}

export default LoginLayout
