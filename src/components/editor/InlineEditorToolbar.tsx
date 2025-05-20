
import { useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Button } from "@/components/ui/button";
import { 
  Bold, 
  Italic, 
  Underline,
  Undo,
  Redo
} from "lucide-react";
import { 
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND
} from "lexical";

export function InlineEditorToolbar() {
  const [editor] = useLexicalComposerContext();

  const formatBold = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
  }, [editor]);

  const formatItalic = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
  }, [editor]);

  const formatUnderline = useCallback(() => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
  }, [editor]);

  const undo = useCallback(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editor]);

  const redo = useCallback(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  }, [editor]);

  return (
    <div className="flex items-center gap-1 p-1 mb-1 bg-muted/50 border rounded-md">
      <Button 
        onClick={formatBold} 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6" 
        title="Bold"
      >
        <Bold className="h-3 w-3" />
      </Button>
      <Button 
        onClick={formatItalic} 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        title="Italic"
      >
        <Italic className="h-3 w-3" />
      </Button>
      <Button 
        onClick={formatUnderline} 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        title="Underline"
      >
        <Underline className="h-3 w-3" />
      </Button>

      <div className="w-px h-4 bg-border mx-1" />

      <Button 
        onClick={undo}
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        title="Undo"
      >
        <Undo className="h-3 w-3" />
      </Button>
      <Button 
        onClick={redo}
        variant="ghost" 
        size="icon" 
        className="h-6 w-6"
        title="Redo"
      >
        <Redo className="h-3 w-3" />
      </Button>
    </div>
  );
}
