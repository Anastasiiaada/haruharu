import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Settings2} from 'lucide-react';

export function CompactMenu({label,children}:{label:string;children:ReactNode}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open,setOpen] = useState(false);
  useEffect(()=>{
    if(!open)return;
    const outside = (event:PointerEvent) => {
      if(ref.current&&!ref.current.contains(event.target as Node))ref.current.open=false;
    };
    const escape = (event:KeyboardEvent) => {
      if(event.key==='Escape'&&ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus();}
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <details ref={ref} className="compact-menu" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary aria-label={label} title={label}><Settings2 size={20}/></summary>
    <div className="compact-menu-panel">{children}</div>
  </details>;
}
