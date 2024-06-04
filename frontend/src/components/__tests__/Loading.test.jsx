import Loading from '@/components/Loading'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('Loading Component', () => {
  it('Should render default loading text', () => {
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

  it('Should apply fixed positioning when fixed prop is true', () => {
    render(<Loading fixed={true} />)

    const loadingBox = screen.getByTestId('loading')
    expect(loadingBox).toHaveStyle('position: fixed')
    expect(loadingBox).toHaveStyle('margin: 0')
  })

  it('Should apply margin when fixed prop is false', () => {
    render(<Loading fixed={false} />)

    const loadingBox = screen.getByTestId('loading')
    expect(loadingBox).toHaveStyle('position: relative')
    expect(loadingBox).toHaveStyle('margin: 30px')
  })
})
