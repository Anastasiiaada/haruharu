import {m,useReducedMotion} from 'motion/react';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {lockBodyScroll} from './scrollLock';

export function Dialog({children,titleId,onClose,className='',overlayClassName='',layoutId,closeOnBackdrop=false}:{children:ReactNode;titleId:string;onClose:()=>void;className?:string;overlayClassName?:string;layoutId?:string;closeOnBackdrop?:boolean}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const [viewport,setViewport] = useState<{top:number;height:number}>();
  close.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement|null;
    const dialog = ref.current;
    const unlockScroll = lockBodyScroll();
    ref.current?.focus({preventScroll:true});
    const key = (event:KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[data-haruharu-dialog]');
      if (dialogs[dialogs.length-1] !== ref.current) return;
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[contenteditable="true"],[tabindex="0"]') || []).filter(e=>e.getClientRects().length>0);
      const first = elements[0], last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement===first || document.activeElement===ref.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement===last || document.activeElement===ref.current)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown',key);
    return () => {
      document.removeEventListener('keydown',key);
      unlockScroll();
      const remaining = Array.from(document.querySelectorAll<HTMLElement>('[data-haruharu-dialog]')).filter(element=>element!==dialog).at(-1);
      if (remaining) {
        if (!remaining.contains(document.activeElement)) remaining.focus({preventScroll:true});
      } else if (previous?.isConnected) previous.focus({preventScroll:true});
    };
  },[]);

  useEffect(() => {
    const visible = window.visualViewport;
    if (!visible) return;
    const update = () => setViewport({top:visible.offsetTop,height:visible.height});
    update();
    visible.addEventListener('resize',update);
    visible.addEventListener('scroll',update);
    return () => {
      visible.removeEventListener('resize',update);
      visible.removeEventListener('scroll',update);
    };
  },[]);

  return createPortal(<m.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:.16}} className={`overlay experience-overlay ${overlayClassName}`} style={viewport?{top:viewport.top,height:viewport.height,bottom:'auto'}:undefined} onPointerDown={event=>{if(closeOnBackdrop&&event.target===event.currentTarget)close.current();}}>
    <m.section layoutId={reduced?undefined:layoutId} initial={layoutId?false:{opacity:0,scale:reduced?1:.96,y:reduced?0:14}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:reduced?1:.97}} transition={{type:'spring',stiffness:310,damping:28}} ref={ref} tabIndex={-1} data-haruharu-dialog role="dialog" aria-modal="true" aria-labelledby={titleId} className={`modal ${className}`}>
      <button type="button" className="close" aria-label="Закрити вікно" onClick={onClose}><X size={20}/></button>
      {children}
    </m.section>
  </m.div>,document.body);
}
