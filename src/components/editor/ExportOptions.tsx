
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Lock } from "lucide-react";
import { EditorState, LexicalEditor } from "lexical";
import { FeatureGate } from "@/components/FeatureGate";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ExportOptionsProps {
  editor: LexicalEditor | null;
  title?: string;
}

export function ExportOptions({ editor, title = "transcript" }: ExportOptionsProps) {
  const [plainText, setPlainText] = useState<string>("");
  const [markdownText, setMarkdownText] = useState<string>("");
  
  // Extract plain text from the editor
  useEffect(() => {
    if (!editor) return;
    
    editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const textContent = editorState.read(() => {
          return editor.getEditorState()._nodeMap.get("root").getTextContent();
        });
        setPlainText(textContent);
        
        // For markdown, we'd need more complex logic to preserve formatting
        // This is a simplified version
        setMarkdownText(textContent);
      });
    });
  }, [editor]);

  const handleDownload = (format: 'plain' | 'markdown') => {
    const textToDownload = format === 'plain' ? plainText : markdownText;
    const fileExtension = format === 'plain' ? 'txt' : 'md';
    
    const element = document.createElement("a");
    const file = new Blob([textToDownload], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${title}.${fileExtension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="relative group">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="py-1">
            <button 
              onClick={() => handleDownload('plain')} 
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Plain Text (.txt)
            </button>
            
            <FeatureGate 
              featureKey="exportFormats"
              hideOnDisabled={false}
              showBadge={false}
              description="Markdown export is available on higher plans"
            >
              <button 
                onClick={() => handleDownload('markdown')} 
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Markdown (.md)
              </button>
            </FeatureGate>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
