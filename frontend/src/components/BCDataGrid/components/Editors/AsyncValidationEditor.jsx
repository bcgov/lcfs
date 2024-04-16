import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useDebounce } from '@/utils/debounce'

export const AsyncValidationEditor = forwardRef((props, ref) => {
  const [inputValue, setInputValue] = useState('')
  const [valid, setValid] = useState(true)
  const [validating, setValidating] = useState(false)
  const [touched, setTouched] = useState(false)

  const debouncedInputVal = useDebounce(inputValue, props.debounceLimit)

  function inputHandler(e) {
    setTouched(true)
    setInputValue(e.target.value)
    setValidating(true)
  }

  useEffect(() => {
    // random time between 0 and 1000ms
    const timeout = Math.floor(Math.random() * props.debounceLimit)

    new Promise((resolve, reject) => {
      if (inputValue === '') {
        resolve(false)
      } else {
        setTimeout(() => {
          resolve(props.condition(inputValue))
        }, timeout)
      }
    })
      .then((valid) => {
        setValid(valid)
        setValidating(false)
      })
      .catch((err) => console.log(err))
  }, [debouncedInputVal])

  useImperativeHandle(ref, () => {
    return {
      getValue: () => {
        return inputValue
      },
      afterGuiAttached: () => {
        setInputValue(props.value)
      },
      isCancelAfterEnd: () => {
        return !valid || validating
      }
    }
  })

  let loadingElement = null
  let txtColor = null

  if (valid) {
    txtColor = 'black'
    loadingElement = <span className="success">✔</span>
  } else {
    txtColor = '#E91E63'
    loadingElement = <span className="fail">✘</span>
  }

  if (validating) {
    txtColor = 'gray'
    loadingElement = <span className="loading"></span>
  }

  if (!touched) {
    txtColor = 'black'
    loadingElement = null
  }

  return (
    <div className="async-validation-container">
      <input
        type="text"
        className="ag-input-field-input ag-text-field-input"
        style={{ color: txtColor }}
        onChange={inputHandler}
        value={inputValue}
        placeholder={'Enter ' + props.column.colId}
      />
      {loadingElement}
    </div>
  )
})

AsyncValidationEditor.displayName = 'AsyncValidationEditor'
