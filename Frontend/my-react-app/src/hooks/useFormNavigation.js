/**
 * Hook to handle Enter key navigation between inputs.
 * usage: <input onKeyDown={(e) => handleKeyDown(e, index)} ... />
 */
export const useFormNavigation = (refs, submitCallback) => {
    const handleKeyDown = (e, index) => {
        const isSelect = e.target.tagName === 'SELECT';

        if (e.key === 'Enter' || e.key === 'ArrowRight' || (e.key === 'ArrowDown' && !isSelect)) {
            // For Selects, allow ArrowDown/Up to change values (native behavior)
            // unless it's Enter or ArrowRight which means "Next"
            e.preventDefault();

            // If it's ArrowDown/Right on the last field, do nothing (don't submit)
            // Only Enter should submit on the last field
            if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && index === refs.length - 1) return;

            const nextIndex = index + 1;

            // Allow skipping dead refs
            let actualNext = nextIndex;
            while (actualNext < refs.length && (!refs[actualNext] || !refs[actualNext].current)) {
                actualNext++;
            }

            if (actualNext < refs.length && refs[actualNext] && refs[actualNext].current) {
                refs[actualNext].current.focus();
            } else {
                // Last field or no more fields -> Submit ONLY if Enter
                if (e.key === 'Enter' && submitCallback) {
                    submitCallback(e);
                }
            }
        } else if (e.key === 'ArrowLeft' || (e.key === 'ArrowUp' && !isSelect)) {
            e.preventDefault();
            const prevIndex = index - 1;

            // Allow skipping dead refs backwards
            let actualPrev = prevIndex;
            while (actualPrev >= 0 && (!refs[actualPrev] || !refs[actualPrev].current)) {
                actualPrev--;
            }

            if (actualPrev >= 0 && refs[actualPrev] && refs[actualPrev].current) {
                refs[actualPrev].current.focus();
            }
        }
    };

    return handleKeyDown;
};
