/*
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

// Given a Matcher, returns a new Matcher with the same condition and reducer
const ofMatcher = preconditions
  (must(R.is(Matcher), 'argument must be a Matcher'))
  (R.pipe(
    util.getFrom(privates),
    R.converge(Matcher, [
      R.prop('condition'),
      R.prop('reducer')
    ])
  ))

const PRECONDITIONS = {
  isMatcherCondition: must(
    R.anyPass([ util.isFunction, R.is(Object) ]),
    'condition must be an object or function'
  )
}

// The library export: wraps Matcher to only accept a condition
const match = preconditions
  (must(util.isFunction, 'argument must be a function'))
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

// Creates a helper predicate that returns true iff the predicates in the object's leaves
// return true.
match.shape = R.when(util.isPlainObject, R.where)

// Creates a helper predicate that deeply matches the supplied object against the argument.
match.object = R.when(util.isPlainObject, R.whereEq)

// Shorthand for creating a match condition that tests the action (second argument) only.
// Automatically applies match.shape() to the arguments
match.action = preconditions
  (PRECONDITIONS.isMatcherCondition)
  (condition => R.pipe(R.nthArg(1), match.shape(condition)))

// A Matcher that always calls the reducer.
match.always = reducer => Matcher(R.T, reducer)

const isFunctionOrMatcher = R.anyPass([ util.isFunction, R.is(Matcher) ])

// Converts any non-Matchers to Matchers via match.always
const convertToMatcher = preconditions
  (must(isFunctionOrMatcher, 'must be a function or Matcher'))
  (R.when(R.complement(R.is(Matcher)), match.always))

// Given some reducers (some of which may be Matchers) returns a match.first Matcher.
// Converts any plain reducers to match.always Matchers.
const getMatcherFromReducers = preconditions
  (must(R.unapply(R.all(isFunctionOrMatcher)), 'arguments must be functions or Matchers'))
  (R.pipe(
    R.unapply(R.map(convertToMatcher)),
    R.apply(match.first)
  ))

// Shorthand for creating a Matcher whose tests the action (second argument) only for use with redux.
// * Automatically applies the shape helper to objects.
// * Automatically applies match.first to the reducers
match.redux = preconditions
  (PRECONDITIONS.isMatcherCondition)
  (R.pipe(
    match.action,
    match,
    matcher => R.pipe(
      ofMatcher,
      util.defineProperty('with', R.pipe(getMatcherFromReducers, matcher.with))
    )(matcher)
  ))
