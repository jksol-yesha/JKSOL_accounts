import { useRef, useState, useCallback } from 'react';

/**
 * Custom React hook for WebSocket connections with JWT authentication
 * 
 * @param {number|null} branchId - The branch ID to subscribe to for branch-scoped events
 * @returns {Object} WebSocket connection state and utilities
 */
export const useWebSocket = (branchId) => {
    const [isConnected, setIsConnected] = useState(false);
    const listenersRef = useRef(new Map());
    const lastMessage = null;

    // Connect to WebSocket
    const connect = useCallback(() => {
        // WebSocket is intentionally disabled in the current build.
        setIsConnected(false);
    }, []);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        setIsConnected(false);
    }, []);

    // Subscribe to an event
    const on = useCallback((event, callback) => {
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(callback);

        // Return unsubscribe function
        return () => {
            const listeners = listenersRef.current.get(event);
            if (listeners) {
                listeners.delete(callback);
                if (listeners.size === 0) {
                    listenersRef.current.delete(event);
                }
            }
        };
    }, []);

    // Send a message
    const send = useCallback((data) => {
        void branchId;
        void data;
    }, [branchId]);

    return {
        isConnected,
        lastMessage,
        on,
        send,
        connect,
        disconnect
    };
};

export default useWebSocket;
