const isIgnorableRequestError = (error) => {
    const message = error?.message || '';

    return (
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError' ||
        error?.code === 'ERR_CANCELED' ||
        message === 'Logout in progress' ||
        message === 'Missing Authentication Token' ||
        message.includes('canceled')
    );
};

export default isIgnorableRequestError;
