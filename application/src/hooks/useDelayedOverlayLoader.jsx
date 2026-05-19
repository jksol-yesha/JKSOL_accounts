import React from 'react';

const OVERLAY_DELAY_MS = 250;

const useDelayedOverlayLoader = (loading, hasFetchedOnce, delay = OVERLAY_DELAY_MS) => {
    const [showOverlayLoader, setShowOverlayLoader] = React.useState(false);

    React.useEffect(() => {
        if (!(loading && hasFetchedOnce)) {
            setShowOverlayLoader(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setShowOverlayLoader(true);
        }, delay);

        return () => window.clearTimeout(timer);
    }, [delay, hasFetchedOnce, loading]);

    return showOverlayLoader;
};

export default useDelayedOverlayLoader;
