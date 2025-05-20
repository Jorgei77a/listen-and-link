
import { useCallback } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Button } from "@/components/ui/button";
import { 
  Bold, 
  Italic, 
  Underline, 
  Heading1, 
  Heading2, 
  Heading3,
  List, 
  ListOrdered,
  Undo,
  Redo
} from "lucide-react";
import { 
  $getSelection, 
  $isRangeSelection, 
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND
} from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, HeadingTagType } from "@lexical/rich-text";
import { 
  INSERT_UNORDERED_LIST_COMMAND, 
  INSERT_ORDERED_LIST_COMMAND, 
  REMOVE_LIST_COMMAND 
} from "@lexical/list";
import { mergeRegister } from "@lexical/utils";

export function EditorToolbar() {
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

  const formatHeading = useCallback((headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Using the explicit assertion to ensure type compatibility
        $setBlocksType(selection as any, () => $createHeadingNode(headingSize));
      }
    });
  }, [editor]);

  const formatBulletList = useCallback(() => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const formatOrderedList = useCallback(() => {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
  }, [editor]);

  const undo = useCallback(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editor]);

  const redo = useCallback(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  }, [editor]);

  return (
    <div className="flex items-center gap-1 p-1 overflow-x-auto bg-muted/50 border-b rounded-t-md">
      <Button 
        onClick={formatBold} 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button 
        onClick={formatItalic} 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button 
        onClick={formatUnderline} 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Underline"
      >
        <Underline className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button 
        onClick={() => formatHeading("h1")}
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button 
        onClick={() => formatHeading("h2")}
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button 
        onClick={() => formatHeading("h3")}
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button 
        onClick={formatBulletList}
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button 
        onClick={formatOrderedList}
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button 
        onClick={undo}
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Undo"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button 
        onClick={redo}
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
}
