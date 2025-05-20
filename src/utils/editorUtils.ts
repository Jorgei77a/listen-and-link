/**
 * Utility functions for the text editor
 */

/**
 * Converts plain text into Tiptap JSON document format with proper paragraph blocks
 * 
 * @param text Plain text transcript to convert
 * @returns Tiptap-compatible JSON document structure
 */
export const convertPlainTextToTiptapJSON = (text: string) => {
  if (!text) {
    return {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] }
      ]
    };
  }
  
  // First, normalize line breaks
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split text into paragraphs using multiple patterns
  let paragraphs: string[] = [];
  
  // If the text already has paragraph breaks, respect them
  if (normalizedText.includes('\n\n')) {
    paragraphs = normalizedText.split(/\n\s*\n/).filter(Boolean);
  } else {
    // Otherwise, add paragraph breaks after sentences for better readability
    // We'll use a regex that looks for end of sentences followed by capital letters
    const modifiedText = normalizedText
      .replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2')
      // Format potential speaker labels (NAME: text)
      .replace(/([A-Z][a-z]+):\s*/g, '\n\n$1: ')
      // Clean up any excessive newlines
      .replace(/\n{3,}/g, '\n\n');
      
    paragraphs = modifiedText.split(/\n\s*\n/).filter(Boolean);
  }

  // If we only have one paragraph, see if we can split it further at sentence boundaries
  if (paragraphs.length === 1 && paragraphs[0].length > 300) {
    const longText = paragraphs[0];
    // Try splitting long paragraphs at sentence endings
    const sentenceSplit = longText
      .replace(/([.!?])\s+/g, '$1\n\n')
      .replace(/\n{3,}/g, '\n\n');
    
    const potentialParagraphs = sentenceSplit.split(/\n\s*\n/).filter(Boolean);
    
    // Only use the new splits if we actually got more than one paragraph
    if (potentialParagraphs.length > 1) {
      paragraphs = potentialParagraphs;
    }
  }

  // Remove any extra whitespace from paragraphs
  paragraphs = paragraphs.map(p => p.trim()).filter(Boolean);

  // Create the Tiptap JSON document structure
  const content = paragraphs.map(paragraph => {
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }]
    };
  });

  // If we have no paragraphs, create at least one empty paragraph
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: []
    });
  }

  return {
    type: 'doc',
    content
  };
};
