import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import type { ChangeEvent, ForwardedRef } from 'react'
import { useDebounce } from '@/utils/debounce'

export interface AsyncValidationEditorProps {
  value?: string
  onValueChange: (value: string) => void
  eventKey?: string
  rowIndex?: number
  column?: { colId?: string }
  debounceLimit?: number
  condition: (value: string) => boolean | Promise<boolean>
}

export const AsyncValidationEditor = forwardRef<
  {
    getValue: () => string | undefined
    afterGuiAttached: () => void
    isCancelAfterEnd: () => boolean
  },
  AsyncValidationEditorProps
>(
  (
    {
      value,
      onValueChange,
      eventKey,
      rowIndex,
      column,
      ...props
    }: Omit<AsyncValidationEditorProps, 'ref'>,
    ref: ForwardedRef<{
      getValue: () => string | undefined
      afterGuiAttached: () => void
      isCancelAfterEnd: () => boolean
    }>
  ) => {
    const [inputValue, setInputValue] = useState(value ?? '')
    const [valid, setValid] = useState(true)
    const [validating, setValidating] = useState(false)
    const [touched, setTouched] = useState(false)

    const debouncedInputVal = useDebounce(inputValue, props.debounceLimit)
    // TODO: ability to show tool tip
    // TODO: ability to show error message
    // TODO: ability to perform both synchronous and asynhronous validations.
    function inputHandler(e: ChangeEvent<HTMLInputElement>) {
      setTouched(true)
      setInputValue(e.target.value)
      onValueChange(e.target.value)
      setValidating(true)
    }

    useEffect(() => {
      const timeout = props.debounceLimit

      new Promise<boolean>((resolve, reject) => {
        if (inputValue === '') {
          resolve(false)
        } else {
          setTimeout(() => {
            Promise.resolve(props.condition(inputValue)).then(resolve, reject)
          }, timeout)
        }
      })
        .then((valid: boolean) => {
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
          setInputValue(value ?? '')
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
          placeholder={'Enter ' + (column?.colId ?? '')}
        />
        {loadingElement}
      </div>
    )
  }
)

AsyncValidationEditor.displayName = 'AsyncValidationEditor'
