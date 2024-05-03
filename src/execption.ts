export class ConnectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
    }
}

export class InvalidClientError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidClientError';
    }
}

export class MaxAttemptsReachedOnReconnectingError extends Error {
    constructor(maxAttempts: number) {
        super(`Max attempts of ${maxAttempts} reached`);
        this.name = 'MaxAttemptsReachedOnReconnectingError';
    }
}

export class PendingRequestsOnReconnectingError extends Error {
    constructor() {
        super('Pending requests on reconnecting');
        this.name = 'PendingRequestsOnReconnectingError';
    }
}
