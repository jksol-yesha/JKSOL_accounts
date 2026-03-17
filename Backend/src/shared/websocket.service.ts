import type { ServerWebSocket } from 'bun';
import jwt from '@elysiajs/jwt';

// Type definitions
interface WebSocketData {
    userId: number;
    branchId: number | null;
    orgId: number | null;
}

interface BroadcastPayload {
    event: string;
    data: any;
}

// Store active WebSocket connections
// Key: userId, Value: Set of WebSocket connections
const connections = new Map<number, Set<ServerWebSocket<WebSocketData>>>();

// Store branch subscriptions
// Key: branchId, Value: Set of userIds
const branchSubscriptions = new Map<number, Set<number>>();

export const WebSocketService = {
    /**
     * Register a new WebSocket connection
     */
    addConnection(ws: ServerWebSocket<WebSocketData>, userId: number, branchId: number | null, orgId: number | null) {
        // Store connection data
        ws.data = { userId, branchId, orgId };

        // Add to user connections
        if (!connections.has(userId)) {
            connections.set(userId, new Set());
        }
        connections.get(userId)!.add(ws);

        // Subscribe to branch if provided
        if (branchId) {
            if (!branchSubscriptions.has(branchId)) {
                branchSubscriptions.set(branchId, new Set());
            }
            branchSubscriptions.get(branchId)!.add(userId);
        }

        console.log(`✅ WebSocket connected: User ${userId}, Branch ${branchId}, Org ${orgId}`);
        console.log(`📊 Total connections: ${this.getConnectionCount()}`);
    },

    /**
     * Remove a WebSocket connection
     */
    removeConnection(ws: ServerWebSocket<WebSocketData>) {
        const { userId, branchId } = ws.data;

        // Remove from user connections
        const userConnections = connections.get(userId);
        if (userConnections) {
            userConnections.delete(ws);
            if (userConnections.size === 0) {
                connections.delete(userId);
            }
        }

        // Remove from branch subscriptions
        if (branchId) {
            const branchUsers = branchSubscriptions.get(branchId);
            if (branchUsers) {
                branchUsers.delete(userId);
                if (branchUsers.size === 0) {
                    branchSubscriptions.delete(branchId);
                }
            }
        }

        console.log(`❌ WebSocket disconnected: User ${userId}, Branch ${branchId}`);
        console.log(`📊 Total connections: ${this.getConnectionCount()}`);
    },

    /**
     * Broadcast message to all users in a specific branch
     */
    broadcastToBranch(branchId: number, payload: BroadcastPayload) {
        const userIds = branchSubscriptions.get(branchId);
        if (!userIds || userIds.size === 0) {
            console.log(`📭 No subscribers for branch ${branchId}`);
            return;
        }

        const message = JSON.stringify(payload);
        let sentCount = 0;

        userIds.forEach(userId => {
            const userConnections = connections.get(userId);
            if (userConnections) {
                userConnections.forEach(ws => {
                    try {
                        ws.send(message);
                        sentCount++;
                    } catch (error) {
                        console.error(`Failed to send to user ${userId}:`, error);
                    }
                });
            }
        });

        console.log(`📢 Broadcast to branch ${branchId}: ${payload.event} (${sentCount} connections)`);
    },

    /**
     * Broadcast to a specific user (all their connections)
     */
    broadcastToUser(userId: number, payload: BroadcastPayload) {
        const userConnections = connections.get(userId);
        if (!userConnections || userConnections.size === 0) {
            console.log(`📭 No connections for user ${userId}`);
            return;
        }

        const message = JSON.stringify(payload);
        userConnections.forEach(ws => {
            try {
                ws.send(message);
            } catch (error) {
                console.error(`Failed to send to user ${userId}:`, error);
            }
        });

        console.log(`📢 Broadcast to user ${userId}: ${payload.event} (${userConnections.size} connections)`);
    },

    /**
     * Broadcast to all users in an organization
     */
    broadcastToOrg(orgId: number, payload: BroadcastPayload) {
        const message = JSON.stringify(payload);
        let sentCount = 0;

        connections.forEach((userConnections, userId) => {
            userConnections.forEach(ws => {
                if (ws.data.orgId === orgId) {
                    try {
                        ws.send(message);
                        sentCount++;
                    } catch (error) {
                        console.error(`Failed to send to user ${userId}:`, error);
                    }
                }
            });
        });

        console.log(`📢 Broadcast to org ${orgId}: ${payload.event} (${sentCount} connections)`);
    },

    /**
     * Get total number of active connections
     */
    getConnectionCount(): number {
        let count = 0;
        connections.forEach(userConnections => {
            count += userConnections.size;
        });
        return count;
    },

    /**
     * Get statistics for monitoring
     */
    getStats() {
        return {
            totalConnections: this.getConnectionCount(),
            totalUsers: connections.size,
            totalBranches: branchSubscriptions.size,
            branches: Array.from(branchSubscriptions.entries()).map(([branchId, users]) => ({
                branchId,
                userCount: users.size
            }))
        };
    }
};
