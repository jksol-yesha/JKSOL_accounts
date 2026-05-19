import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const normalizeDbTimeZone = (rawValue?: string) => {
    const value = String(rawValue || '').trim().toUpperCase();
    if (value === 'Z' || value === 'UTC') return '+00:00';
    if (/^[+-]\d{2}:\d{2}$/.test(value)) return value;
    return '+00:00';
};

const dbTimeZone = normalizeDbTimeZone(process.env.DB_TIMEZONE);

export const connection = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    database: process.env.DB_NAME || "test_db",
    password: process.env.DB_PASSWORD || "",
    port: Number(process.env.DB_PORT) || 3306,
    timezone: dbTimeZone,
    dateStrings: ['DATE'],
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

connection.on('connection', (poolConnection) => {
    poolConnection.query(`SET time_zone = '${dbTimeZone}'`);
});

export const db = drizzle(connection, { mode: "default", schema });
