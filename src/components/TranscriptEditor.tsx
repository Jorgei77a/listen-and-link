
import { useState, useEffect, useRef, useCallback } from 'react'
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
  content: string | object
  onChange?: (html: string) => void
  onTextClick?: (event: MouseEvent, position: number) => void
}

const TranscriptEditor = ({ content, onChange, onTextClick }: TranscriptEditorProps) => {
  const [isMounted, setIsMounted] = useState(false)
  const [initialContent] = useState(content) // Store initial content to prevent re-initialization
  const [isEditorFocused, setIsEditorFocused] = useState(false)
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
    onFocus: () => {
      setIsEditorFocused(true)
    },
    onBlur: () => {
      setIsEditorFocused(false)
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
      
      /* Make formatting actions more visible */
      .editor-headings strong {
        font-weight: 700;
        color: #111;
      }
      .editor-headings em {
        font-style: italic;
        color: #333;
      }
      .editor-headings u {
        text-decoration: underline;
        text-decoration-thickness: 0.1em;
      }
      
      /* Enhance paragraph spacing */
      .editor-headings p {
        margin-top: 0.5em;
        margin-bottom: 0.5em;
      }
      
      /* Add visual indication for the active cursor block */
      .editor-headings .has-focus {
        background-color: rgba(59, 130, 246, 0.05);
        border-radius: 0.25rem;
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
      editor.commands.focus('end')
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

  // Direct command executor function that ensures focus first
  const executeCommand = useCallback((command: () => boolean) => {
    if (!editor || editor.isDestroyed) return
    
    // First focus the editor if it's not already focused
    if (!isEditorFocused) {
      editor.commands.focus()
    }
    
    // Execute the command immediately
    command()
  }, [editor, isEditorFocused])

  // Simplified toolbar button component that directly executes commands
  const MenuButton = ({ 
    command, 
    active = false,
    disabled = false,
    tooltip,
    children 
  }: { 
    command: () => void, 
    active?: boolean, 
    disabled?: boolean,
    tooltip?: string,
    children: React.ReactNode 
  }) => {
    const handleClick = (e: React.MouseEvent) => {
      // Stop propagation to prevent editor from losing focus
      e.stopPropagation()
      e.preventDefault()
      command()
    }
    
    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClick}
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
        onClick={handleClick}
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

  // Handle click anywhere in the editor container
  const handleContainerClick = () => {
    if (editor && !editor.isDestroyed && !isEditorFocused) {
      editor.commands.focus()
    }
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
            command={() => executeCommand(() => editor.chain().toggleBold().run())}
            active={editor.isActive('bold')}
            tooltip="Bold (applies to selected text)"
          >
            <Bold className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            command={() => executeCommand(() => editor.chain().toggleItalic().run())}
            active={editor.isActive('italic')}
            tooltip="Italic (applies to selected text)"
          >
            <Italic className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            command={() => executeCommand(() => editor.chain().toggleUnderline().run())}
            active={editor.isActive('underline')}
            tooltip="Underline (applies to selected text)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            command={() => executeCommand(() => editor.chain().toggleHeading({ level: 1 }).run())}
            active={editor.isActive('heading', { level: 1 })}
            tooltip="Heading 1 (applies to current paragraph)"
          >
            <Heading1 className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            command={() => executeCommand(() => editor.chain().toggleHeading({ level: 2 }).run())}
            active={editor.isActive('heading', { level: 2 })}
            tooltip="Heading 2 (applies to current paragraph)"
          >
            <Heading2 className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            command={() => executeCommand(() => editor.chain().toggleHeading({ level: 3 }).run())}
            active={editor.isActive('heading', { level: 3 })}
            tooltip="Heading 3 (applies to current paragraph)"
          >
            <Heading3 className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            command={() => executeCommand(() => editor.chain().toggleBulletList().run())}
            active={editor.isActive('bulletList')}
            tooltip="Bullet List (applies to current paragraph)"
          >
            <List className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            command={() => executeCommand(() => editor.commands.undo())}
            disabled={!editor.can().undo()}
            tooltip="Undo"
          >
            <Undo className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            command={() => executeCommand(() => editor.commands.redo())}
            disabled={!editor.can().redo()}
            tooltip="Redo"
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
