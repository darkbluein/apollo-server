import { v4 as uuid } from 'uuid';

/**
 * Generates a unique UUID
 * @returns String
 */
export function uniqueId(): string {
    return uuid();
}
