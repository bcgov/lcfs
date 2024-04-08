import Loading from '@/components/Loading'
import { render, screen } from '@testing-library/react'
import { describe, it } from 'vitest'

describe('Loading Component', () => {
  it('Should render default loading text', ({ expect }) => {
    render(<Loading />)

    const message = screen.getByTestId('message')
    expect(message).toBeInTheDocument()
    expect(message).toHaveTextContent('Loading...')
  })
  it('Should render the text passed to the message prop', () => {
    render(<Loading message="New Loading Message" />)

    const message = screen.getByTestId('message')
    expect(message).toBeInTheDocument()
    expect(message).toHaveTextContent('New Loading Message')
  })
})
