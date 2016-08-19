import { expect } from 'chai';
import _ from 'lodash';

import { reducer, findReducer, compose, combineReducers } from '../src/reducer';

import { combineReducers as reduxCombineReducers } from 'redux';

const dummy = () => null;

describe('compose (...reducers)', () => {
    it(
        'should apply the reducers successively to the state and' +
        'action in the order they were passed',
        done => {
            const reducer1 = (state, action) => {
                return state + ' BAR';
            };

            const reducer2 = (state, action) => {
                return _.lowerCase(state) + action.message;
            };

            const composedReducer1 = compose(
                reducer1,
                reducer2
            );

            expect(composedReducer1('FOO', { message: '!'})).to.equal('foo bar!');

            const composedReducer2 = compose(
                reducer2,
                reducer1
            );

            expect(composedReducer2('FOO', { message: '!'})).to.equal('foo! BAR');

            done();
        }
    );
});


describe('findReducer (reducerTree, action)', () => {
    it('should return reducerTree if reducerTree is a function.', done => {
        const func = () => null;
        expect( findReducer(func, {}) ).to.equal(func);
        done();
    });
    
    it('should throw an error if more than one reducer matches action', done => {
        function expectMultipleReducers (tree, action) {
            expect( findReducer.bind(null, tree, action) ).to.throw(Error, /More than one reducer matches this action/);
        }
        
        const tree0 = {
            'foo': {
                'bar': dummy,
            },
            
            'baz': {
                'something': dummy,
            }
        };
        
        const action0 = {
            foo: 'bar',
            baz: 'something',
        };
        
        expectMultipleReducers(tree0, action0);
        
        const tree1 = {
            foo: {
                bar: {
                    baz: {
                        something: dummy,
                    }
                }
            },
            
            baz: {
                something: dummy,
            }
        };
        
        const action1 = action0;
        
        expectMultipleReducers(tree1, action1);
        
        const tree2 = {
            a: {
                aa: {
                    b: {
                        bb: dummy,
                    }
                }
            },
            
            c: {
                cc: {
                    d: {
                        dd: dummy,
                    }
                }
            },
        };
        
        const action2 = {
            a: 'aa',
            b: 'bb',
            c: 'cc',
            d: 'dd'
        };

        expectMultipleReducers(tree2, action2);
        
        done();
    });
    
    it('should return undefined if there is no reducer for the action in the tree', done => {
        const dummy = () => null;
        
        expect( findReducer(undefined, undefined) ).to.equal(undefined);
        expect( findReducer({}, {}) ).to.equal(undefined);
        
        expect( findReducer({}, { baz: 'bar' }) ).to.equal(undefined);
        expect( findReducer({ foo: { bar: dummy } }, {}) ).to.equal(undefined);
        
        expect( findReducer({ foo: { bar: dummy } }, { baz: 'bar' }) ).to.equal(undefined);
        expect( findReducer({ baz: { something: dummy } }, { baz: 'bar' }) ).to.equal(undefined);

        const tree = {
            foo: {
                bar: {
                    baz: {
                        incorrect: dummy
                    },
                },
            },
        };
        
        const action = {
            foo: 'bar',
            baz: 'value',
        };
        
        expect( findReducer(tree, action) ).to.equal(undefined);

        done();
    });
});

describe('reducer (defaultState)', () => {
    it('should return the defaultState', done => {
        const r0 = reducer([]);
        expect(
            _.isEqual(
                r0(undefined, { foo: 'bar' }),
                []
            )
        ).to.be.true;
        
        const r1 = reducer([]);
        r1.add({ foo: { baz: () => 'something' }});
        expect(
            _.isEqual(
                r1(undefined, { foo: 'bar' }),
                []
            )
        ).to.be.true;
        
        done();
    });
    
    it('should find and call a reducer', done => {
        const r0 = reducer([]);
        r0.add({
            foo: { bar: (state, action) => _.concat(state, [ 'second' ])}
        });

        expect(
            _.isEqual(
                r0([ 'first' ], { foo: 'bar' }),
                [ 'first', 'second' ]
            )
        ).to.be.true;

        expect(
            _.isEqual(
                r0([ 'first' ], { foo: 'bar', something: 'else' }),
                [ 'first', 'second' ]
            )
        ).to.be.true;
        
        const r1 = reducer([]);
        r1.add({
            foo: { bar: (state, action) => _.concat(state, [ 'second' ])},
        });
        r1.add({
            baz: { something: (state, action) => _.concat(state, [ 'third' ])},
        })

        expect(
            _.isEqual(
                r1([ 'first' ], { foo: 'bar' }),
                [ 'first', 'second' ]
            )
        ).to.be.true;

        expect(
            _.isEqual(
                r1([ 'first' ], { baz: 'something' }),
                [ 'first', 'third' ]
            )
        ).to.be.true;
        
        done();
    });
    
    it('should throw if there are non-unique reducers', done => {
        const r0 = reducer([]);
        r0.add({
            foo: { bar: (state, action) => _.concat(state, [ 'second' ])},
        });
        r0.add({
            baz: { something: (state, action) => _.concat(state, [ 'third' ])},
        })

        expect(
            r0.bind(null, [ 'first' ], { foo: 'bar', baz: 'something' })
        ).to.throw(Error);

        done();
    });
    
    // This tests an alternate topology with duplicate action properties
    // at different levels in the reducer
    it('should find and call a reducer', done => {
        const r0 = reducer('');
        r0.add({
            type: {
                A: _.constant('A'),
            }, 
            
            other: {
                C: {
                    type: {
                        B: _.constant('B'),
                    }
                }
            }
        });
        
        expect(
            r0(
                '', { type: 'A', other: 'C' }
            )
        ).to.equal('A');
        
        done();
    });

    // Ensures that args other than state and action make their way to the
    // reducer leaves.
    it('should pass additional args to the reducers', done => {
        const r0 = reducer('');
        r0.add({
            type: {
                A: (state, action, first, second, third) => second + third,
            },
        });

        expect(
            r0('', { type: 'A', }, null, 'foo', 'bar')
        ).to.equal('foobar');

        done();
    })
});

describe('combineReducers(reducers)', () => {
    it('should throw if no reducers are passed', done => {
        expect(() => combineReducers(undefined)).to.throw(Error);
        done();
    });

    it('should pass entire state object + state slice to each reducer leaf', done => {
        const r0 = combineReducers({
            A: (slice, action, entire) => slice,
            B: (slice, action, entire) => action,
            C: (slice, action, entire) => entire,
        });

        expect(
            _.isEqual(
                r0(
                    {
                        A: 'A slice',
                        B: 'B slice',
                        C: 'C slice',
                    },
                    'action'
                ),
                {
                    A: 'A slice',
                    B: 'action',
                    C: {
                        A: 'A slice',
                        B: 'B slice',
                        C: 'C slice',
                    },
                }
            )
        ).to.be.true;

        done();
    });

    it('should ignore unexpected keys', done => {
        const r0 = combineReducers({
            A: () => 'A',
            B: () => 'B',
        });

        expect(
            _.isEqual(
                r0(
                    {
                        A: 'whatever',
                        B: 'whatever',
                        C: 'C'
                    },
                    'whatever'
                ),
                {
                    A: 'A',
                    B: 'B',
                }
            )
        ).to.be.true;

        done();
    });


    it("should behave the same as redux's combineReducers()", done => {
        const initialState = 0;

        // Create a reducer that returns the initial state if state is undefined
        const baseReducer = reducer => {
            return (state, action) => {
                if (state === undefined) return initialState;
                return reducer(state, action);
            };
        };

        // A few different types of reducer
        const reducers = {
            A: baseReducer((state, action) => (action && 'A') || state),
            B: baseReducer((state, action) => state),
            C: baseReducer((state, action) => action),
            D: baseReducer((state, action) => state + 'D'),
        };

        // Create reducers using own and redux's combineReducers()
        const own = combineReducers(reducers);
        const redux = reduxCombineReducers(reducers);

        // Ensures that the reducers passed to it return the same
        // value for a given state and action
        const testReducers = ((first, second) => {
            return (state, action) => {
                expect(_.isEqual(
                    first(state, action),
                    second(state, action)
                )).to.be.true;
                return true;
            };
        })(own, redux);

        // Test various state/action combinations

        testReducers.apply(null, [
            {
                A: 'A',
                B: 'B',
                C: 'C',
                D: 'D',
            },
            true
        ]);

        testReducers.apply(null, [
            {
                A: 'A',
                B: 'B',
                C: 'C',
                D: 'D',
            },
            false
        ]);

        testReducers.apply(null, [
            undefined,
            false
        ]);

        testReducers.apply(null, [
            {},
            false
        ]);

        testReducers.apply(null, [
            {},
            true
        ]);

        testReducers.apply(null, [
            {
                B: 'B',
                C: 'C',
                D: 'D',
            },
            false
        ]);

        testReducers.apply(null, [
            {
                B: 'B',
                C: 'C',
                D: 'D',
            },
            true
        ]);

        testReducers.apply(null, [
            {
                B: 'B',
                C: 'C',
                E: 'E',
            },
            true
        ]);

        testReducers.apply(null, [
            {
                B: 'B',
                C: 'C',
                E: 'E',
            },
            false
        ]);

        testReducers.apply(null, [
            {
                B: 'B',
                C: 'C',
                D: undefined,
            },
            true
        ]);

        done();
    })
});