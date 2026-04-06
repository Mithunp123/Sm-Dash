/**
 * Format datetime strings for HTML input elements
 * Converts ISO strings like "2026-04-23T03:55:00.000Z" to "2026-04-23T03:55"
 */

export const formatDatetimeForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    try {
        // Remove the Z (UTC timezone marker) if present
        const cleanStr = dateString.replace('Z', '');
        
        // Check if it has time component (contains T)
        if (cleanStr.includes('T')) {
            const [datePart, timePart] = cleanStr.split('T');
            // Extract HH:mm from HH:mm:ss or HH:mm:ss.SSS
            const timeMatch = timePart.match(/^(\d{2}):(\d{2})/);
            if (timeMatch) {
                return `${datePart}T${timeMatch[1]}:${timeMatch[2]}`;
            }
        }
        return cleanStr;
    } catch (err) {
        console.error('Error formatting datetime:', err);
        return "";
    }
};

/**
 * Format date strings for HTML date input elements  
 * Converts ISO strings like "2026-04-23T03:55:00.000Z" to "2026-04-23"
 */
export const formatDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString) return new Date().toISOString().split('T')[0];
    try {
        // If it's an ISO string with time, extract just the date part
        if (dateString.includes('T')) {
            return dateString.split('T')[0];
        }
        return dateString;
    } catch (err) {
        console.error('Error formatting date:', err);
        return new Date().toISOString().split('T')[0];
    }
};
