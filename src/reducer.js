const R = require('ramda')

const util = require('../util')
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

const isFunctionOrMatcher = R.anyPass([ util.isFunction, R.is(Matcher) ])

const PRECONDITIONS = {
  isMatcherCondition: must(
    R.anyPass([ util.isFunction, R.is(Object) ]),
    'condition must be an object or function'
  ),
  isFunctionOrMatcher: must(
    isFunctionOrMatcher,
    'must be a function or Matcher'
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
    must(R.pipe(R.length, R.gt(R.__, 0)), 'must pass at least one argument'),
    must(R.unapply(R.all(R.is(Matcher))), 'arguments must be Matchers')
  )
  ((...reducers) => Matcher(
    R.T,
    (state, ...rest) => R.pipe(
      R.find(
        R.pipe(util.getFrom(privates), R.prop('condition'), util.callWith(state, ...rest))
      ),
      R.ifElse(
        R.identity,
        util.callWith(state, ...rest),
        R.always(state)
      )
    )(reducers)
  ))

// A Matcher that always calls the reducer.
match.always = preconditions
  (PRECONDITIONS.isFunctionOrMatcher)
  (reducer => Matcher(R.T, reducer))

// Wraps around a Matcher and returns a default value if the state (first argument) is undefined.
match.withDefault = defaultValue => matcher => R.ifElse(
  state => util.isUndefined(state),
  () => defaultValue,
  matcher
)

// Creates a helper predicate that returns true iff the predicates in the object's leaves
// return true.
match.shape = R.when(util.isPlainObject, R.where)

// Creates a helper predicate that deeply matches the supplied object against the argument.
match.object = R.when(util.isPlainObject, R.whereEq)

// Given a transform that returns a unary predicate from a condition, returns a shorthand function
// for creating conditions that test the second argument using the predicate from the condition.
const getActionCondition = getConditionPredicate => preconditions
  (PRECONDITIONS.isMatcherCondition)
  (condition => R.pipe(R.nthArg(1), getConditionPredicate(condition)))

// Shorthand for creating a match condition that tests the action (second argument) only and
// automatically applies match.shape() to the arguments
match.actionCondition = getActionCondition(match.shape)

// Shorthand for creating a match condition that tests the action (second argument) only and
// automatically applies match.object() to the arguments
match.plainActionCondition = getActionCondition(match.object)

// Create a Matcher whose condition matches against a plain object action
match.plainAction = R.pipe(match.plainActionCondition, match)

// Converts any non-Matchers to Matchers via match.always
const convertToMatcher = preconditions
  (PRECONDITIONS.isFunctionOrMatcher)
  (R.when(R.complement(R.is(Matcher)), match.always))

// Given some reducers (some of which may be Matchers) returns a match.first Matcher.
// Converts any plain reducers to match.always Matchers.
const getMatcherFromReducers = preconditions
  (must(R.unapply(R.all(isFunctionOrMatcher)), 'arguments must be functions or Matchers'))
  (R.pipe(
    R.unapply(R.map(convertToMatcher)),
    R.apply(match.first)
  ))

// Shorthand for creating a Matcher whose condition tests only the action (second argument), and whose
// reducer can be a combination of multiple reducers. For use with redux.
// * Automatically applies the match.action helper to the condition
// * Automatically applies match.first to the reducers
match.redux = preconditions
  (PRECONDITIONS.isMatcherCondition)
  (R.pipe(
    match.actionCondition,
    match,
    matcher => R.pipe(
      ofMatcher,

      // TODO: have Matcher support other with() implementations
      util.defineProperty('with', R.pipe(getMatcherFromReducers, matcher.with))
    )(matcher)
  ))
