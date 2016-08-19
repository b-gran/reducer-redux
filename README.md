# `reducer-redux`

A utility for easily creating robust redux reducers.

`reducer-redux` applies different reducers based on the properties of an action.

Its main purpose is saving you from a bunch of nested `switch` statements.

## Installation

```
npm install reducer-redux
```

## Usage

The main `reducer()` function accepts an initial state value as its argument. 
If the state passed to a reducer is `undefined`, that initial state value
will be returned.

You add reducers using the `add()` function. The `add()` function accepts
an object with reducer functions (of form `(state, action) => whatever`) as
its leaves. If a matching action is passed to the reducer, that reducer 
function will be called.

If no reducer is found, the state will just be passed through unchanged.

Here's an example. Let's say you set up your reducer like this

```
import reducer from 'reducer-redux';

const myReducer = reducer([]);
myReducer.add({
    type: {
        ADD: {
            position: {
                BEGINNING: (state, action) => [ action.value, ...state, ],
                END: (state, action) => [ ...state, action.value ],
            },
        },
        
        REMOVE: {
            position: {
                BEGINNING: (state, action) => state.slice(
                    Math.min(1, state.length),
                    state.length
                ),
                
                END: (state, action) => state.slice(
                    0,
                    Math.max(0, state.length - 1)
                ),
            },
        },
    },
});
```

Here's what happens for various states and actions

```
myReducer(
    [ 1 ], 
    {
        type: 'ADD',
        position: 'BEGINNING',
        value: 2,
    }
);
// [ 2, 1 ]

myReducer(
    [ 1 ], 
    {
        type: 'ADD',
        position: 'END',
        value: 2,
    }
);
// [ 1, 2 ]

myReducer(
    [ 1, 2 ], 
    {
        type: 'REMOVE',
        position: 'END',
    }
);
// [ 1 ]

myReducer(
    [ 1, 2 ], 
    {
        type: 'REMOVE',
        position: 'BEGINNING',
    }
);
// [ 2 ]

// If no reducer is found, passes state through unchanged
myReducer(
    [ 1, 2 ], 
    {
        type: 'ADD',
        position: 'MIDDLE',
        value: 'whatever',
    }
);
// [ 1, 2 ]
        
```

You can structure these action/reducer objects however you'd like -- you
aren't required to have `type` at the top level.

Here's another way to write the above example:

```
myReducer.add({
    position: {
        BEGINNING: {
            type: {
                ADD: (state, action) => [ action.value, ...state, ],
                REMOVE: (state, action) => state.slice(
                    Math.min(1, state.length),
                    state.length
                ),
            }
        },
    }
});

myReducer.add({
    position: {
        END: {
            type: {
                ADD: (state, action) => [ ...state, action.value ],
                REMOVE: (state, action) => state.slice(
                    0,
                    Math.max(0, state.length - 1)
                ),
            }
        },
    }
});
```

Based on an example from the [redux tutorial](http://redux.js.org/docs/basics/Reducers.html#source-code)

```
import reducer from 'reducer-redux';
import { combineReducers } from 'redux';

import { ADD_TODO, TOGGLE_TODO, SET_VISIBILITY_FILTER, VisibilityFilters } from './actions';
const { SHOW_ALL } = VisibilityFilters;

const visibilityFilter = reducer(SHOW_ALL);
visibilityFilter.add({
    type: {
        SET_VISIBILITY_FILTER: (state, action) => action.filter,
    },
});

const todos = reducer([]);
todos.add({
    type: {
        ADD_TODO: (state, action) => [
            ...state,
            {
                text: action.text,
                completed: false,
            },
        ],
        
        TOGGLE_TODO: (state, action) => state.map(
            (todo, index) => {
                if (index === action.index) {
                    return Object.assign({}, todo, {
                        completed: !todo.completed
                    });
                }
                
                return todo;
            }
        ),
    },
});

export default combineReducers({
    visibilityFilter,
    todos
});

```

## Other utilities

`reducer-redux` comes with two other utilities: `combineReducers()` and
`compose()`.

`combineReducers()` is just like redux's vanilla combineReducers() function,
except `reducer-redux`'s version passes a third argument to each reducer:
the entire state object.

`compose()` allows you to compose functions together.

For more information about these utilities, look in the `tests/` directory.

## Contributing

```
# Run all of the tests
npm run test

# Watch for changes to source files and rebuild
gulp dev

# Build for release
gulp production
```