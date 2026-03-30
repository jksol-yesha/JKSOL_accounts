import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Custom React hook for WebSocket connections with JWT authentication
 * 
 * @param {number|null} branchId - The branch ID to subscribe to for branch-scoped events
 * @returns {Object} WebSocket connection state and utilities
 */
export const useWebSocket = (branchId) => {
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const listenersRef = useRef(new Map());
    const wasConnectedRef = useRef(false); // Track if we were ever connected

    // Get JWT token from localStorage
    const getToken = useCallback(() => {
        return localStorage.getItem('accessToken');
    }, []);

    // Connect to WebSocket
    const connect = useCallback(() => {
        // TEMPORARY: Disable WebSocket connection as requested
        // console.log('🔌 WebSocket connection disabled by user request');
        return;

        const token = getToken();
        if (!token) {
            console.warn('⚠️ No JWT token found, skipping WebSocket connection');
            return;
        }

        // Auto-detect protocol (ws for http, wss for https)
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

        // Construct WebSocket URL
        let wsUrl;
        if (import.meta.env.VITE_WS_URL) {
            // Allow explicit override via environment variable
            wsUrl = import.meta.env.VITE_WS_URL;
        } else {
            // Production-safe: Use same host and port as current page
            // Works for both localhost (via Vite proxy with ws:true) and ngrok/production
            wsUrl = `${protocol}://${window.location.host}/api/ws`;
        }

        // console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

        try {
            // Create WebSocket connection directly
            // Note: WebSocket connections don't use CORS - they use their own handshake mechanism
            // console.log("Creating WebSocket with URL:", wsUrl);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                // console.log('✅ WebSocket connected');
                setIsConnected(true);
                wasConnectedRef.current = true; // Mark as connected

                // Authenticate with JWT token
                ws.send(JSON.stringify({
                    type: 'auth',
                    token,
                    branchId
                }));
            };

            ws.onmessage = (event) => {
                try {
                    // console.log('📨 Raw WebSocket message:', event.data);
                    const message = JSON.parse(event.data);
                    // console.log('📨 Parsed WebSocket message:', message);

                    setLastMessage(message);

                    // Handle authentication response
                    if (message.type === 'authenticated') {
                        // console.log('✅ WebSocket authenticated:', message);
                    }

                    // Handle errors
                    if (message.type === 'error') {
                        console.error('❌ WebSocket error:', message.message);
                    }

                    // Trigger event listeners
                    if (message.event) {
                        const listeners = listenersRef.current.get(message.event);
                        if (listeners && listeners.size > 0) {
                            // console.log(`🔔 Event received: ${message.event}, notifying ${listeners.size} listener(s)`);
                            listeners.forEach(callback => callback(message.data));
                        }
                        // Silently ignore events with no listeners (component not mounted)
                    }
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                    console.error('Raw message was:', event.data);
                }
            };

            ws.onerror = (error) => {
                // Only log errors if we were previously connected
                // This suppresses harmless reconnection errors during initial connect attempts
                if (wasConnectedRef.current) {
                    console.error('❌ WebSocket error:', error);
                }
                setIsConnected(false);
            };

            ws.onclose = (event) => {
                // Log close reason for debugging (skip normal closures)
                if (event.code !== 1000 && wasConnectedRef.current) { // 1000 = normal closure
                    // console.log(`❌ WebSocket disconnected (code: ${event.code}, reason: ${event.reason || 'none'})`);
                }
                setIsConnected(false);
                wsRef.current = null;

                // Auto-reconnect after 3 seconds
                reconnectTimeoutRef.current = setTimeout(() => {
                    // console.log('🔄 Attempting to reconnect WebSocket...');
                    connect();
                }, 3000);
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            setIsConnected(false);
        }
    }, [branchId, getToken]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    // Subscribe to an event
    const on = useCallback((event, callback) => {
        if (!listenersRef.current.has(event)) {
            listenersRef.current.set(event, new Set());
        }
        listenersRef.current.get(event).add(callback);
        // console.log(`✅ Registered listener for: ${event}, total listeners: ${listenersRef.current.get(event).size}`);

        // Return unsubscribe function
        return () => {
            const listeners = listenersRef.current.get(event);
            if (listeners) {
                listeners.delete(callback);
                // console.log(`❌ Unregistered listener for: ${event}, remaining: ${listeners.size}`);
                if (listeners.size === 0) {
                    listenersRef.current.delete(event);
                }
            }
        };
    }, []);

    // Send a message
    const send = useCallback((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        } else {
            console.warn('⚠️ WebSocket is not connected');
        }
    }, []);

    // Auto-connect on mount and when branchId changes
    useEffect(() => {
        connect();
        return () => {
            disconnect();
        };
    }, [connect, disconnect]);

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
