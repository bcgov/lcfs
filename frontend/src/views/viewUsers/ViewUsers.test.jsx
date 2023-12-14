import { render, screen } from '@testing-library/react'
import { ViewUsers } from './index'

test('loads and displays the view users page', () => {
  render(<ViewUsers />)
  expect(screen.getByText('User Activity')).toBeInTheDocument()
})
