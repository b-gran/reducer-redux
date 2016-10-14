import _ from 'lodash';

/**
 * reducerTree is an object with the following shape
 *
 * {
 *      [actionProperty0]: {
 *          [actionValue0]: {
 *              [actionProperty1]: {
 *                  ...
 *              },
 *              
 *              [actionProperty2]: {
 *                  ...
 *              },
 *              
 *              ...
 *              
 *              [actionPropertyN]: {
 *                  [actionValueN]: function
 *              }
 *          }
 *      }
 * }
 *
 * and action has the following shape:
 * {
 *      [actionProperty0]: [actionValue0],
 *      [actionProperty1]: [actionValue1],
 *      [actionProperty2]: [actionValue2],
 *      ...
 *      [actionPropertyM]: [actionValueM],
 * }
 *
 * findReducer attempts to find a function in reducerTree such that
 * for all actionProperties that are parents of the function,
 * the actionProperty is shared by reducerTree and action, and
 * reducerTree[action[actionProperty]] exists.
 *
 * if more than one function in reducerTree satisfies that property,
 * then an error is thrown.
 *
 * if no functions in reducerTree satisfy that property, undefined is returned.
 *
 * @param reducerTree
 * @param action
 */
export function findReducer (reducerTree, action) {
    // If reducerTree is a function, we've found the reducer!
    if (typeof reducerTree === 'function') {
        return reducerTree;
    }

    // The keys of findReducer with the key/value pairs that are definitely not
    // reducers for action omitted.
    const matchesCurrentLevel = _.keys(_.omitBy(reducerTree, (val, key) => {
        // If action doesn't have doesn't have this key, 
        // then the reducer function isn't in this key.
        if (_.isUndefined(action[key])) return true;

        const actionValue = action[key];

        // If the reducer tree doesn't have an entry at actionValue,
        // then the reducer function isn't in this key.
        if (reducerTree[key][actionValue] === undefined) return true;

        return false;
    }));
    
    // Recursively find reducers for any matches at this level.
    const recursiveMatches = _.compact(_.map(
        matchesCurrentLevel,
        match => findReducer(reducerTree[match][action[match]], action)
    ));

    // If matches has more than one entry, then the reducerTree has
    // more than one reducer that matches action.
    // That is an invariant, so we throw.
    if (recursiveMatches.length > 1) throw new Error('More than one reducer matches this action.');

    // If matches has no entries, then the reducerTree has no reducer for 
    // this action.
    if (recursiveMatches.length === 0) return undefined;
    
    // There is exactly one match, so return the function.
    return recursiveMatches[0];
}

/**
 * Creates a reducer to be used by combineReducers
 *
 * The reducer takes current state and action, finds the reducer in its
 * reducers object that matches the action, and calls that actionReducer
 * with state, action, and any other arguments passed to the reducer.
 *
 *      actionReducer(state, action, arg_0, arg_1, ..., arg_n)
 *
 * You can add new action reducers to the reducer using
 * reducer.add({
 *      actionProperty: {
 *          actionValue: {
 *              actionProperty2: {
 *                  ... 
 *                  actionValueN: function actionReducer
 *              }
 *          }
 *      }
 * })
 *
 * If there is no reducer found for an action, the reducer just returns
 * the state passed to it.
 *
 * @param defaultState the state to use if the state passed to the the reducer is undefined.
 */
export function reducer (defaultState) {
    // Reducers that have been registered with this reducer.
    const reducers = {};

    // The function passed to combineReducers()
    const innerReducer = function (state = defaultState, action, ...args) {
        // Try to find a reducer for action.
        const actionReducer = findReducer(reducers, action);

        // If we don't have a reducer for this action, don't change the state.
        if (actionReducer === undefined) return state;

        // Call the reducer.
        // return actionReducer(state, action);
        return actionReducer.apply(null, [ state, action, ...args ]);
    };

    /** Adds a reducer
     * The reducer should be of the form
     * {
     *      type: {
     *          CLICK_OBJECT: {
     *              objectType: {
     *                  COMPUTER: {
     *                      function
     *                  },
     *                  
     *                  CREDENTIAL: {
     *                      function
     *                  },
     *              }
     *          }
     *      }
     * }
     *
     * the properties and values can be different, of course, but the leaves
     * must be functions.
     */
    innerReducer.add = function (reducerTree = {}) {
        _.merge(reducers, reducerTree);
    };

    return innerReducer;
}

export default reducer;

/**
 * function compose (...reducers: [ function (state: Object, action: Object) ])
 *      -> function (state: Object, action: Object, globalState: Object, ...otherArguments)
 *
 * Takes a list of reducers, and returns another reducer that calls the
 * first reducer with the state and action, then calls the second
 * reducer with the action and result of the first reducer as the
 * state, and so on.
 *
 * Applies the reducers in the order they were passed to the function.
 *
 * @param reducers the reducers to compose
 */
export function compose (...reducers) {
    return function (state, action, globalState) {
        const topLevelArguments = Array.prototype.slice.call(arguments);
        return _.reduce(
            reducers,
            (currentState, currentReducer) => {
                const reducerArguments = [
                    currentState,
                    ...topLevelArguments.slice(1)
                ];

                return currentReducer.apply(null, reducerArguments);
            },
            state
        );
    };
}


/**
 * Just like redux's combineReducers, except the reducers get passed a
 * third argument: the entire state object.
 *
 * Here's the signature for each of the individual reducers passed to `reducers`:
 *
 *      function reducer (state: mixed, action: object, entireState: object) -> mixed
 *
 *      where
 *          state       is the reducer's slice of the entire state object
 *          action      is the action to reduce
 *          entireState is the entire state object
 *
 * Also, just like redux's combineReducers, this function will ignore unexpected keys
 * (i.e. those keys not possessed by the `reducers` object passed to the function).
 *
 * @param {object} reducers - the reducers to use when constructing the state object
 * @return {function} a redux reducer that passes each reducer in `reducers` its slice of the state object
 */
export function combineReducers (reducers) {
    if (!reducers) {
        throw new Error('You must supply reducers to combineReducers()');
    }

    return (state, action) => {
        return _.mapValues(
            reducers,
            (sReducer, key) => {
                return sReducer(
                    // The reducer's slice of the state (or undefined if state is undefined)
                    state && state[key],

                    // The action, unmodified
                    action,

                    // The entire state object
                    state
                );
            }
        )
    };
};

