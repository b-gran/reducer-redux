const R = require('ramda')

// Polyfill Array.of
const arrayOf = R.is(Function, Array.of) ? Array.of : R.unapply(R.identity)
module.exports.arrayOf = arrayOf

// Like R.assoc, but respects the property's current enumerability
const defineProperty = R.curry((prop, value, object) => {
  const isPropertyEnumerable = R.defaultTo(true)
  (R.path([ 'enumerable' ], Object.getOwnPropertyDescriptor(object, prop)))

  Object.defineProperty(object, prop, { value: value, enumerable: isPropertyEnumerable })
  return object
})
module.exports.defineProperty = defineProperty

const setLength = defineProperty('length')
module.exports.setLength = setLength

// Call a function with some preselected arguments
const callWith = (...args) => f => f(...args)
module.exports.callWith = callWith

// Returns a function P with the following properties:
//    let f = P(x => x /* can be any function */)
//    typeof f === 'function'
//    f instanceof P
// Optionally, a name for the returned function can be set
const functionWithType = (impl, name) => {
  function Klass (...args) {
    const f = impl(...args)
    Object.setPrototypeOf(f, Klass)
    return f
  }
  Klass.prototype = Klass
  Object.defineProperty(Klass.prototype, 'constructor', { value: Klass, enumerable: false })

  return defineProperty('name', R.defaultTo(impl.name, name), Klass)
}
module.exports.functionWithType = functionWithType

const isType = R.curry((type, x) => typeof x === type)
module.exports.isType = isType

const isFunction = R.either(isType('function'), R.is(Function))
module.exports.isFunction = isFunction

// Returns a failure message for a must
const failureMessage = R.either(R.last, R.always('failed precondition'))

// Passes function arguments through a list of predicates specified as tuples of
// (predicate, failure-message). Calls the function if all the conditions pass.
// Throws if any condition fails.
const preconditions = (...conditions) => f => setLength(f.length)
((...args) => {
  const failedCondition = R.find(
    R.complement(R.pipe(R.head, callWith(...args))), conditions)

  if (failedCondition) {
    throw new Error(failureMessage(failedCondition))
  }
  return f(...args)
})
module.exports.preconditions = preconditions

// Shorthand for wrapping a predicate and message as a 2-tuple for use as arguments to preconditions
const must = R.nAry(2, arrayOf)
module.exports.must = must

// Predicate that returns if the argument can be used as a key for a plain object
const isKeyType = R.anyPass([
  isType('string'), isType('number'), isType('symbol'), isType('boolean'), isType('number')
])

// Binds a property of an object to the object (e.g. bindMethod('log')(console)('hello, world') )
const bindMethod = preconditions(
  must(R.pipe(R.nthArg(0), isKeyType), 'method must be a valid object key'),
  must(R.pipe(R.prop, R.is(Function)), 'the property must be a function'))
(R.curryN(2, (method, object) => object[method].bind(object)))
module.exports.bindMethod = bindMethod

// Given a Map (or Map-like), gets the value in the map whose key is the second argument
const getFrom = bindMethod('get')
module.exports.getFrom = getFrom

// Returns true if the argument is a "plain" object -- one with a null prototype
const isPlainObject = R.allPass([
  R.is(Object),
  R.pipe(
    Object.getPrototypeOf,
    R.prop('constructor'),
    R.either(R.equals(null), R.equals(Object))
  )
])
module.exports.isPlainObject = isPlainObject

// Log the arguments and return value of a function.
const inspectFunction = f => util.setLength(f.length, (...args) => {
  console.log('arguments', args)
  const result = f(...args)
  console.log('result', result)
  return result
})
module.exports.inspectFunction = inspectFunction
