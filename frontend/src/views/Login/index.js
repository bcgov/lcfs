import autumn1 from '@/assets/images/autumn-fall-leaves.png'
import autumn2 from '@/assets/images/autumn-fall-leaves2.png'
import bgAutumnImage from '@/assets/images/bg_autumn.jpg'
import bgSummerImage from '@/assets/images/bg_summer.jpg'
import bgWinterImage from '@/assets/images/bg_winter2.jpg'
import snowflake1 from '@/assets/images/snowflake.png'
import snowflake2 from '@/assets/images/snowflake2.png'
import waterdrop from '@/assets/images/water-drop.png'

const currentDate = new Date()

const month = currentDate.getMonth() + 1 // Months are zero-indexed
const day = currentDate.getDate()

const season =
  (month === 3 && day >= 20) ||
    (month > 3 && month < 6) ||
    (month === 6 && day <= 20)
    ? 'spring'
    : (month === 6 && day >= 21) ||
      (month > 6 && month < 9) ||
      (month === 9 && day <= 21)
      ? 'summer'
      : (month === 9 && day >= 22) ||
        (month > 9 && month < 12) ||
        (month === 12 && day <= 20)
        ? 'autumn'
        : 'winter'

const droplets = () => {
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

const seasonImages = {
  winter: {
    count: 150,
    radius: [2, 6],
    wind: [-0.5, 2.0],
    image: bgWinterImage
  },
  spring: {
    count: 250,
    radius: [1, 4],
    wind: [0, 0],
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
export const bgImage = {
  "image": seasonImages[season].image,
  "wind": seasonImages[season].wind,
  "snowflakeCount": seasonImages[season].count,
  "radius": seasonImages[season].radius,
  "droplets": droplets(),
}