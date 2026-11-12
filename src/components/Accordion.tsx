import {useId,useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
export function Accordion({title,children}:{title:string;children:ReactNode}){const [open,setOpen]=useState(false);const id=useId();return <section className={`accordion ${open?'expanded':''}`}><h3><button type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{title}<ChevronDown size={18}/></button></h3><div id={id} className="accordion-reveal" aria-hidden={!open} inert={!open}><div className="accordion-content">{children}</div></div></section>;}
