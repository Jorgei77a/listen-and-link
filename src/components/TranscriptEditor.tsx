
import { useState, useEffect, useCallback } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import Underline from '@tiptap/extension-underline'
import BulletList from '@tiptap/extension-bullet-list'
import ListItem from '@tiptap/extension-list-item'
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

interface TranscriptEditorProps {
  content: string
  onChange?: (html: string) => void
  onTextClick?: (event: MouseEvent, position: number) => void
}

const TranscriptEditor = ({ content, onChange, onTextClick }: TranscriptEditorProps) => {
  const [isMounted, setIsMounted] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Heading.configure({ levels: [1, 2, 3] }),
      Underline,
      BulletList,
      ListItem,
    ],
    content: content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose focus:outline-none max-w-none min-h-[250px] p-4 overflow-y-auto',
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
  })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  if (!isMounted) {
    return null
  }

  const MenuButton = ({ 
    onClick, 
    active = false,
    disabled = false,
    children 
  }: { 
    onClick: () => void, 
    active?: boolean, 
    disabled?: boolean,
    children: React.ReactNode 
  }) => {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
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

  return (
    <div className="border rounded-md overflow-hidden bg-card">
      {editor && (
        <div className="border-b p-1 flex flex-wrap gap-0.5 bg-muted/30">
          <MenuButton 
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
          >
            <Bold className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
          >
            <Italic className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().focus().toggleMark('underline').run()}
            active={editor.isActive('underline')}
          >
            <UnderlineIcon className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
          >
            <Heading1 className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
          >
            <Heading2 className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
          >
            <Heading3 className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
          >
            <List className="h-4 w-4" />
          </MenuButton>
          
          <div className="w-px h-full mx-1 bg-border" />
          
          <MenuButton 
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </MenuButton>
          
          <MenuButton 
            onClick={() => editor.chain().focus().redo().run()}
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
