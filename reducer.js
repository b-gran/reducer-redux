/*
 * Condition :: (any -> boolean) | Object<Condition>
 *
 * State a :: a
 * Action :: Object<any>
 * Reducer a :: State a -> Action -> State a
 *
 * match a :: Condition -> match a
 * match.with :: match a ~> Reducer a -> match a
 */

const R = require('ramda')

const util = require('./util')
const { preconditions, must } = util

// Private Matcher variables, accessible to other Matcher instances
const privates = new WeakMap()

// The base type returned by match() -- models a redux reducer as a condition and a "reducer", where
//    the condition is a predicate that tests whether the state should be changed,
//    the "reducer" is the function that returns a modified state
const Matcher = util.functionWithType(function (condition, reducer = R.identity) {
  const reduce = R.ifElse(condition, reducer, R.identity)
  reduce.with = childReducer => Matcher(condition, childReducer)
  privates.set(reduce, { condition, reducer })
  return reduce
}, 'Matcher')


// The library export: wraps Matcher to only accept a condition
const match = preconditions(
  must(R.anyPass([ util.isFunction, R.is(Object) ]), 'condition must be an object or function'))
  (condition => Matcher(condition))
module.exports = match

// Accepts some Matchers and returns a Matcher that uses the reducer of the first Matcher whose
// condition is true.
match.first = preconditions
  (
    must(R.pipe(R.length, R.gt(R.__, 0)), 'must pass at least one Matcher'),
    must(R.unapply(R.all(R.is(Matcher))), 'arguments must be Matchers')
  )
  ((...reducers) => Matcher(
    R.T,
    (state, action) => R.pipe(
      R.find(
        R.pipe(util.getFrom(privates), R.prop('condition'), util.callWith(state, action))
      ),
      R.ifElse(
        R.identity,
        util.callWith(state, action),
        R.always(state)
      )
    )(reducers)
  ))
