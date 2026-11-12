import {useEffect,useRef,useState} from 'react';
import {useEditor,useEditorState,EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {TableKit} from '@tiptap/extension-table';
import {Bold,Italic,Heading2,List,Table2,MoreHorizontal,Quote,Rows3,Columns3,Trash2,Undo2,Redo2} from 'lucide-react';
import {EditorPlaceholder} from './editorPlaceholder';
import './editor.css';

export function Editor({content,onChange}:{content:string;onChange:(html:string)=>void}) {
  const [more,setMore] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    extensions: [StarterKit,TableKit,EditorPlaceholder],
    content,
    editorProps: {attributes: {'aria-label':'Текст конспекту',role:'textbox','aria-multiline':'true'}},
    onUpdate: ({editor}) => onChange(editor.getHTML()),
  });
  const state = useEditorState({editor,selector: ({editor}) => editor ? {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'),
    heading: editor.isActive('heading',{level:2}), list: editor.isActive('bulletList'),
    table: editor.isActive('table'), undo: editor.can().undo(), redo: editor.can().redo(),
  } : null});

  useEffect(() => {
    if (!more) return;
    const outside = (event:PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setMore(false);
    };
    const escape = (event:KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setMore(false); }
    };
    document.addEventListener('pointerdown',outside);
    wrapper.current?.addEventListener('keydown',escape);
    const element = wrapper.current;
    return () => {
      document.removeEventListener('pointerdown',outside);
      element?.removeEventListener('keydown',escape);
    };
  },[more]);

  useEffect(() => {
    if (!editor || !window.visualViewport) return;
    // Only reveal the caret when the keyboard changes the visible viewport.
    // Composition stays under the editor's native IME handling.
    const viewport = window.visualViewport;
    const reveal = () => {
      if (!editor.isFocused || editor.view.composing) return;
      const caret = editor.view.coordsAtPos(editor.state.selection.head);
      if (caret.bottom > viewport.offsetTop + viewport.height - 24 || caret.top < viewport.offsetTop + 64) {
        editor.view.dispatch(editor.state.tr.scrollIntoView());
      }
    };
    viewport.addEventListener('resize',reveal);
    return () => viewport.removeEventListener('resize',reveal);
  },[editor]);

  if (!editor || !state) return null;
  const primary = [
    {label:'Жирний',Icon:Bold,active:state.bold,run:()=>editor.chain().focus().toggleBold().run()},
    {label:'Курсив',Icon:Italic,active:state.italic,run:()=>editor.chain().focus().toggleItalic().run()},
    {label:'Заголовок',Icon:Heading2,active:state.heading,run:()=>editor.chain().focus().toggleHeading({level:2}).run()},
    {label:'Маркований список',Icon:List,active:state.list,run:()=>editor.chain().focus().toggleBulletList().run()},
    {label:'Вставити таблицю',Icon:Table2,active:state.table,run:()=>editor.chain().focus().insertTable({rows:3,cols:2,withHeaderRow:true}).run()},
  ];
  const extra = [
    {label:'Вставити правило',Icon:Quote,disabled:false,run:()=>editor.chain().focus().toggleBlockquote().run()},
    {label:'Додати рядок',Icon:Rows3,disabled:!state.table,run:()=>editor.chain().focus().addRowAfter().run()},
    {label:'Додати стовпець',Icon:Columns3,disabled:!state.table,run:()=>editor.chain().focus().addColumnAfter().run()},
    {label:'Видалити рядок',Icon:Trash2,disabled:!state.table,run:()=>editor.chain().focus().deleteRow().run()},
    {label:'Видалити таблицю',Icon:Table2,disabled:!state.table,run:()=>editor.chain().focus().deleteTable().run()},
    {label:'Скасувати дію',Icon:Undo2,disabled:!state.undo,run:()=>editor.chain().focus().undo().run()},
    {label:'Повторити дію',Icon:Redo2,disabled:!state.redo,run:()=>editor.chain().focus().redo().run()},
  ];
  return <div className="editor note-editor" ref={wrapper}>
    <div className="toolbar note-toolbar" role="toolbar" aria-label="Форматування конспекту">
      {primary.map(({label,Icon,active,run}) => <button type="button" key={label} title={label} aria-label={label} aria-pressed={active} onPointerDown={e=>e.preventDefault()} onClick={()=>{if(!editor.view.composing)run();}}><Icon size={19}/></button>)}
      <button type="button" aria-label="Додаткові інструменти" title="Ще" aria-expanded={more} aria-controls="note-editor-more" onPointerDown={e=>e.preventDefault()} onClick={()=>setMore(!more)}><MoreHorizontal size={21}/></button>
      {more && <div className="editor-more" id="note-editor-more" role="group" aria-label="Додаткові інструменти">
        {extra.map(({label,Icon,disabled,run}) => <button type="button" key={label} disabled={disabled} onPointerDown={e=>e.preventDefault()} onClick={()=>{if(editor.view.composing)return;run();setMore(false);}}><Icon size={17}/>{label}</button>)}
      </div>}
    </div>
    <EditorContent editor={editor}/>
  </div>;
}
