
import { useState, useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  Undo,
  Redo,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TranscriptEditorProps {
  content: string
  onChange?: (html: string) => void
  onTextClick?: (event: MouseEvent, position: number) => void
}

const TranscriptEditor = ({ content, onChange, onTextClick }: TranscriptEditorProps) => {
  const [isMounted, setIsMounted] = useState(false)
  const [initialContent] = useState(content) // Store initial content to prevent re-initialization
  const editorRef = useRef<HTMLDivElement>(null)
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose focus:outline-none max-w-none min-h-[250px] p-4 overflow-y-auto editor-headings',
      },
      handleClick: (view, pos, event) => {
        if (onTextClick) {
          onTextClick(event as unknown as MouseEvent, pos)
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML())
      }
    },
    autofocus: 'end', // Focus at the end of content
  })

  // Ensure the editor gets mounted
  useEffect(() => {
    setIsMounted(true)
    
    // Add custom styles for headings in the editor
    const style = document.createElement('style')
    style.textContent = `
      .editor-headings h1 {
        font-size: 1.8em;
        font-weight: 700;
        margin-top: 0.75em;
        margin-bottom: 0.25em;
        color: #1a1f2c;
      }
      .editor-headings h2 {
        font-size: 1.5em;
        font-weight: 600;
        margin-top: 0.75em;
        margin-bottom: 0.25em;
        color: #333;
      }
      .editor-headings h3 {
        font-size: 1.25em;
        font-weight: 500;
        margin-top: 0.5em;
        margin-bottom: 0.25em;
        color: #444;
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])
  
  // Explicitly focus editor after mount
  useEffect(() => {
    if (editor && isMounted && !editor.isDestroyed) {
      setTimeout(() => {
        editor.commands.focus('end')
      }, 100)
    }
  }, [editor, isMounted])

  // Only update editor content on initial mount, not on every re-render
  useEffect(() => {
    if (editor && content && !editor.isDestroyed && initialContent !== content) {
      // Only update if editor is active and content has changed from initial value
      editor.commands.setContent(content)
      editor.commands.focus('end')
    }
  }, [editor, initialContent]) // Removed content from dependency array to prevent re-updates

  // Ensure we focus editor when clicking on its container 
  const handleContainerClick = () => {
    if (editor && !editor.isDestroyed) {
      editor.commands.focus()
    }
  }

  // Improved MenuButton component with more reliable focus handling
  const MenuButton = ({ 
    onClick, 
    active = false,
    disabled = false,
    tooltip,
    children 
  }: { 
    onClick: () => void, 
    active?: boolean, 
    disabled?: boolean,
    tooltip?: string,
    children: React.ReactNode 
  }) => {
    // Fix for double-click issue: ensure focus is maintained between clicks
    const handleButtonClick = () => {
      if (editor && !editor.isDestroyed) {
        // First ensure editor has focus
        editor.commands.focus()
        // Then execute the command
        onClick()
      }
    }
    
    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleButtonClick}
              disabled={disabled}
              className={cn(
                'h-8 w-8 p-0',
                active ? 'bg-muted text-primary' : 'text-muted-foreground'
              )}
            >
              {children}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      )
    }
    
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleButtonClick}
        disabled={disabled}
        className={cn(
          'h-8 w-8 p-0',
          active ? 'bg-muted text-primary' : 'text-muted-foreground'
        )}
      >
        {children}
      </Button>
    )
  }

  if (!isMounted) {
    return null
  }

  return (
    <div 
      className="border rounded-md overflow-hidden bg-card"
      onClick={handleContainerClick}
      ref={editorRef}
    >
      {editor && (
        <div className="border-b p-1 flex flex-wrap gap-0.5 bg-muted/30">
          <MenuButton 
            onClick={() => editor.chain().toggleBold().run()}
            active={editor.isActive('bold')}
          >
            <Bold className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().toggleItalic().run()}
            active={editor.isActive('italic')}
          >
            <Italic className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().toggleUnderline().run()}
            active={editor.isActive('underline')}
          >
            <UnderlineIcon className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            onClick={() => editor.chain().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            tooltip="Heading 1 (applies to whole paragraph)"
          >
            <Heading1 className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            tooltip="Heading 2 (applies to whole paragraph)"
          >
            <Heading2 className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            tooltip="Heading 3 (applies to whole paragraph)"
          >
            <Heading3 className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            onClick={() => editor.chain().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
          >
            <List className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            onClick={() => editor.chain().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </MenuButton>
        </div>
      )}
      
      <EditorContent editor={editor} />
    </div>
  )
}

export default TranscriptEditor
