# `reducer-redux`

[![Build Status](https://travis-ci.org/b-gran/reducer-redux.svg?branch=master)](https://travis-ci.org/b-gran/reducer-redux) [![npm version](https://badge.fury.io/js/reducer-redux.svg)](https://badge.fury.io/js/reducer-redux)

Create functional, reusable redux reducers. Liberate yourself from `switch`.

_`(g∘f)`_ __Composable__: reducers are just plain functions. Nest and compose them with other reducers and libraries.

`♺` __Reusable__: designed for redux but flexible enough to use elsewhere. Create building blocks and reuse them.

_`xⁿ`_ __Powerful__: comes with a utility belt for working with redux actions.

## Installation

```
npm install reducer-redux
```

## 30 second overview

An example from the redux tutorial:

```
import match from 'reducer-redux';
import { combineReducers } from 'redux';

import { ADD_TODO, TOGGLE_TODO, SET_VISIBILITY_FILTER, VisibilityFilters } from './actions';

const visibilityFilter = match.withDefault(VisibilityFilter.SHOW_ALL)(
    match.plainAction({ type: SET_VISIBILITY_FILTER })
        .with(action => action.filter)
)

const todos = match.withDefault([])(
    match.first(
        match.plainAction({ type: ADD_TODO })
            .with((action, state) => [
                ...state,
                { 
                    text: action.text,
                    completed: false,
                }
            ]),
        match.plainAction({ type: TOGGLE_TODO })
            .with((action, state) => state.map(
                match((todo, index) => index === action.index)
                    .with(todo => ({ ...todo, completed: !todo.completed }))
            )),
    ))

export default combineReducers({
    visibilityFilter,
    todos
});
```

## Basic usage

The library exports a function called `match`. `match` returns functions called _Matchers_, which
 are the core abstraction of library. A Matcher is a tuple of `(condition, reducer)`. The condition
is a predicate, and the reducer is any function. 

Matchers created with `match` don't have a reducer yet. You specify a reducer by calling the
Matcher's `.with()` function.

When the Matcher is called with some arguments, it first calls the `condition`.
* __If the `condition` returns true__, the matcher returns the result of the `reducer` __with the 
same arguments__.
* __If the `condition` returns false, the matcher returns __the first argument__.

Here's an example:
```
const matcher = match(value => value === 'foo')
    .with(() => 'bar')
matcher('foo') // 'bar'
matcher('bar') // 'foo'
matcher('bar', 'baz') // 'foo'
```

## Usage with redux

Although the library is powerful enough for use anywhere, it's designed for redux.

__The `reducer` of a Matcher returns the first argument (the state) if the `condition` returns 
false__.
This property enables us to specify some conditions for which to modify a store state,
and the Matcher will leave the state unchanged for any other condition!

Here's an example:
```
const counter = match((state, action) => action.type === 'increment')
    .with((state, action) => state + 1)
counter(0, { type: 'increment' }) // 1    
counter(0, { type: 'something else' }) // 0    
counter(0, { type: 'another action' }) // 0    
```

Of course, a redux application needs to handle more than one action type.
`reducer-redux` comes with a utility to combine reducers: `match.first()`.

`match.first()` takes a group of reducers and uses the first one whose `condition` returns true.
Here's an example:
```
const counter = match.first(
    match((state, action) => action.type === 'increment')
        .with((state, action) => state + action.amount),
    match((state, action) => action.type === 'decrement')
        .with((state, action) => state - action.amount)
)
counter(1, { type: 'increment', amount: 1 }) // 2    
counter(1, { type: 'decrement', amount: 2 }) // -1    
counter(1, { type: 'another action' }) // 1    
```
