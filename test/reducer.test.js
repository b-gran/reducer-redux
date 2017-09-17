const match = require('../src/reducer')
const R = require('ramda')

describe('match', () => {
  it('is a function with arity 1', () => {
    expect(match).toBeInstanceOf(Function)
    expect(match.length).toBe(1)
  })

  it(`throws if the argument is a non-function`, () => {
    expect(() => match(1)).toThrow()
    expect(() => match('string')).toThrow()
    expect(() => match(null)).toThrow()
    expect(() => match({})).toThrow()
  })

  it(`returns a function whose "with" property is a 1-arity function`, () => {
    const result = match(R.identity)
    expect(result.with).toBeInstanceOf(Function)
    expect(result.length).toBe(1)
  })

  it('passes the state and action through the reducer', () => {
    const reducer = jest.fn((state, action) => state - action)
    const result = match(R.T).with(reducer)
    expect(result(5, 3)).toBe(2)
    expect(reducer).toBeCalledWith(5, 3)
  })

  it('calls the condition with the state and action and does not call the reducer', () => {
    const condition = jest.fn(R.F)
    const reducer = jest.fn()
    const result = match(condition).with(reducer)

    const obj = {}
    expect(result(obj, undefined)).toBe(obj)
    expect(condition).toBeCalledWith(obj, undefined)
    expect(reducer).not.toBeCalled()
  })

  it('supports conditions and reducers with > 2 arguments', () => {
    const values = [ 'a', 'b', 'c', 'd' ]
    const reducer = jest.fn(R.unapply(R.identity))
    const condition = jest.fn(R.T)
    const result = match(condition).with(reducer)

    expect(result(...values)).toEqual(values)
    expect(reducer).toBeCalledWith(...values)
    expect(condition).toBeCalledWith(...values)
  })
})

describe('first', () => {
  it('throws if the arguments are non-Matchers', () => {
    expect(() => match.first()).toThrow()
    expect(() => match.first('foo')).toThrow()
    expect(() => match.first(R.identity)).toThrow()
  })

  it(`uses the reducer of the first matching Matcher`, () => {
    const result = {}
    const firstReducer = jest.fn()
    const secondReducer = jest.fn(R.always(result))
    const matcher = match.first(
      match(R.F).with(firstReducer),
      match(R.identity).with(secondReducer)
    )

    const action = {}
    expect(matcher(true, action)).toBe(result)
    expect(firstReducer).not.toBeCalled()
    expect(secondReducer).toBeCalledWith(true, action)
  })

  it(`returns the state when no Matchers match`, () => {
    const firstReducer = jest.fn()
    const secondReducer = jest.fn()
    const matcher = match.first(
      match(R.F).with(firstReducer),
      match(R.F).with(secondReducer)
    )

    const state = {}
    expect(matcher(state, false)).toBe(state)
    expect(firstReducer).not.toBeCalled()
    expect(secondReducer).not.toBeCalled()
  })

  it('supports conditions and reducers with > 2 arguments', () => {
    const values = [ 'a', 'b', 'c', 'd' ]
    const reducer = jest.fn(R.unapply(R.identity))
    const condition = jest.fn(R.T)
    const innerMatcher = match(condition).with(reducer)

    const firstMacher = match.first(innerMatcher)

    expect(firstMacher(...values)).toEqual(values)
    expect(reducer).toBeCalledWith(...values)
    expect(condition).toBeCalledWith(...values)
  })
})

describe('withDefault', () => {
  it(`returns the default value if the state is undefined`, () => {
    const defaultValue = Symbol.for('value')

    const trueCondition = jest.fn(R.T)
    const trueReducer = jest.fn(R.identity)
    const trueMatcher = match(trueCondition).with(trueReducer)

    const defaultMatcher = match.withDefault(defaultValue)(trueMatcher)

    expect(defaultMatcher(undefined)).toBe(defaultValue)
    expect(trueCondition).not.toBeCalled()
    expect(trueReducer).not.toBeCalled()
  })

  it(`uses the reducer if the state is defined`, () => {
    const value = Symbol.for('other')

    const trueCondition = jest.fn(R.T)
    const trueReducer = jest.fn(R.identity)
    const trueMatcher = match(trueCondition).with(trueReducer)

    const defaultMatcher = match.withDefault('any')(trueMatcher)

    expect(defaultMatcher(value)).toBe(value)
    expect(trueCondition).toBeCalledWith(value)
    expect(trueReducer).toBeCalledWith(value)
  })
})

describe('actionCondition', () => {
  it(`throws if the argument isn't a MatcherConditions`, () => {
    expect(() => match.actionCondition('string')).toThrow()
    expect(() => match.actionCondition(null)).toThrow()
  })

  it(`passes the condition the second argument`, () => {
    const second = Symbol.for('second')
    const condition = jest.fn(R.T)
    const actionCondition = match.actionCondition(condition)

    actionCondition('first', second)
    expect(condition).toBeCalledWith(second)
  })

  it(`converts objects to R.where`, () => {
    const action = { foo: 'bar' }
    const fooPropCondition = jest.fn(R.equals(action.foo))

    const conditionObject = { foo: fooPropCondition }
    const actionCondition = match.actionCondition(conditionObject)

    expect(actionCondition(null, action)).toBeTruthy()
    expect(fooPropCondition).toBeCalledWith(action.foo)
  })
})

describe('plainAction', () => {
  it('compares the second argument to a plain object', () => {
    const reducer = jest.fn(R.identity)
    const matcher = match.plainAction({
      foo: 'bar',
      bar: 'baz',
    }).with(reducer)

    const state = Symbol.for('state')
    const incompleteAction = {
      foo: 'bar',
    }
    const exactAction = {
      foo: 'bar',
      bar: 'baz',
    }
    const superAction = {
      foo: 'bar',
      bar: 'baz',
      something: 'else',
    }

    expect(
      matcher(state, incompleteAction)
    ).toBe(state)
    expect(reducer).not.toBeCalled()

    reducer.mockClear()
    expect(
      matcher(state, exactAction)
    ).toBe(state)
    expect(reducer).toBeCalledWith(state, exactAction)

    reducer.mockClear()
    expect(
      matcher(state, superAction)
    ).toBe(state)
    expect(reducer).toBeCalledWith(state, superAction)
  })
})

describe('always', () => {
  it(`throws if the first argument is a non-Function`, () => {
    expect(() => match.always(undefined)).toThrow()
    expect(() => match.always({})).toThrow()
  })

  const state = Symbol.for('state')
  const action = Symbol.for('action')
  const result = Symbol.for('result')

  const reducer = jest.fn(R.always(result))
  const matcher = match.always(reducer)

  it(`calls the reducer with the state and action`, () => {
    reducer.mockClear()
    expect(matcher(state, action)).toBe(result)
    expect(reducer).toBeCalledWith(state, action)
  })

  it(`returns a Matcher with a new reducer when with() is called`, () => {
    reducer.mockClear()
    const newResult = Symbol.for('newResult')
    const newReducer = jest.fn(R.always(newResult))
    const newMatcher = matcher.with(newReducer)

    expect(newMatcher(state, action)).toBe(newResult)
    expect(newReducer).toBeCalledWith(state, action)
    expect(reducer).not.toBeCalled()
  })
})

describe('redux', () => {
  it(`throws if the arguments aren't MatcherConditions`, () => {
    expect(() => match.redux(null)).toThrow()
    expect(() => match.redux('string', 5)).toThrow()
  })

  const state = Symbol.for('state')
  const action = Symbol.for('action')

  it(`can be used a reducer before with() is called`, () => {
    const condition = jest.fn(R.T)
    const matcher = match.redux(condition)

    expect(matcher(state, action)).toBe(state)
    expect(condition).toBeCalledWith(action)
  })

  it(`applies match.action to Object conditions`, () => {
    const action = { foo: 'bar' }
    const fooPropCondition = jest.fn(R.equals(action.foo))

    const conditionObject = { foo: fooPropCondition }
    const matcher = match.redux(conditionObject).with(R.add(3))

    expect(matcher(5, action)).toBe(8)
    expect(fooPropCondition).toBeCalledWith(action.foo)
  })

  it(`uses the original condition`, () => {
    const trueReducer = jest.fn(match(R.T))
    const trueCondition = jest.fn(R.T)
    const trueMatcher = match.redux(trueCondition).with(trueReducer)
    trueMatcher(state, action)

    expect(trueCondition).toBeCalledWith(action)
    expect(trueReducer).toBeCalledWith(state, action)

    const falseReducer = jest.fn(match(R.T))
    const falseCondition = jest.fn(R.F)
    const falseMatcher = match.redux(falseCondition).with(falseReducer)
    falseMatcher(state, action)

    expect(falseCondition).toBeCalledWith(action)
    expect(falseReducer).not.toBeCalled()
  })

  it(`combines with() reducers using match.first()`, () => {
    const falseReducerCondition = jest.fn(R.F)
    const falseReducer = match(falseReducerCondition).with(R.always(NaN))

    const identityReducer = jest.fn(match(R.T).with(R.identity))

    const reduxMatcher = match.redux(R.T).with(
      falseReducer,
      identityReducer
    )

    expect(reduxMatcher(state, action)).toBe(state)
    expect(falseReducerCondition).toBeCalledWith(state, action)
    expect(identityReducer).toBeCalledWith(state, action)
  })

  it(`converts plain function reducers to match.always Matchers in match.with`, () => {
    const numberState = 5
    const functionReducer = jest.fn(R.add(3))
    const notCalledReducer = jest.fn(R.add(5))
    const reduxMatcher = match.redux(R.T).with(
      match(R.F),
      match(R.F),
      match(R.F),

      // converted to match.always reducer
      functionReducer,

      // should not be called
      notCalledReducer
    )

    expect(reduxMatcher(numberState, action)).toBe(numberState + 3)
    expect(functionReducer).toBeCalledWith(numberState, action)
    expect(notCalledReducer).not.toBeCalled()
  })
})

// Some examples of the library used in different ways.
describe('examples', () => {
  test('action helper', () => {
    const actionShape = match(match.actionCondition({ foo: R.equals('bar') }))
      .with(R.assoc('foo', 'baz'))

    expect(actionShape({ hello: 'world' }, { foo: 'bar' })).toEqual({ hello: 'world', foo: 'baz' })
  })
})
