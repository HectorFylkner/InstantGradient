/**
 * Triggers a browser download for the given content.
 * 
 * @param filename The desired filename for the download.
 * @param content The Blob or string content to download.
 * @param mimeType The MIME type (required if content is a string).
 */
export function triggerDownload(filename: string, content: Blob | string, mimeType?: string) {
    const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Append anchor to body to ensure click works
    a.click();
    document.body.removeChild(a); // Clean up anchor
    URL.revokeObjectURL(url); // Clean up blob URL
} 