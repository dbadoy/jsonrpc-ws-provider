/*
This file is part of web3.js.

web3.js is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

web3.js is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/

import { DeferredPromise } from '../src/utils/deferred_promise';

describe('DeferredPromise', () => {
    describe('getState DeferredPromise', () => {
        it('%s', () => {
            const promise = new DeferredPromise();
            expect(promise.state).toBe('pending');
        });
    });
    describe('DeferredPromise resolves promise', () => {
        it('%s', () => {
            const promise = new DeferredPromise();
            promise.resolve('mockValue');
            expect(promise.state).toBe('fulfilled');
        });
    });
    describe('DeferredPromise reject promise', () => {
        it('%s', async () => {
            const promise = new DeferredPromise();
            promise.reject(new Error('fail'));
            // eslint-disable-next-line jest/no-conditional-expect
            await promise.catch((val) => expect(val).toEqual(new Error('fail')));
            expect(promise.state).toBe('rejected');
        });
    });

    describe('DeferredPromise timeout', () => {
        it('%s', async () => {
            const promise = new DeferredPromise({
                timeout: 100,
                eagerStart: true,
                timeoutMessage: 'DeferredPromise timed out',
            });
            // eslint-disable-next-line jest/no-conditional-expect
            await promise.catch((val) => expect(val).toEqual(new Error('DeferredPromise timed out')));
            expect(promise.state).toBe('rejected');
        });
    });
});
